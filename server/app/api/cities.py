"""Endpoints de Cities — agrupador de câmeras por cidade."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Camera, City
from ..schemas import CityCreate, CityOut, CityUpdate

router = APIRouter(prefix="/api/cities", tags=["cities"])


def _to_out(city: City, camera_count: int) -> CityOut:
    return CityOut(
        id=city.id,
        name=city.name,
        created_at=city.created_at,
        camera_count=camera_count,
    )


@router.get("", response_model=list[CityOut])
def list_cities(db: Session = Depends(get_db)) -> list[CityOut]:
    rows = (
        db.query(City, func.count(Camera.id))
        .outerjoin(Camera, Camera.city_id == City.id)
        .group_by(City.id)
        .order_by(City.name)
        .all()
    )
    return [_to_out(city, int(count or 0)) for city, count in rows]


@router.post("", response_model=CityOut, status_code=201)
def create_city(payload: CityCreate, db: Session = Depends(get_db)) -> CityOut:
    name = payload.name.strip()
    if not name:
        raise HTTPException(400, "name is required")
    if db.query(City).filter(City.name == name).first():
        raise HTTPException(409, "já existe uma cidade com esse nome")
    city = City(name=name)
    db.add(city)
    db.commit()
    db.refresh(city)
    return _to_out(city, 0)


@router.get("/{city_id}", response_model=CityOut)
def get_city(city_id: int, db: Session = Depends(get_db)) -> CityOut:
    city = db.get(City, city_id)
    if not city:
        raise HTTPException(404, "city not found")
    count = db.query(func.count(Camera.id)).filter(Camera.city_id == city_id).scalar() or 0
    return _to_out(city, int(count))


@router.patch("/{city_id}", response_model=CityOut)
def update_city(
    city_id: int, payload: CityUpdate, db: Session = Depends(get_db)
) -> CityOut:
    city = db.get(City, city_id)
    if not city:
        raise HTTPException(404, "city not found")
    updates = payload.model_dump(exclude_unset=True)
    if "name" in updates:
        new_name = updates["name"].strip()
        if not new_name:
            raise HTTPException(400, "name is required")
        clash = (
            db.query(City).filter(City.name == new_name, City.id != city_id).first()
        )
        if clash:
            raise HTTPException(409, "já existe uma cidade com esse nome")
        city.name = new_name
    db.commit()
    db.refresh(city)
    count = db.query(func.count(Camera.id)).filter(Camera.city_id == city_id).scalar() or 0
    return _to_out(city, int(count))


@router.delete("/{city_id}", status_code=204, response_class=Response)
def delete_city(city_id: int, db: Session = Depends(get_db)) -> Response:
    city = db.get(City, city_id)
    if not city:
        raise HTTPException(404, "city not found")
    db.delete(city)
    db.commit()
    return Response(status_code=204)
