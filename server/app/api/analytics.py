"""Endpoints de analytics — alimentam o dashboard."""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..db import get_db
from ..schemas import ComparePayload, GeoPoint, Kpi, RankingRow, TimeseriesPoint
from ..services import analytics_service as svc

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/summary", response_model=Kpi)
def summary(
    days: int = Query(30, ge=1, le=365),
    city_id: Optional[int] = None,
    camera_id: Optional[int] = None,
    db: Session = Depends(get_db),
) -> Kpi:
    return svc.compute_kpis(db, days=days, city_id=city_id, camera_id=camera_id)


@router.get("/hourly", response_model=list[TimeseriesPoint])
def hourly(
    days: int = Query(7, ge=1, le=60),
    city_id: Optional[int] = None,
    camera_id: Optional[int] = None,
    db: Session = Depends(get_db),
) -> list[TimeseriesPoint]:
    return svc.hourly_series(db, days=days, city_id=city_id, camera_id=camera_id)


@router.get("/daily", response_model=list[TimeseriesPoint])
def daily(
    days: int = Query(30, ge=1, le=365),
    city_id: Optional[int] = None,
    camera_id: Optional[int] = None,
    db: Session = Depends(get_db),
) -> list[TimeseriesPoint]:
    return svc.daily_series(db, days=days, city_id=city_id, camera_id=camera_id)


@router.get("/monthly", response_model=list[TimeseriesPoint])
def monthly(
    months: int = Query(12, ge=1, le=36),
    city_id: Optional[int] = None,
    camera_id: Optional[int] = None,
    db: Session = Depends(get_db),
) -> list[TimeseriesPoint]:
    return svc.monthly_series(db, months=months, city_id=city_id, camera_id=camera_id)


@router.get("/ranking", response_model=list[RankingRow])
def ranking(
    days: int = Query(30, ge=1, le=365),
    city_id: Optional[int] = None,
    db: Session = Depends(get_db),
) -> list[RankingRow]:
    return svc.ranking(db, days=days, city_id=city_id)


@router.get("/geo", response_model=list[GeoPoint])
def geo(
    days: int = Query(30, ge=1, le=365),
    city_id: Optional[int] = None,
    db: Session = Depends(get_db),
) -> list[GeoPoint]:
    return svc.geo_points(db, days=days, city_id=city_id)


@router.get("/compare", response_model=ComparePayload)
def compare(
    start_a: datetime,
    end_a: datetime,
    start_b: datetime,
    end_b: datetime,
    granularity: str = Query("day", pattern="^(hour|day|month)$"),
    city_id: Optional[int] = None,
    camera_id: Optional[int] = None,
    db: Session = Depends(get_db),
) -> ComparePayload:
    if end_a < start_a or end_b < start_b:
        raise HTTPException(400, "intervalos inválidos")
    return svc.compare_periods(
        db,
        granularity=granularity,
        start_a=start_a,
        end_a=end_a,
        start_b=start_b,
        end_b=end_b,
        city_id=city_id,
        camera_id=camera_id,
    )
