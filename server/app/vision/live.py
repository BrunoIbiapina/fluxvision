"""Streaming ao vivo: captura contínua de uma fonte (RTSP/HLS/arquivo) +
detecção YOLO + tracking + encoding JPEG em memória para MJPEG HTTP.

Arquitetura:
    - Uma instância de `LiveStreamWorker` (threading.Thread) por câmera ativa.
    - Worker mantém `latest_jpeg` protegido por lock; leitores consumem sem
      bloquear o produtor.
    - `LiveManager` é um singleton módulo-level que indexa workers por
      camera_id e oferece start/stop/get thread-safe.
    - Cada veículo que cruza a linha virtual é imediatamente persistido no
      banco como incremento no TrafficSummary da hora corrente (video_id=NULL),
      fazendo o dashboard refletir em tempo real.
"""
from __future__ import annotations

import logging
import threading
import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional, Tuple, Union

import cv2
import numpy as np

from concurrent.futures import ThreadPoolExecutor

from ..config import settings
from ..db import session_scope
from ..models import Alert, AlertLevel, TrafficSummary, VehicleType
from .anomaly import AnomalyEvent, StoppedVehicleDetector
from .detector import VehicleDetector
from .pedestrian_alert import PedestrianEvent, PedestrianRoadwayDetector
from .pipeline import _draw_overlay  # reaproveita o desenho de boxes+HUD
from .police_classifier import PoliceClassification, PoliceClassifier
from .tracker import IoUTracker, Track, cross_line

logger = logging.getLogger(__name__)


# Placeholder mostrado enquanto o stream ainda não entregou o primeiro frame
# (evita que o <img> do browser exiba broken-icon).
def _placeholder_jpeg(text: str = "Conectando...") -> bytes:
    img = np.zeros((360, 640, 3), dtype=np.uint8)
    img[:] = (20, 20, 24)  # fundo escuro BGR
    cv2.putText(
        img,
        text,
        (30, 190),
        cv2.FONT_HERSHEY_SIMPLEX,
        1.0,
        (220, 220, 220),
        2,
        cv2.LINE_AA,
    )
    ok, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 75])
    return buf.tobytes() if ok else b""


@dataclass
class LiveStats:
    running: bool = False
    source: str = ""
    resolved_source: str = ""
    fps_real: float = 0.0
    frames_processed: int = 0
    total_counted: int = 0
    by_type: Dict[str, int] = field(default_factory=dict)
    started_at: Optional[float] = None
    last_frame_at: Optional[float] = None
    error: Optional[str] = None
    using_fallback_detector: bool = False

    @property
    def uptime_s(self) -> float:
        if not self.started_at:
            return 0.0
        return max(0.0, time.time() - self.started_at)


