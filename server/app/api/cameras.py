"""Endpoints de Cameras — cada câmera é um ponto georreferenciado
vinculado a uma cidade, com URL de stream opcional (RTSP/HLS/YouTube).
Todo dashboard/heatmap/mapa é construído a partir dos vídeos e da live
dessa câmera."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Camera, City
from ..schemas import CameraCreate, CameraOut, CameraUpdate

router = APIRouter(prefix="/api/cameras", tags=["cameras"])


def _to_out(cam: Camera) -> CameraOut:
    return CameraOut(
        id=cam.id,
        name=cam.name,
        city_id=cam.city_id,
        latitude=cam.latitude,
        longitude=cam.longitude,
        district=cam.district,
        category=cam.category,
        notes=cam.notes,
        stream_url=cam.stream_url,
        active=cam.active,
        created_at=cam.created_at,
        city_name=cam.city.name if cam.city else None,
    )


@router.get("", response_model=list[CameraOut])
def list_cameras(db: Session = Depends(get_db)) -> list[CameraOut]:
    cams = db.query(Camera).order_by(Camera.name).all()
    return [_to_out(c) for c in cams]


@router.post("", response_model=CameraOut, status_code=201)
def create_camera(payload: CameraCreate, db: Session = Depends(get_db)) -> CameraOut:
    if not db.get(City, payload.city_id):
        raise HTTPException(404, "city not found")
    cam = Camera(**payload.model_dump())
    db.add(cam)
    db.commit()
    db.refresh(cam)
    return _to_out(cam)


@router.get("/{camera_id}", response_model=CameraOut)
def get_camera(camera_id: int, db: Session = Depends(get_db)) -> CameraOut:
    cam = db.get(Camera, camera_id)
    if not cam:
        raise HTTPException(404, "camera not found")
    return _to_out(cam)


@router.patch("/{camera_id}", response_model=CameraOut)
def update_camera(
    camera_id: int, payload: CameraUpdate, db: Session = Depends(get_db)
) -> CameraOut:
    """Atualização parcial — usado pela página /live para salvar a URL
    padrão (`stream_url`) após validar que o stream abre, e pela página
    /cameras para editar coordenadas, categoria etc."""
    cam = db.get(Camera, camera_id)
    if not cam:
        raise HTTPException(404, "camera not found")

    updates = payload.model_dump(exclude_unset=True)
    if "city_id" in updates and not db.get(City, updates["city_id"]):
        raise HTTPException(404, "city not found")

    for field, value in updates.items():
        setattr(cam, field, value)
    db.commit()
    db.refresh(cam)
    return _to_out(cam)


@router.delete("/{camera_id}", status_code=204, response_class=Response)
def delete_camera(camera_id: int, db: Session = Depends(get_db)) -> Response:
    cam = db.get(Camera, camera_id)
    if not cam:
        raise HTTPException(404, "camera not found")
    db.delete(cam)
    db.commit()
    return Response(status_code=204)
