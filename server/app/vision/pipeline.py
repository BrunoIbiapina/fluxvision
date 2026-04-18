"""Pipeline end-to-end de processamento de vídeo.

Estágios:
    1. Abre o vídeo com OpenCV.
    2. Itera frames com stride configurável.
    3. Para cada frame: YOLO → detecções → tracker atualiza tracks.
    4. Conta veículos que cruzam a linha virtual (entrada/saída).
    5. Acumula heatmap.
    6. Persiste detecções consolidadas, summaries agregadas e heatmap PNG.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import cv2
import numpy as np

from ..config import settings
from ..db import session_scope
from ..models import Detection as DetectionModel
from ..models import TrafficSummary, Video, VideoStatus
from .detector import VehicleDetector
from .heatmap import HeatmapAccumulator
from .tracker import IoUTracker, Track, cross_line

logger = logging.getLogger(__name__)


# Paleta BGR por tipo de veículo. Cores vivas para ficar nítido em câmera de rua.
_VEHICLE_COLORS: Dict[str, Tuple[int, int, int]] = {
    "car": (80, 200, 255),
    "motorcycle": (255, 100, 255),
    "bus": (100, 200, 100),
    "truck": (0, 140, 255),
    "bicycle": (255, 255, 100),
    "van": (150, 100, 255),
    "other": (180, 180, 180),
}


def _draw_overlay(
    frame: np.ndarray,
    tracks: List[Track],
    counting_line: Tuple[Tuple[float, float], Tuple[float, float]],
    live_count: int,
) -> np.ndarray:
    """Desenha bounding boxes, labels, linha virtual e HUD sobre o frame."""
    # Linha virtual de contagem
    (lx1, ly1), (lx2, ly2) = counting_line
    cv2.line(
        frame,
        (int(lx1), int(ly1)),
        (int(lx2), int(ly2)),
        (255, 255, 255),
        2,
        cv2.LINE_AA,
    )

    # Boxes e rótulos
    for tr in tracks:
        color = _VEHICLE_COLORS.get(tr.vehicle_type, (180, 180, 180))
        x1, y1, x2, y2 = int(tr.x1), int(tr.y1), int(tr.x2), int(tr.y2)
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
        label = f"{tr.vehicle_type} #{tr.track_id} {int(tr.confidence * 100)}%"
        (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
        y_label_top = max(0, y1 - th - 6)
        cv2.rectangle(frame, (x1, y_label_top), (x1 + tw + 6, y1), color, -1)
        cv2.putText(
            frame,
            label,
            (x1 + 3, y1 - 4),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            (0, 0, 0),
            1,
            cv2.LINE_AA,
        )

    # HUD com contagem ao vivo
    hud = f"FluxVision  contados: {live_count}"
    cv2.rectangle(frame, (10, 10), (360, 50), (0, 0, 0), -1)
    cv2.putText(
        frame,
        hud,
        (20, 38),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.7,
        (255, 255, 255),
        2,
        cv2.LINE_AA,
    )
    return frame


def _open_writer(
    out_path: Path, fps: float, size: Tuple[int, int]
) -> Optional[cv2.VideoWriter]:
    """Tenta abrir um VideoWriter MP4 com fallback entre codecs."""
    for codec in ("mp4v", "avc1"):
        fourcc = cv2.VideoWriter_fourcc(*codec)
        writer = cv2.VideoWriter(str(out_path), fourcc, fps, size)
        if writer.isOpened():
            logger.info("VideoWriter aberto com codec %s → %s", codec, out_path)
            return writer
        writer.release()
    logger.warning("Nenhum codec aceitou abrir %s — anotação desabilitada", out_path)
    return None


@dataclass
class PipelineResult:
    video_id: int
    total_vehicles: int
    by_type: Dict[str, int]
    duration_s: float
    heatmap_path: Optional[str]


class VideoPipeline:
    """Executa o processamento completo de um `Video` já persistido."""

    def __init__(self, detector: Optional[VehicleDetector] = None) -> None:
        self.detector = detector or VehicleDetector()

    # ------------------------------------------------------------------
    def run(self, video_id: int) -> PipelineResult:
        with session_scope() as s:
            video: Video | None = s.get(Video, video_id)
            if not video:
                raise ValueError(f"Video {video_id} não encontrado")
            video.status = VideoStatus.PROCESSING
            s.commit()
            path = Path(video.filepath)
            recorded_at = video.recorded_at

        cap = cv2.VideoCapture(str(path))
        if not cap.isOpened():
            self._mark_failed(video_id, "cv2.VideoCapture não conseguiu abrir o arquivo")
            raise RuntimeError(f"Não foi possível abrir {path}")

        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or 1280
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or 720
        fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 0
        duration_s = frame_count / fps if fps > 0 else 0.0

        # iou_threshold 0.25 + max_miss = 1.5x fps dá tolerância a oclusão
        # parcial sem gerar tracks duplicados em veículos que "piscam".
        tracker = IoUTracker(
            iou_threshold=0.25,
            max_miss=max(8, int(fps * 1.5)),
        )
        heatmap = HeatmapAccumulator(width, height)

        # Linha virtual de contagem: horizontal no meio da imagem
        counting_line: Tuple[Tuple[float, float], Tuple[float, float]] = (
            (0.0, height * 0.55),
            (float(width), height * 0.55),
        )

        stride = max(1, settings.frame_stride)
        frame_idx = 0
        last_background: Optional[np.ndarray] = None
        tracks_final: Dict[int, "TrackSnapshot"] = {}

        # Writer do MP4 anotado — escreve TODO frame (mesmo os pulados do
        # stride) para que a duração do vídeo de saída case com a do original.
        annotated_out: Path = settings.annotated_dir / f"video_{video_id}.mp4"
        annotated_out.parent.mkdir(parents=True, exist_ok=True)
        writer = _open_writer(annotated_out, fps, (width, height))

        last_active_tracks: List[Track] = []
        live_count = 0

        while True:
            ok, frame = cap.read()
            if not ok:
                break

            if frame_idx % stride == 0:
                ts = frame_idx / fps
                detections = self.detector.detect(frame)
                active = tracker.update(detections, frame_idx=frame_idx, timestamp=ts)

                for d in detections:
                    heatmap.add_box(d.x1, d.y1, d.x2, d.y2, weight=1.0)

                for tr in active:
                    cross_line(tr, counting_line)
                    tracks_final[tr.track_id] = TrackSnapshot(
                        track_id=tr.track_id,
                        vehicle_type=tr.vehicle_type,
                        confidence=tr.confidence,
                        first_seen=recorded_at + timedelta(seconds=tr.first_ts),
                        last_seen=recorded_at + timedelta(seconds=tr.last_ts),
                        direction=tr.cross_direction,
                        counted=tr.counted,
                    )

                last_active_tracks = active
                live_count = sum(1 for t in tracks_final.values() if t.counted)

            # Anotação: desenha em TODO frame, reusando últimas tracks entre strides.
            if writer is not None:
                annotated_frame = _draw_overlay(
                    frame.copy(), last_active_tracks, counting_line, live_count
                )
                writer.write(annotated_frame)

            last_background = frame
            frame_idx += 1

        cap.release()
        if writer is not None:
            writer.release()

        # Considera "contados" tracks que apareceram em ≥3 frames estáveis
        counted = [
            t for t in tracks_final.values()
            if t.counted or (t.last_seen - t.first_seen).total_seconds() >= 0.5
        ]
        by_type: Dict[str, int] = {}
        for t in counted:
            by_type[t.vehicle_type] = by_type.get(t.vehicle_type, 0) + 1

        # Heatmap PNG
        heatmap_path: Optional[str] = None
        if last_background is not None:
            out = settings.heatmap_dir / f"video_{video_id}.png"
            heatmap.save(out, background=last_background)
            heatmap_path = str(out)

        # Persistência final
        with session_scope() as s:
            video: Video = s.get(Video, video_id)  # type: ignore[assignment]
            video.status = VideoStatus.DONE
            video.duration_s = duration_s
            video.width = width
            video.height = height
            video.fps = fps
            video.processed_at = datetime.utcnow()
            video.heatmap_path = heatmap_path
            video.annotated_path = (
                str(annotated_out) if writer is not None and annotated_out.exists() else None
            )

            for t in counted:
                s.add(
                    DetectionModel(
                        video_id=video_id,
                        camera_id=video.camera_id,
                        track_id=t.track_id,
                        vehicle_type=t.vehicle_type,  # type: ignore[arg-type]
                        direction=t.direction or "unknown",
                        first_seen=t.first_seen,
                        last_seen=t.last_seen,
                        confidence=t.confidence,
                    )
                )

            # Summary agregado no bucket da hora do recorded_at.
            # Pedestre fica na coluna `pedestrians` e FORA do `total`
            # (que representa "fluxo de veículos"). "others" tira
            # person/car/moto/bus/truck pra não duplicar.
            bucket = recorded_at.replace(minute=0, second=0, microsecond=0)
            city_id = video.camera.city_id
            pedestrians = by_type.get("person", 0)
            vehicle_total = len(counted) - pedestrians
            _VEHICLE_KNOWN = {"car", "motorcycle", "bus", "truck", "person"}
            summary = TrafficSummary(
                city_id=city_id,
                camera_id=video.camera_id,
                video_id=video_id,
                granularity="hour",
                bucket_start=bucket,
                total=vehicle_total,
                cars=by_type.get("car", 0),
                motorcycles=by_type.get("motorcycle", 0),
                buses=by_type.get("bus", 0),
                trucks=by_type.get("truck", 0),
                others=sum(v for k, v in by_type.items() if k not in _VEHICLE_KNOWN),
                pedestrians=pedestrians,
            )
            s.add(summary)

        return PipelineResult(
            video_id=video_id,
            total_vehicles=len(counted),
            by_type=by_type,
            duration_s=duration_s,
            heatmap_path=heatmap_path,
        )

    # ------------------------------------------------------------------
    def _mark_failed(self, video_id: int, error: str) -> None:
        with session_scope() as s:
            v = s.get(Video, video_id)
            if v:
                v.status = VideoStatus.FAILED
                v.error = error


@dataclass
class TrackSnapshot:
    track_id: int
    vehicle_type: str
    confidence: float
    first_seen: datetime
    last_seen: datetime
    direction: Optional[str]
    counted: bool
