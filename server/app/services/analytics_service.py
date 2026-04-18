"""Consultas agregadas que alimentam o dashboard.

Todo filtro é sobre TrafficSummary. Ranking e geo_points são por câmera —
a cidade é apenas agrupamento; quem carrega lat/lng e categoria é a câmera.
"""
from __future__ import annotations

import math
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from ..config import settings


def _display_tz() -> ZoneInfo:
    """ZoneInfo configurada, com fallback seguro pra UTC se o sistema
    não tiver tzdata (raro, mas possível em containers minimalistas)."""
    try:
        return ZoneInfo(settings.display_tz)
    except ZoneInfoNotFoundError:
        return ZoneInfo("UTC")

# Referência para a cor do mapa de calor. Convertemos o total acumulado
# na janela em uma "intensidade" 0..1 por escala logarítmica, não pela
# razão contra o máximo observado. Com normalização relativa, uma única
# câmera (max == total) vira sempre 1.0 → vermelho crítico, o que passa
# a impressão errada de pico mesmo com poucos veículos.
#
# Calibração aproximada para janela de 30 dias:
#   total=5     → ~0.17  (verde, baixo)
#   total=500   → ~0.57  (amarelo, alto)
#   total=5000  → ~0.79  (vermelho, crítico)
#   total=50000 → ~1.0   (vermelho, crítico)
_INTENSITY_SCALE = 50_000

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import Alert, Camera, City, TrafficSummary
from ..schemas import (
    ComparePayload,
    GeoPoint,
    Kpi,
    RankingRow,
    TimeseriesPoint,
)


# ---------------------------------------------------------------------------
def _date_range(days: int) -> Tuple[datetime, datetime]:
    now = datetime.utcnow().replace(minute=0, second=0, microsecond=0)
    start = now - timedelta(days=days)
    return start, now


def _bucket_rows(
    db: Session,
    granularity: str,
    start: datetime,
    end: datetime,
    city_id: Optional[int] = None,
    camera_id: Optional[int] = None,
) -> List[TrafficSummary]:
    q = (
        select(TrafficSummary)
        .where(TrafficSummary.granularity == granularity)
        .where(TrafficSummary.bucket_start >= start)
        .where(TrafficSummary.bucket_start <= end)
    )
    if city_id is not None:
        q = q.where(TrafficSummary.city_id == city_id)
    if camera_id is not None:
        q = q.where(TrafficSummary.camera_id == camera_id)
    return list(db.execute(q).scalars())


# ---------------------------------------------------------------------------
def compute_kpis(
    db: Session,
    days: int = 30,
    city_id: Optional[int] = None,
    camera_id: Optional[int] = None,
) -> Kpi:
    start, end = _date_range(days)
    rows = _bucket_rows(db, "hour", start, end, city_id=city_id, camera_id=camera_id)

    total = sum(r.total for r in rows)
    hours = max(1, len(rows))
    avg = total / hours if hours else 0

    # Horário de pico (hora do dia com maior soma), já em horário local.
    # Converte cada bucket_start (UTC) pro fuso de exibição antes de
    # agrupar por hora, senão 20h local vira 23h "UTC" na tela.
    # Só reportamos quando há dados de 3+ horas distintas — com 1 hora
    # isolada o "pico" coincide com a hora atual e passa a impressão
    # errada de insight histórico.
    tz = _display_tz()
    by_hour: Dict[int, int] = defaultdict(int)
    for r in rows:
        local_hour = r.bucket_start.replace(tzinfo=timezone.utc).astimezone(tz).hour
        by_hour[local_hour] += r.total
    peak_hour: Optional[str] = None
    peak_value = 0
    if len(by_hour) >= 3:
        peak_hour_i, peak_value = max(by_hour.items(), key=lambda x: x[1])
        peak_hour = f"{peak_hour_i:02d}:00"

    # Janela real de dados: primeiro e último bucket com contagem > 0.
    # Se não houver nada, ficam None — o front trata isso mostrando
    # "aguardando primeira captura".
    non_empty = [r.bucket_start for r in rows if r.total > 0]
    if non_empty:
        data_start_utc = min(non_empty).replace(tzinfo=timezone.utc)
        data_end_utc = max(non_empty).replace(tzinfo=timezone.utc)
        data_start = data_start_utc.astimezone(tz)
        data_end = data_end_utc.astimezone(tz)
    else:
        data_start = None
        data_end = None
    hours_with_data = len({r.bucket_start for r in rows if r.total > 0})

    # Variação vs. período anterior de mesmo tamanho
    prev_start = start - timedelta(days=days)
    prev_rows = _bucket_rows(db, "hour", prev_start, start, city_id=city_id, camera_id=camera_id)
    prev_total = sum(r.total for r in prev_rows)
    variation = 0.0
    if prev_total > 0:
        variation = round((total - prev_total) * 100 / prev_total, 2)

    unique_cameras = db.query(func.count(Camera.id.distinct())).scalar() or 0
    unique_cities = db.query(func.count(City.id.distinct())).scalar() or 0

    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today_rows = _bucket_rows(
        db, "hour", today, today + timedelta(days=1), city_id=city_id, camera_id=camera_id
    )
    unique_today = sum(r.total for r in today_rows)

    active_alerts = db.query(func.count(Alert.id)).filter(Alert.acknowledged == False).scalar() or 0  # noqa: E712

    return Kpi(
        total=total,
        avg_per_hour=round(avg, 1),
        peak_hour=peak_hour,
        peak_value=peak_value,
        variation_pct_vs_previous=variation,
        unique_cameras=int(unique_cameras),
        unique_cities=int(unique_cities),
        unique_vehicles_today=unique_today,
        active_alerts=active_alerts,
        data_start=data_start,
        data_end=data_end,
        hours_with_data=hours_with_data,
        timezone=settings.display_tz,
    )