class LiveStreamWorker(threading.Thread):
    """Thread daemon que alimenta um buffer com frames anotados.

    Encerra quando `stop_event` é setado ou a fonte fecha sem permitir reabrir.
    """

    def __init__(
        self,
        camera_id: int,
        city_id: Optional[int],
        source: str,
        resolved_source: Union[str, int],
        source_label: Optional[str] = None,
        jpeg_quality: int = 78,
    ) -> None:
        super().__init__(daemon=True, name=f"LiveWorker-cam{camera_id}")
        self.camera_id = camera_id
        self.city_id = city_id
        self.source = source
        # `resolved_source` precisa chegar no OpenCV com o TIPO correto:
        #   - int (ex.: 0) pra webcam local
        #   - str (URL/arquivo) pra tudo mais
        # cv2.VideoCapture("0") NÃO abre a webcam; só abre com VideoCapture(0).
        # Guardamos também um rótulo em string (`_source_label`) pra exibir
        # na API/logs sem perder o zero como "device:0".
        self.resolved_source: Union[str, int] = resolved_source
        self._source_label: str = (
            source_label
            if source_label is not None
            else (f"device:{resolved_source}" if isinstance(resolved_source, int) else str(resolved_source))
        )
        self.jpeg_quality = jpeg_quality
        self.stop_event = threading.Event()

        self._detector = VehicleDetector()
        self._tracker: Optional[IoUTracker] = None
        # Detector de anomalias (veículo parado há muito tempo → Alert).
        # Thresholds seguem settings globais pra facilitar tuning sem
        # redeploy. Semáforo típico < 20s, então começamos só aí.
        self._anomaly = StoppedVehicleDetector(
            stop_px=settings.stopped_px,
            warn_after_s=settings.stopped_warn_s,
            critical_after_s=settings.stopped_critical_s,
        )

        # Detector de pedestre na faixa de risco. Mesma filosofia do
        # anomaly: feature flag global, thresholds em settings.
        self._pedestrian_alert: Optional[PedestrianRoadwayDetector] = None
        if settings.pedestrian_alert_enabled:
            self._pedestrian_alert = PedestrianRoadwayDetector(
                zone_top_frac=settings.pedestrian_risk_zone_top_frac,
                zone_bottom_frac=settings.pedestrian_risk_zone_bottom_frac,
                min_duration_s=settings.pedestrian_min_duration_s,
                alert_interval_s=settings.pedestrian_alert_interval_s,
            )

        # Classificador de viatura policial — opcional, roda em thread
        # separada pra não bloquear o pipeline enquanto a API remota
        # responde. Só ativa se a lib anthropic estiver instalada E a
        # feature estiver ligada em settings.
        self._police: Optional[PoliceClassifier] = None
        self._police_executor: Optional[ThreadPoolExecutor] = None
        if settings.vlm_police_enabled:
            clf = PoliceClassifier(model=settings.vlm_model)
            if clf.available:
                self._police = clf
                self._police_executor = ThreadPoolExecutor(
                    max_workers=1,
                    thread_name_prefix=f"LiveVLM-cam{camera_id}",
                )
            else:
                logger.warning(
                    "cam=%s vlm_police_enabled=True mas lib 'anthropic' não "
                    "disponível ou ANTHROPIC_API_KEY ausente — feature desligada.",
                    camera_id,
                )
        self._police_classified: set[int] = set()  # track_ids já classificados
        self._police_last_ts: float = 0.0

        self._latest_jpeg: bytes = _placeholder_jpeg("Abrindo fonte...")
        self._frame_lock = threading.Lock()

        self.stats = LiveStats(
            source=source,
            resolved_source=self._source_label,
            using_fallback_detector=self._detector.using_fallback,
        )

    # ---------------------------------------------------------------- API pública
    def latest_jpeg(self) -> bytes:
        with self._frame_lock:
            return self._latest_jpeg

    def stop(self) -> None:
        self.stop_event.set()

    # ---------------------------------------------------------------- persistência
    def _persist_count(self, vehicle_type: str) -> None:
        """Incrementa (ou cria) o bucket horário em traffic_summaries.

        Chamado uma única vez por track, no frame em que ele cruza a linha.
        Silencioso em caso de erro — falha no DB não pode parar o pipeline
        de vídeo.
        """
        if self.city_id is None:
            return
        now = datetime.utcnow()
        bucket = now.replace(minute=0, second=0, microsecond=0)

        # Campo correspondente dentro de TrafficSummary.
        # Bicycle/van caem em "others" — não queremos poluir as 4 colunas
        # principais com contagens residuais dessas classes. `person`
        # tem coluna própria (`pedestrians`) e fica fora do `total` de
        # veículos, que continua somando só carros/motos/ônibus/caminhões/outros.
        col_map = {
            "car": "cars",
            "motorcycle": "motorcycles",
            "bus": "buses",
            "truck": "trucks",
            "person": "pedestrians",
        }
        field_name = col_map.get(vehicle_type, "others")
        # Pedestre não entra no total (que representa "fluxo de veículos");
        # vai só pra coluna própria.
        is_pedestrian = field_name == "pedestrians"

        try:
            with session_scope() as s:
                existing = (
                    s.query(TrafficSummary)
                    .filter(
                        TrafficSummary.city_id == self.city_id,
                        TrafficSummary.camera_id == self.camera_id,
                        TrafficSummary.granularity == "hour",
                        TrafficSummary.bucket_start == bucket,
                        TrafficSummary.video_id.is_(None),
                    )
                    .first()
                )
                if existing:
                    if not is_pedestrian:
                        existing.total += 1
                    setattr(existing, field_name, getattr(existing, field_name) + 1)
                else:
                    summary = TrafficSummary(
                        city_id=self.city_id,
                        camera_id=self.camera_id,
                        video_id=None,
                        granularity="hour",
                        bucket_start=bucket,
                        total=0 if is_pedestrian else 1,
                        cars=1 if field_name == "cars" else 0,
                        motorcycles=1 if field_name == "motorcycles" else 0,
                        buses=1 if field_name == "buses" else 0,
                        trucks=1 if field_name == "trucks" else 0,
                        others=1 if field_name == "others" else 0,
                        pedestrians=1 if is_pedestrian else 0,
                    )
                    s.add(summary)
        except Exception as exc:  # pragma: no cover
            logger.warning(
                "cam=%s falha persistindo contagem (%s): %s",
                self.camera_id,
                vehicle_type,
                exc,
            )

    # ---------------------------------------------------------------- alertas
    def _persist_anomaly(self, ev: AnomalyEvent) -> None:
        """Cria um registro em `alerts` para o evento de anomalia.

        Propositalmente não deduplica no nível do banco — cada evento
        (WARNING quando passou o primeiro threshold, CRITICAL quando
        passou o segundo) é um fato novo pro operador. A prevenção de
        spam acontece dentro do `StoppedVehicleDetector` (1 warning +
        1 critical por track_id).
        """
        minutes = ev.stopped_for_s / 60.0
        if minutes >= 1.0:
            duration_str = f"{minutes:.1f} min"
        else:
            duration_str = f"{int(ev.stopped_for_s)}s"
        title = f"Veículo parado — {ev.vehicle_type}"
        message = (
            f"{ev.vehicle_type.capitalize()} parado na via há {duration_str} "
            f"(track #{ev.track_id}, posição ~{int(ev.cx)},{int(ev.cy)}). "
            f"Verifique a câmera ao vivo para identificar a causa "
            f"(incidente, pane, veículo estacionado indevidamente etc)."
        )
        level = AlertLevel.CRITICAL if ev.level == "critical" else AlertLevel.WARNING
        try:
            with session_scope() as s:
                alert = Alert(
                    city_id=self.city_id,
                    camera_id=self.camera_id,
                    level=level,
                    title=title,
                    message=message,
                    variation_pct=0.0,
                )
                s.add(alert)
            logger.info(
                "cam=%s anomaly-alert %s track=%d (%.1fs)",
                self.camera_id,
                ev.level,
                ev.track_id,
                ev.stopped_for_s,
            )
        except Exception as exc:  # pragma: no cover
            logger.warning(
                "cam=%s falha persistindo anomalia track=%d: %s",
                self.camera_id,
                ev.track_id,
                exc,
            )

    # ---------------------------------------------------------------- alerta pedestre
    def _persist_pedestrian_alert(self, ev: PedestrianEvent) -> None:
        """Cria Alert WARNING pra pessoa parada/andando na via.

        Severidade fixa WARNING por design — pedestre na pista é sempre
        incidente potencial; não escalamos pra CRITICAL porque o sistema
        não distingue "atravessando rápido" de "parado pedindo socorro".
        Cabe ao operador olhar a câmera.
        """
        seconds = ev.duration_s
        if seconds >= 60:
            duration_str = f"{seconds / 60:.1f} min"
        else:
            duration_str = f"{seconds:.1f}s"
        title = "Pedestre na via"
        message = (
            f"Pessoa detectada na faixa de risco há {duration_str} "
            f"(track #{ev.track_id}, posição ~{int(ev.cx)},{int(ev.cy)}). "
            f"Confira a câmera ao vivo — pedestre fora da calçada pode "
            f"indicar travessia indevida, queda, ou necessidade de assistência."
        )
        try:
            with session_scope() as s:
                alert = Alert(
                    city_id=self.city_id,
                    camera_id=self.camera_id,
                    level=AlertLevel.WARNING,
                    title=title,
                    message=message,
                    variation_pct=0.0,
                )
                s.add(alert)
            logger.info(
                "cam=%s pedestrian-alert track=%d (%.1fs)",
                self.camera_id,
                ev.track_id,
                ev.duration_s,
            )
        except Exception as exc:  # pragma: no cover
            logger.warning(
                "cam=%s falha persistindo alerta pedestre track=%d: %s",
                self.camera_id,
                ev.track_id,
                exc,
            )

    # ---------------------------------------------------------------- VLM viatura
    def _classify_and_alert(
        self,
        frame_bgr: np.ndarray,
        box: Tuple[float, float, float, float],
        track_id: int,
        vehicle_type: str,
    ) -> None:
        """Task rodado em thread separada. Classifica o recorte e, se
        positivo, persiste Alert INFO.

        Roda fora do loop principal — frame_bgr é uma cópia (vide chamada)
        e cv2 é thread-safe pra encoding. DB usa session_scope() próprio.
        Qualquer exceção fica contida aqui pra não derrubar o executor.
        """
        if self._police is None:
            return
        try:
            result: Optional[PoliceClassification] = self._police.classify_crop(
                frame_bgr, box
            )
        except Exception as exc:  # pragma: no cover
            logger.warning(
                "cam=%s classificador VLM falhou track=%d: %s",
                self.camera_id,
                track_id,
                exc,
            )
            return
        if result is None or not result.is_police:
            return

        agency = f" ({result.agency})" if result.agency else ""
        title = f"Viatura policial detectada{agency}"
        message = (
            f"Veículo (track #{track_id}, classe YOLO: {vehicle_type}) "
            f"classificado como viatura pelo Claude Vision. "
            f"Justificativa do modelo: {result.reasoning}"
        )
        try:
            with session_scope() as s:
                alert = Alert(
                    city_id=self.city_id,
                    camera_id=self.camera_id,
                    level=AlertLevel.INFO,
                    title=title,
                    message=message,
                    variation_pct=0.0,
                )
                s.add(alert)
            logger.info(
                "cam=%s police-detected track=%d agency=%s",
                self.camera_id,
                track_id,
                result.agency,
            )
        except Exception as exc:  # pragma: no cover
            logger.warning(
                "cam=%s falha persistindo alert viatura track=%d: %s",
                self.camera_id,
                track_id,
                exc,
            )

    # ---------------------------------------------------------------- thread main
    def run(self) -> None:  # pragma: no cover - loop de I/O
        self.stats.running = True
        self.stats.started_at = time.time()
        logger.info(
            "LiveStreamWorker cam=%s abrindo fonte %s",
            self.camera_id,
            self._source_label,
        )

        # `self.resolved_source` é int pra webcam (0, 1, ...) e str pra URL/arquivo.
        # O OpenCV se comporta de acordo — tipo errado aqui quebra silenciosamente
        # (VideoCapture("0") falha em abrir a webcam).
        cap = cv2.VideoCapture(self.resolved_source)
        # Reduz buffer interno do OpenCV para baixar latência.
        try:
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        except Exception:
            pass

        if not cap.isOpened():
            msg = f"Falha ao abrir fonte: {self._source_label}"
            logger.error("cam=%s %s", self.camera_id, msg)
            self.stats.error = msg
            self.stats.running = False
            with self._frame_lock:
                self._latest_jpeg = _placeholder_jpeg("Fonte indisponivel")
            return

        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or 1280
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or 720
        fps_declared = cap.get(cv2.CAP_PROP_FPS) or 25.0

        # iou_threshold 0.25 (mais permissivo que o padrão 0.3) reduz
        # fragmentação — carro que "pisca" por oclusão parcial não cria
        # track novo → não é recontado. max_miss = 1.5x fps dá ~1.5s de
        # tolerância a oclusão antes de desistir do track.
        self._tracker = IoUTracker(
            iou_threshold=0.25,
            max_miss=max(8, int(fps_declared * 1.5)),
        )

        # Linha virtual de contagem — horizontal a 55% da altura (mesma convenção do batch).
        counting_line: Tuple[Tuple[float, float], Tuple[float, float]] = (
            (0.0, height * 0.55),
            (float(width), height * 0.55),
        )

        stride = max(1, settings.live_frame_stride)
        frame_idx = 0
        last_active_tracks: List[Track] = []
        counted_ids: Dict[int, str] = {}  # track_id → vehicle_type
        t0 = time.time()
        read_failures = 0
        max_read_failures = 30  # ~1s de stream morto @ 30fps

        while not self.stop_event.is_set():
            ok, frame = cap.read()
            if not ok or frame is None:
                read_failures += 1
                if read_failures >= max_read_failures:
                    logger.warning(
                        "cam=%s fonte parou de entregar frames — encerrando worker",
                        self.camera_id,
                    )
                    self.stats.error = "fonte parou de entregar frames"
                    break
                time.sleep(0.05)
                continue
            read_failures = 0

            run_inference = frame_idx % stride == 0
            if run_inference:
                ts = (time.time() - t0)
                try:
                    detections = self._detector.detect(frame)
                except Exception as exc:  # pragma: no cover
                    logger.exception("cam=%s falha no detector: %s", self.camera_id, exc)
                    detections = []
                active = self._tracker.update(detections, frame_idx=frame_idx, timestamp=ts)
                for tr in active:
                    cross_line(tr, counting_line)
                    if tr.counted and tr.track_id not in counted_ids:
                        # Novo veículo contado → memória + banco
                        counted_ids[tr.track_id] = tr.vehicle_type
                        self._persist_count(tr.vehicle_type)

                # Fallback de "sobrevivência": tracks que o tracker
                # expirou (sumiram do frame por max_miss) sem terem
                # cruzado a linha virtual — se persistiram ≥0.5s com
                # deslocamento ≥30px, contabiliza assim mesmo. É o
                # mesmo critério do pipeline batch e resolve o caso
                # do veículo que atravessa sem cruzar a faixa
                # horizontal (ex.: trajetória quase paralela à linha,
                # caminhão grande que o tracker perde por oclusão
                # antes do centróide atingir 55% da altura).
                for tr in self._tracker.last_expired:
                    if tr.track_id in counted_ids or tr.counted:
                        continue
                    if (tr.last_ts - tr.first_ts) < 0.5:
                        continue
                    if len(tr.path) < 2:
                        continue
                    dx = tr.path[-1][0] - tr.path[0][0]
                    dy = tr.path[-1][1] - tr.path[0][1]
                    if (dx * dx + dy * dy) < 30 * 30:
                        continue
                    counted_ids[tr.track_id] = tr.vehicle_type
                    self._persist_count(tr.vehicle_type)
                    logger.info(
                        "cam=%s fallback-count track=%d tipo=%s (%.2fs, %.0fpx)",
                        self.camera_id,
                        tr.track_id,
                        tr.vehicle_type,
                        tr.last_ts - tr.first_ts,
                        (dx * dx + dy * dy) ** 0.5,
                    )

                # Detector de veículo parado: se um track não mexe há muito
                # tempo dentro da ROI, emite Alert (warning → critical). O
                # operador investiga pela câmera ao vivo — o sistema não
                # tenta classificar "é acidente".
                anomalies = self._anomaly.update(
                    active_tracks=active,
                    expired_tracks=self._tracker.last_expired,
                    frame_w=width,
                    frame_h=height,
                    ts=ts,
                )
                for ev in anomalies:
                    self._persist_anomaly(ev)

                # Pedestre na via: track de `person` que permanece na
                # faixa central do frame (a pista) por mais de
                # `pedestrian_min_duration_s`. Também emite Alert, mas é
                # fluxo independente do de veículo parado — condições,
                # duração e rate limit são próprios.
                if self._pedestrian_alert is not None:
                    ped_events = self._pedestrian_alert.update(
                        active_tracks=active,
                        expired_tracks=self._tracker.last_expired,
                        frame_w=width,
                        frame_h=height,
                        ts=ts,
                    )
                    for ev in ped_events:
                        self._persist_pedestrian_alert(ev)

                # Classificador de viatura (VLM, opcional). Rate-limited:
                # no máximo um track a cada `vlm_police_interval_s`. Escolhe
                # o candidato com maior bounding box (melhor crop) entre os
                # tracks car/truck com confiança alta que ainda não foram
                # classificados. A chamada remota vai pro ThreadPoolExecutor
                # pra não bloquear o loop — a resposta volta depois,
                # persiste como Alert INFO.
                if self._police is not None and self._police_executor is not None:
                    if (ts - self._police_last_ts) >= settings.vlm_police_interval_s:
                        candidates = [
                            tr
                            for tr in active
                            if tr.vehicle_type in ("car", "truck")
                            and tr.confidence >= settings.vlm_police_min_confidence
                            and tr.track_id not in self._police_classified
                        ]
                        if candidates:
                            tr = max(
                                candidates,
                                key=lambda t: (t.x2 - t.x1) * (t.y2 - t.y1),
                            )
                            self._police_classified.add(tr.track_id)
                            self._police_last_ts = ts
                            box = (tr.x1, tr.y1, tr.x2, tr.y2)
                            # frame.copy() é obrigatório — o loop vai
                            # sobrescrever o buffer original nos próximos
                            # read()s, e a task pode demorar segundos.
                            self._police_executor.submit(
                                self._classify_and_alert,
                                frame.copy(),
                                box,
                                tr.track_id,
                                tr.vehicle_type,
                            )

                last_active_tracks = active

            # Atualiza stats de contagem em qualquer frame (barato)
            by_type: Dict[str, int] = {}
            for vt in counted_ids.values():
                by_type[vt] = by_type.get(vt, 0) + 1
            self.stats.total_counted = len(counted_ids)
            self.stats.by_type = by_type

            annotated = _draw_overlay(
                frame.copy(),
                last_active_tracks,
                counting_line,
                live_count=self.stats.total_counted,
            )

            ok_enc, buf = cv2.imencode(
                ".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, self.jpeg_quality]
            )
            if ok_enc:
                with self._frame_lock:
                    self._latest_jpeg = buf.tobytes()
                self.stats.last_frame_at = time.time()

            frame_idx += 1
            self.stats.frames_processed = frame_idx

            # FPS suave (média móvel simples)
            elapsed = time.time() - t0
            if elapsed > 0:
                self.stats.fps_real = round(frame_idx / elapsed, 2)

        cap.release()
        # Executor de classificação VLM. wait=False pra não segurar o
        # encerramento do worker esperando uma chamada remota pendente —
        # o daemon=True das threads cuida de não vazar recurso no exit.
        if self._police_executor is not None:
            try:
                self._police_executor.shutdown(wait=False)
            except Exception:  # pragma: no cover
                pass
        self.stats.running = False
        logger.info(
            "LiveStreamWorker cam=%s encerrado (frames=%d, contados=%d, erro=%s)",
            self.camera_id,
            self.stats.frames_processed,
            self.stats.total_counted,
            self.stats.error,
        )


