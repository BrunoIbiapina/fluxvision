"""Endpoints de streaming ao vivo (Nível 3 do roadmap).

Fluxo típico:
    POST /api/live/start                  → sobe worker (body: camera_id + source)
    GET  /api/live/{camera_id}/mjpeg      → <img src="..."> consome MJPEG
    GET  /api/live/{camera_id}            → polling JSON (contagens, fps)
    POST /api/live/{camera_id}/stop       → derruba o worker
    GET  /api/live                        → lista ativos

Sem persistência: se o uvicorn reinicia, é preciso re-iniciar o stream.
"""
from __future__ import annotations

import logging
import time
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Camera
from ..schemas import LiveStartRequest, LiveStatus
from ..utils.sources import resolve_stream_source
from ..vision.live import LiveStreamWorker, manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/live", tags=["live"])


def _worker_to_status(worker: LiveStreamWorker) -> LiveStatus:
    s = worker.stats
    return LiveStatus(
        camera_id=worker.camera_id,
        running=worker.is_alive() and s.running,
        source=s.source,
        resolved_source=s.resolved_source,
        fps_real=s.fps_real,
        frames_processed=s.frames_processed,
        total_counted=s.total_counted,
        by_type=s.by_type,
        uptime_s=s.uptime_s,
        error=s.error,
        using_fallback_detector=s.using_fallback_detector,
    )


@router.get("", response_model=List[LiveStatus])
def list_live() -> List[LiveStatus]:
    return [_worker_to_status(w) for w in manager.list_active()]


@router.post("/start", response_model=LiveStatus, status_code=201)
def start_live(body: LiveStartRequest, db: Session = Depends(get_db)) -> LiveStatus:
    # Resolve a câmera para obter o city_id — necessário para persistir
    # contagens no TrafficSummary vinculadas à mesma cidade que o dashboard lê.
    cam = db.get(Camera, body.camera_id)
    if not cam:
        raise HTTPException(404, "camera not found")

    try:
        resolved, label = resolve_stream_source(body.source)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    # `resolved` precisa chegar no worker NO TIPO certo — o OpenCV abre
    # a webcam só quando recebe `int` (VideoCapture(0)); se você manda
    # a string "0" ou "device:0", não abre nada. `label` é a versão
    # amigável pra exibir na API/logs (ex.: "webcam:0").
    try:
        worker = manager.start(
            camera_id=body.camera_id,
            city_id=cam.city_id,
            source=body.source,
            resolved_source=resolved,
            source_label=label,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc))

    # Dá uns ms pro worker setar started_at e tentar abrir a fonte
    time.sleep(0.15)
    return _worker_to_status(worker)


@router.get("/{camera_id}", response_model=LiveStatus)
def get_live(camera_id: int) -> LiveStatus:
    """Status do stream. Se não existir worker, devolve status 'idle' (em vez
    de 404) para o frontend poder dar polling sem poluir o log."""
    worker = manager.get(camera_id)
    if not worker:
        return LiveStatus(
            camera_id=camera_id,
            running=False,
            source="",
            resolved_source="",
            fps_real=0.0,
            frames_processed=0,
            total_counted=0,
            by_type={},
            uptime_s=0.0,
            error=None,
            using_fallback_detector=False,
        )
    return _worker_to_status(worker)


@router.post("/{camera_id}/stop", response_model=LiveStatus)
def stop_live(camera_id: int) -> LiveStatus:
    worker = manager.get(camera_id)
    if not worker:
        raise HTTPException(404, "stream não iniciado para esta câmera")
    manager.stop(camera_id)
    return _worker_to_status(worker)


@router.get("/{camera_id}/mjpeg")
def mjpeg_stream(camera_id: int) -> StreamingResponse:
    """Servir MJPEG (`multipart/x-mixed-replace`) para consumo via <img src>."""
    worker = manager.get(camera_id)
    if not worker:
        raise HTTPException(404, "stream não iniciado para esta câmera")

    boundary = "fluxvision-frame"

    def frame_generator():
        # Taxa alvo de entrega pro cliente — limita a 25 fps mesmo que a
        # captura seja maior, pra poupar banda.
        target_interval = 1.0 / 25.0
        last_sent = 0.0
        started = time.time()
        while True:
            # Encerra se o worker morreu e já entregamos pelo menos o placeholder
            # de erro, ou se passamos 3s esperando o primeiro frame sem sucesso.
            dead = not worker.is_alive()
            if dead and worker.stats.error and (time.time() - started) > 1.0:
                # manda um último frame com o placeholder de erro e sai
                jpeg = worker.latest_jpeg()
                if jpeg:
                    header = (
                        f"--{boundary}\r\n"
                        f"Content-Type: image/jpeg\r\n"
                        f"Content-Length: {len(jpeg)}\r\n\r\n"
                    ).encode("ascii")
                    yield header + jpeg + b"\r\n"
                break

            now = time.time()
            if now - last_sent < target_interval:
                time.sleep(max(0.0, target_interval - (now - last_sent)))
            jpeg = worker.latest_jpeg()
            if not jpeg:
                time.sleep(0.05)
                continue
            header = (
                f"--{boundary}\r\n"
                f"Content-Type: image/jpeg\r\n"
                f"Content-Length: {len(jpeg)}\r\n\r\n"
            ).encode("ascii")
            yield header + jpeg + b"\r\n"
            last_sent = time.time()

    return StreamingResponse(
        frame_generator(),
        media_type=f"multipart/x-mixed-replace; boundary={boundary}",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
