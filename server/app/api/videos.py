"""Upload e processamento de vídeos."""
from __future__ import annotations

import shutil
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..models import Camera, Video, VideoStatus
from ..schemas import VideoOut, VideoProcessResult
from ..vision.pipeline import VideoPipeline

router = APIRouter(prefix="/api/videos", tags=["videos"])


def _process_video(video_id: int) -> None:
    """Task em background."""
    try:
        VideoPipeline().run(video_id)
    except Exception as exc:  # pragma: no cover
        # A pipeline já marca FAILED no banco em caso de erro crítico.
        import logging

        logging.getLogger(__name__).exception("Falha processando video %s: %s", video_id, exc)


@router.get("", response_model=list[VideoOut])
def list_videos(db: Session = Depends(get_db), limit: int = 50) -> list[Video]:
    return (
        db.query(Video)
        .order_by(Video.recorded_at.desc())
        .limit(min(limit, 500))
        .all()
    )


@router.get("/{video_id}", response_model=VideoOut)
def get_video(video_id: int, db: Session = Depends(get_db)) -> Video:
    v = db.get(Video, video_id)
    if not v:
        raise HTTPException(404, "video not found")
    return v


@router.post("/upload", response_model=VideoOut, status_code=202)
async def upload_video(
    background: BackgroundTasks,
    camera_id: int = Form(...),
    recorded_at: Optional[str] = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> Video:
    """Recebe um vídeo, salva em disco e agenda processamento."""
    cam = db.get(Camera, camera_id)
    if not cam:
        raise HTTPException(404, "camera not found")

    ext = Path(file.filename or "upload.mp4").suffix or ".mp4"
    uid = uuid.uuid4().hex
    target = settings.upload_dir / f"cam{camera_id}_{uid}{ext}"
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("wb") as out:
        shutil.copyfileobj(file.file, out)

    rec_at = datetime.utcnow()
    if recorded_at:
        try:
            rec_at = datetime.fromisoformat(recorded_at.replace("Z", "+00:00"))
        except ValueError:
            raise HTTPException(400, "recorded_at inválido (use ISO-8601)")

    video = Video(
        camera_id=camera_id,
        filename=file.filename or target.name,
        filepath=str(target),
        status=VideoStatus.PENDING,
        recorded_at=rec_at,
    )
    db.add(video)
    db.commit()
    db.refresh(video)

    background.add_task(_process_video, video.id)
    return video


@router.post("/{video_id}/reprocess", response_model=VideoOut)
def reprocess_video(
    video_id: int, background: BackgroundTasks, db: Session = Depends(get_db)
) -> Video:
    v = db.get(Video, video_id)
    if not v:
        raise HTTPException(404, "video not found")
    v.status = VideoStatus.PENDING
    v.error = None
    db.commit()
    db.refresh(v)
    background.add_task(_process_video, v.id)
    return v


@router.get("/{video_id}/result", response_model=VideoProcessResult)
def video_result(video_id: int, db: Session = Depends(get_db)) -> VideoProcessResult:
    v = db.get(Video, video_id)
    if not v:
        raise HTTPException(404, "video not found")
    total = len(v.detections)
    by_type: dict[str, int] = {}
    for d in v.detections:
        by_type[d.vehicle_type.value] = by_type.get(d.vehicle_type.value, 0) + 1
    return VideoProcessResult(
        video_id=v.id,
        total_vehicles=total,
        by_type=by_type,
        duration_s=v.duration_s,
        heatmap_url=f"/api/heatmap/{v.id}" if v.heatmap_path else None,
        annotated_url=f"/api/videos/{v.id}/annotated" if v.annotated_path else None,
    )


@router.get("/{video_id}/annotated")
def get_annotated_video(video_id: int, db: Session = Depends(get_db)) -> FileResponse:
    """Serve o MP4 com as bounding boxes já desenhadas."""
    v = db.get(Video, video_id)
    if not v:
        raise HTTPException(404, "video not found")
    if not v.annotated_path:
        raise HTTPException(404, "vídeo anotado ainda não gerado")
    p = Path(v.annotated_path)
    if not p.exists():
        raise HTTPException(404, "arquivo anotado inexistente")
    return FileResponse(p, media_type="video/mp4", filename=p.name)
