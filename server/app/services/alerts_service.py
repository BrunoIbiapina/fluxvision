"""Geração automática de alertas baseados em variação de fluxo."""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import List

from sqlalchemy.orm import Session

from ..config import settings
from ..models import Alert, AlertLevel, Camera, TrafficSummary


def detect_anomalies(db: Session) -> List[Alert]:
    """Cria alertas para câmeras cuja última hora divergiu do baseline.

    Baseline = média da mesma hora do dia nos últimos 14 dias para aquela
    câmera. Só gera alerta se houver pelo menos uma hora registrada no
    mesmo horário em semanas anteriores."""
    now = datetime.utcnow().replace(minute=0, second=0, microsecond=0)
    hour = now.hour
    baseline_start = now - timedelta(days=14)

    created: List[Alert] = []
    for cam in db.query(Camera).all():
        last_row = (
            db.query(TrafficSummary)
            .filter(
                TrafficSummary.camera_id == cam.id,
                TrafficSummary.granularity == "hour",
                TrafficSummary.bucket_start == now,
            )
            .first()
        )
        if not last_row:
            continue
        hist_rows = (
            db.query(TrafficSummary)
            .filter(
                TrafficSummary.camera_id == cam.id,
                TrafficSummary.granularity == "hour",
                TrafficSummary.bucket_start >= baseline_start,
                TrafficSummary.bucket_start < now,
            )
            .all()
        )
        peers = [r for r in hist_rows if r.bucket_start.hour == hour]
        if not peers:
            continue
        baseline = sum(r.total for r in peers) / len(peers)
        if baseline <= 0:
            continue
        var = (last_row.total - baseline) * 100 / baseline
        threshold = settings.anomaly_threshold_pct
        if abs(var) < threshold:
            continue

        level = AlertLevel.CRITICAL if abs(var) >= threshold * 2 else AlertLevel.WARNING
        label = f"{cam.name} ({cam.city.name})" if cam.city else cam.name
        title = f"Pico anormal em {label}" if var > 0 else f"Queda anormal em {label}"
        message = (
            f"Fluxo {('acima' if var > 0 else 'abaixo')} do esperado em "
            f"{abs(round(var,1))}% (obs: {last_row.total}, baseline: {baseline:.1f})."
        )
        alert = Alert(
            city_id=cam.city_id,
            camera_id=cam.id,
            level=level,
            title=title,
            message=message,
            variation_pct=round(var, 2),
        )
        db.add(alert)
        created.append(alert)

    db.commit()
    return created
