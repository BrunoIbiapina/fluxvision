"""IoU Tracker simples para evitar contagem duplicada de veículos.

Para produção, trocar pela implementação oficial do ByteTrack / BoT-SORT
(via `ultralytics` ou `bytetracker`). O IoU tracker é suficiente para MVP e
para câmeras com framerate >= 10fps e movimento não-caótico.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

from .detector import Detection


def _iou(a: Detection, b: "Track") -> float:
    ax1, ay1, ax2, ay2 = a.x1, a.y1, a.x2, a.y2
    bx1, by1, bx2, by2 = b.x1, b.y1, b.x2, b.y2
    ix1 = max(ax1, bx1)
    iy1 = max(ay1, by1)
    ix2 = min(ax2, bx2)
    iy2 = min(ay2, by2)
    iw = max(0.0, ix2 - ix1)
    ih = max(0.0, iy2 - iy1)
    inter = iw * ih
    area_a = (ax2 - ax1) * (ay2 - ay1)
    area_b = (bx2 - bx1) * (by2 - by1)
    union = area_a + area_b - inter
    return inter / union if union > 0 else 0.0


@dataclass
class Track:
    track_id: int
    x1: float
    y1: float
    x2: float
    y2: float
    vehicle_type: str
    confidence: float
    first_frame: int
    last_frame: int
    first_ts: float
    last_ts: float
    age_miss: int = 0
    path: List[Tuple[float, float]] = field(default_factory=list)
    counted: bool = False
    cross_direction: Optional[str] = None

    @property
    def cx(self) -> float:
        return (self.x1 + self.x2) / 2.0

    @property
    def cy(self) -> float:
        return (self.y1 + self.y2) / 2.0


class IoUTracker:
    """Associa detecções frame a frame via IoU."""

    def __init__(self, iou_threshold: float = 0.3, max_miss: int = 15) -> None:
        self.iou_threshold = iou_threshold
        self.max_miss = max_miss
        self._next_id = 1
        self.tracks: Dict[int, Track] = {}
        # Tracks removidos na chamada mais recente de update() por
        # max_miss estourado. Útil pra quem quer aplicar fallbacks de
        # contagem baseados em sobrevivência (ex.: veículo que sumiu
        # sem cruzar linha virtual).
        self.last_expired: List[Track] = []

    def update(
        self, detections: List[Detection], frame_idx: int, timestamp: float
    ) -> List[Track]:
        """Atualiza o estado e retorna os tracks ativos após o update."""
        unmatched_dets = list(range(len(detections)))
        unmatched_tracks = list(self.tracks.keys())

        # Constrói matriz IoU det x track
        pairs: List[Tuple[int, int, float]] = []  # (det_idx, track_id, iou)
        for di in unmatched_dets:
            for tid in unmatched_tracks:
                iou = _iou(detections[di], self.tracks[tid])
                if iou >= self.iou_threshold:
                    pairs.append((di, tid, iou))

        # Greedy matching pelo maior IoU
        pairs.sort(key=lambda p: p[2], reverse=True)
        used_dets: set[int] = set()
        used_tracks: set[int] = set()
        for di, tid, _iou_val in pairs:
            if di in used_dets or tid in used_tracks:
                continue
            det = detections[di]
            tr = self.tracks[tid]
            tr.x1, tr.y1, tr.x2, tr.y2 = det.x1, det.y1, det.x2, det.y2
            tr.confidence = max(tr.confidence, det.confidence)
            tr.last_frame = frame_idx
            tr.last_ts = timestamp
            tr.age_miss = 0
            tr.path.append(((det.x1 + det.x2) / 2, (det.y1 + det.y2) / 2))
            used_dets.add(di)
            used_tracks.add(tid)

        # Detecções não associadas → novos tracks
        for di in range(len(detections)):
            if di in used_dets:
                continue
            det = detections[di]
            tr = Track(
                track_id=self._next_id,
                x1=det.x1, y1=det.y1, x2=det.x2, y2=det.y2,
                vehicle_type=det.vehicle_type.value,
                confidence=det.confidence,
                first_frame=frame_idx,
                last_frame=frame_idx,
                first_ts=timestamp,
                last_ts=timestamp,
                path=[((det.x1 + det.x2) / 2, (det.y1 + det.y2) / 2)],
            )
            self.tracks[self._next_id] = tr
            self._next_id += 1

        # Incrementa miss nos tracks não associados e remove os velhos
        to_del: List[int] = []
        for tid in unmatched_tracks:
            if tid in used_tracks:
                continue
            self.tracks[tid].age_miss += 1
            if self.tracks[tid].age_miss > self.max_miss:
                to_del.append(tid)

        expired: List[Track] = []
        for tid in to_del:
            expired.append(self.tracks[tid])
            del self.tracks[tid]
        # Sempre sobrescreve (zera se não expirou nada neste update).
        self.last_expired = expired

        return list(self.tracks.values())

    def all_tracks(self) -> List[Track]:
        return list(self.tracks.values())


# --------------------------------------------------------------------------
# Contagem por linha virtual
# --------------------------------------------------------------------------
def cross_line(track: Track, line: Tuple[Tuple[float, float], Tuple[float, float]]) -> Optional[str]:
    """Retorna 'in' / 'out' se o track atravessou a linha, senão None.

    `line` = ((x1, y1), (x2, y2)). Usa o path do track.
    """
    if track.counted or len(track.path) < 2:
        return None
    (lx1, ly1), (lx2, ly2) = line
    p0 = track.path[0]
    p1 = track.path[-1]

    def _side(x: float, y: float) -> float:
        return (lx2 - lx1) * (y - ly1) - (ly2 - ly1) * (x - lx1)

    s0 = _side(*p0)
    s1 = _side(*p1)
    if s0 == 0 or s1 == 0 or (s0 > 0) == (s1 > 0):
        return None
    track.counted = True
    direction = "in" if s0 < 0 and s1 > 0 else "out"
    track.cross_direction = direction
    return direction