# ---------------------------------------------------------------------------
def hourly_series(
    db: Session,
    days: int = 7,
    city_id: Optional[int] = None,
    camera_id: Optional[int] = None,
) -> List[TimeseriesPoint]:
    start, end = _date_range(days)
    rows = _bucket_rows(db, "hour", start, end, city_id=city_id, camera_id=camera_id)
    # Se várias câmeras bateram na mesma hora, somar pro gráfico.
    #
    # Chave ISO com sufixo "Z" (UTC) é essencial: o bucket_start do banco
    # é naïve (gravado via datetime.utcnow()), e `new Date()` no browser
    # interpreta ISO sem tz como horário LOCAL — o que fazia 23:00 UTC
    # (= 20:00 BR) aparecer como "23:00" na tela. Com "Z" explícito, o
    # JS converte corretamente pro fuso do usuário via toLocaleTimeString.
    agg: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for r in rows:
        key = r.bucket_start.replace(tzinfo=timezone.utc).isoformat()
        agg[key]["total"] += r.total
        agg[key]["cars"] += r.cars
        agg[key]["motorcycles"] += r.motorcycles
        agg[key]["buses"] += r.buses
        agg[key]["trucks"] += r.trucks
        agg[key]["others"] += r.others
        agg[key]["pedestrians"] += getattr(r, "pedestrians", 0) or 0
    return [
        TimeseriesPoint(
            bucket=k,
            total=agg[k]["total"],
            cars=agg[k]["cars"],
            motorcycles=agg[k]["motorcycles"],
            buses=agg[k]["buses"],
            trucks=agg[k]["trucks"],
            others=agg[k]["others"],
            pedestrians=agg[k]["pedestrians"],
        )
        for k in sorted(agg.keys())
    ]


