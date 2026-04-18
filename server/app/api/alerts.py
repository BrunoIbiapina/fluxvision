"""Endpoints de alerts."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Alert
from ..schemas import AlertOut
from ..services import alerts_service

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


@router.get("", response_model=list[AlertOut])
def list_alerts(
    only_open: bool = True, limit: int = 50, db: Session = Depends(get_db)
) -> list[Alert]:
    q = db.query(Alert).order_by(Alert.created_at.desc())
    if only_open:
        q = q.filter(Alert.acknowledged == False)  # noqa: E712
    return q.limit(min(limit, 500)).all()


@router.post("/{alert_id}/ack", response_model=AlertOut)
def ack_alert(alert_id: int, db: Session = Depends(get_db)) -> Alert:
    a = db.get(Alert, alert_id)
    if not a:
        raise HTTPException(404, "alert not found")
    a.acknowledged = True
    db.commit()
    db.refresh(a)
    return a


@router.post("/detect", response_model=list[AlertOut])
def run_detection(db: Session = Depends(get_db)) -> list[Alert]:
    """Dispara a detecção de anomalias manualmente (agendar em produção)."""
    return alerts_service.detect_anomalies(db)