# --------------------------------------------------------------------------- manager
class LiveManager:
    """Singleton módulo-level indexando workers por camera_id."""

    def __init__(self) -> None:
        self._workers: Dict[int, LiveStreamWorker] = {}
        self._lock = threading.Lock()

    def start(
        self,
        camera_id: int,
        city_id: Optional[int],
        source: str,
        resolved_source: Union[str, int],
        source_label: Optional[str] = None,
    ) -> LiveStreamWorker:
        with self._lock:
            existing = self._workers.get(camera_id)
            if existing and existing.is_alive() and not existing.stop_event.is_set():
                raise RuntimeError(
                    f"stream já ativo para camera {camera_id}; pare antes de reiniciar"
                )
            worker = LiveStreamWorker(
                camera_id=camera_id,
                city_id=city_id,
                source=source,
                resolved_source=resolved_source,
                source_label=source_label,
            )
            self._workers[camera_id] = worker
            worker.start()
            return worker

    def stop(self, camera_id: int) -> bool:
        with self._lock:
            worker = self._workers.get(camera_id)
            if not worker:
                return False
            worker.stop()
        # Join fora do lock para não segurar quem vai querer consultar.
        worker.join(timeout=3.0)
        return True

    def get(self, camera_id: int) -> Optional[LiveStreamWorker]:
        with self._lock:
            return self._workers.get(camera_id)

    def list_active(self) -> List[LiveStreamWorker]:
        with self._lock:
            return [w for w in self._workers.values() if w.is_alive()]

    def stop_all(self) -> None:
        with self._lock:
            workers = list(self._workers.values())
        for w in workers:
            w.stop()
        for w in workers:
            w.join(timeout=2.0)


manager = LiveManager()
