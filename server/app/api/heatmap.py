"""Endpoints relacionados ao heatmap."""
from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Video

router = APIRouter(prefix="/api/heatmap", tags=["heatmap"])


@router.get("/{video_id}")
def get_heatmap(video_id: int, db: Session = Depends(get_db)) -> FileResponse:
    v = db.get(Video, video_id)
    if not v:
        raise HTTPException(404, "video not found")
    if not v.heatmap_path:
        raise HTTPException(404, "heatmap ainda não gerado")
    p = Path(v.heatmap_path)
    if not p.exists():
        raise HTTPException(404, "arquivo heatmap inexistente")
    return FileResponse(p, media_type="image/png")