def daily_series(
    db: Session,
    days: int = 30,
    city_id: Optional[int] = None,
    camera_id: Optional[int] = None,
) -> List[TimeseriesPoint]:
    start, end = _date_range(days)
    rows = _bucket_rows(db, "hour", start, end, city_id=city_id, camera_id=camera_id)
    # Agrega por "dia local" — bucket de 02:00 UTC é 23:00 do dia
    # anterior em BR; sem a conversão, o dia fica errado na virada.
    tz = _display_tz()
    agg: Dict[date, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for r in rows:
        d = r.bucket_start.replace(tzinfo=timezone.utc).astimezone(tz).date()
        agg[d]["total"] += r.total
        agg[d]["cars"] += r.cars
        agg[d]["motorcycles"] += r.motorcycles
        agg[d]["buses"] += r.buses
        agg[d]["trucks"] += r.trucks
        agg[d]["others"] += r.others
        agg[d]["pedestrians"] += getattr(r, "pedestrians", 0) or 0
    # Emitimos meio-dia local com offset explícito pra que `new Date(bucket)`
    # no browser caia garantidamente dentro do dia certo, independente do
    # fuso do usuário (date-only "2026-04-17" é parseado como UTC midnight
    # → fica um dia atrás em BR).
    return [
        TimeseriesPoint(
            bucket=datetime(d.year, d.month, d.day, 12, 0, tzinfo=tz).isoformat(),
            total=agg[d]["total"],
            cars=agg[d]["cars"],
            motorcycles=agg[d]["motorcycles"],
            buses=agg[d]["buses"],
            trucks=agg[d]["trucks"],
            others=agg[d]["others"],
            pedestrians=agg[d]["pedestrians"],
        )
        for d in sorted(agg.keys())
    ]


def monthly_series(
    db: Session,
    months: int = 12,
    city_id: Optional[int] = None,
    camera_id: Optional[int] = None,
) -> List[TimeseriesPoint]:
    end = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    start = end - timedelta(days=months * 31)
    rows = _bucket_rows(
        db, "hour", start, end + timedelta(days=31), city_id=city_id, camera_id=camera_id
    )
    agg: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for r in rows:
        key = r.bucket_start.strftime("%Y-%m")
        agg[key]["total"] += r.total
        agg[key]["cars"] += r.cars
        agg[key]["motorcycles"] += r.motorcycles
        agg[key]["buses"] += r.buses
        agg[key]["trucks"] += r.trucks
        agg[key]["others"] += r.others
        agg[key]["pedestrians"] += getattr(r, "pedestrians", 0) or 0
    return [
        TimeseriesPoint(
            bucket=key,
            total=agg[key]["total"],
            cars=agg[key]["cars"],
            motorcycles=agg[key]["motorcycles"],
            buses=agg[key]["buses"],
            trucks=agg[key]["trucks"],
            others=agg[key]["others"],
            pedestrians=agg[key]["pedestrians"],
        )
        for key in sorted(agg.keys())
    ]


# ---------------------------------------------------------------------------
def ranking(
    db: Session, days: int = 30, city_id: Optional[int] = None
) -> List[RankingRow]:
    """Ranking por câmera. Se `city_id` for passado, limita àquela cidade."""
    start, end = _date_range(days)
    prev_start = start - timedelta(days=days)

    totals: Dict[int, int] = defaultdict(int)
    for r in _bucket_rows(db, "hour", start, end, city_id=city_id):
        if r.camera_id is not None:
            totals[r.camera_id] += r.total

    prev_totals: Dict[int, int] = defaultdict(int)
    for r in _bucket_rows(db, "hour", prev_start, start, city_id=city_id):
        if r.camera_id is not None:
            prev_totals[r.camera_id] += r.total

    cams_q = db.query(Camera)
    if city_id is not None:
        cams_q = cams_q.filter(Camera.city_id == city_id)

    out: List[RankingRow] = []
    for cam in cams_q.all():
        t = totals.get(cam.id, 0)
        p = prev_totals.get(cam.id, 0)
        var = round((t - p) * 100 / p, 2) if p > 0 else 0.0
        city_name = cam.city.name if cam.city else ""
        out.append(
            RankingRow(
                camera_id=cam.id,
                camera_name=cam.name,
                city_id=cam.city_id,
                city_name=city_name,
                category=cam.category,
                total=t,
                variation_pct=var,
            )
        )
    out.sort(key=lambda x: x.total, reverse=True)
    return out


def geo_points(
    db: Session, days: int = 30, city_id: Optional[int] = None
) -> List[GeoPoint]:
    rows = ranking(db, days=days, city_id=city_id)
    out: List[GeoPoint] = []
    cams_q = db.query(Camera)
    if city_id is not None:
        cams_q = cams_q.filter(Camera.city_id == city_id)
    cam_map = {c.id: c for c in cams_q.all()}
    # Escala logarítmica absoluta (veja _INTENSITY_SCALE no topo). Não
    # dividimos por max_total porque isso fazia uma câmera sozinha virar
    # sempre 1.0 → crítico, independente do volume real de veículos.
    denom = math.log10(1 + _INTENSITY_SCALE)
    for r in rows:
        cam = cam_map.get(r.camera_id)
        if not cam:
            continue
        if r.total > 0:
            intensity = min(1.0, max(0.0, math.log10(1 + r.total) / denom))
        else:
            intensity = 0.0
        out.append(
            GeoPoint(
                camera_id=cam.id,
                camera_name=cam.name,
                city_id=cam.city_id,
                city_name=cam.city.name if cam.city else "",
                latitude=cam.latitude,
                longitude=cam.longitude,
                total=r.total,
                intensity=round(intensity, 3),
                category=cam.category,
            )
        )
    return out


# ---------------------------------------------------------------------------
def compare_periods(
    db: Session,
    granularity: str,
    start_a: datetime,
    end_a: datetime,
    start_b: datetime,
    end_b: datetime,
    city_id: Optional[int] = None,
    camera_id: Optional[int] = None,
) -> ComparePayload:
    rows_a = _bucket_rows(db, "hour", start_a, end_a, city_id=city_id, camera_id=camera_id)
    rows_b = _bucket_rows(db, "hour", start_b, end_b, city_id=city_id, camera_id=camera_id)

    def _aggregate(rows: List[TrafficSummary], gran: str) -> List[TimeseriesPoint]:
        agg: Dict[str, int] = defaultdict(int)
        for r in rows:
            if gran == "hour":
                key = r.bucket_start.strftime("%Y-%m-%dT%H:00")
            elif gran == "day":
                key = r.bucket_start.strftime("%Y-%m-%d")
            else:
                key = r.bucket_start.strftime("%Y-%m")
            agg[key] += r.total
        return [TimeseriesPoint(bucket=k, total=v) for k, v in sorted(agg.items())]

    series_a = _aggregate(rows_a, granularity)
    series_b = _aggregate(rows_b, granularity)
    total_a = sum(p.total for p in series_a)
    total_b = sum(p.total for p in series_b)
    var = 0.0
    if total_b > 0:
        var = round((total_a - total_b) * 100 / total_b, 2)

    return ComparePayload(
        label_a=f"{start_a.date()} → {end_a.date()}",
        label_b=f"{start_b.date()} → {end_b.date()}",
        series_a=series_a,
        series_b=series_b,
        total_a=total_a,
        total_b=total_b,
        variation_pct=var,
    )
