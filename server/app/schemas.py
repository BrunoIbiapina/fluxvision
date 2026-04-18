"""Contratos Pydantic — entradas e saídas da API."""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from .models import AlertLevel, PointCategory, VehicleType, VideoStatus


# ------------------------------------------------------------ City
class CityBase(BaseModel):
    name: str


class CityCreate(CityBase):
    pass


class CityUpdate(BaseModel):
    """Atualização parcial de City. Só os campos fornecidos são aplicados."""

    name: Optional[str] = None


class CityOut(CityBase):
    id: int
    created_at: datetime
    camera_count: int = 0

    model_config = ConfigDict(from_attributes=True)


# ------------------------------------------------------------ Camera
class CameraBase(BaseModel):
    name: str
    city_id: int
    latitude: float
    longitude: float
    district: Optional[str] = None
    category: PointCategory = PointCategory.AVENUE
    notes: Optional[str] = None
    stream_url: Optional[str] = None
    active: bool = True


class CameraCreate(CameraBase):
    pass


class CameraUpdate(BaseModel):
    """Atualização parcial de Camera. Todos os campos opcionais; só os
    fornecidos são aplicados."""

    name: Optional[str] = None
    city_id: Optional[int] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    district: Optional[str] = None
    category: Optional[PointCategory] = None
    notes: Optional[str] = None
    stream_url: Optional[str] = None
    active: Optional[bool] = None


class CameraOut(CameraBase):
    id: int
    created_at: datetime
    city_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# ------------------------------------------------------------ Video
class VideoOut(BaseModel):
    id: int
    camera_id: int
    filename: str
    status: VideoStatus
    duration_s: float
    width: int
    height: int
    fps: float
    recorded_at: datetime
    processed_at: Optional[datetime] = None
    heatmap_path: Optional[str] = None
    annotated_path: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class VideoProcessResult(BaseModel):
    video_id: int
    total_vehicles: int
    by_type: dict[str, int]
    duration_s: float
    heatmap_url: Optional[str] = None
    annotated_url: Optional[str] = None


# ------------------------------------------------------------ Analytics
class Kpi(BaseModel):
    total: int
    avg_per_hour: float
    peak_hour: Optional[str] = None   # "HH:00" em horário local
    peak_value: int = 0
    variation_pct_vs_previous: float = 0.0
    unique_cameras: int = 0
    unique_cities: int = 0
    unique_vehicles_today: int = 0
    active_alerts: int = 0
    # Janela real de dados (primeiro e último bucket com contagem > 0).
    # Permite o front mostrar "dados de X até Y" em vez de prometer um
    # recorte de 30 dias que na prática tem só 1h de captura.
    data_start: Optional[datetime] = None
    data_end: Optional[datetime] = None
    hours_with_data: int = 0
    timezone: str = "UTC"


class TimeseriesPoint(BaseModel):
    bucket: str  # ISO-ish timestamp
    total: int  # fluxo de veículos — não soma pedestres
    cars: int = 0
    motorcycles: int = 0
    buses: int = 0
    trucks: int = 0
    others: int = 0
    pedestrians: int = 0  # categoria paralela, fora de `total`


class ComparePayload(BaseModel):
    label_a: str
    label_b: str
    series_a: List[TimeseriesPoint]
    series_b: List[TimeseriesPoint]
    total_a: int
    total_b: int
    variation_pct: float


class RankingRow(BaseModel):
    """Ranking por câmera — cada câmera é um ponto de análise próprio."""

    camera_id: int
    camera_name: str
    city_id: int
    city_name: str
    category: PointCategory
    total: int
    variation_pct: float


class GeoPoint(BaseModel):
    """Ponto do mapa — uma câmera (lat/lng vêm dela)."""

    camera_id: int
    camera_name: str
    city_id: int
    city_name: str
    latitude: float
    longitude: float
    total: int
    intensity: float = Field(ge=0, le=1)
    category: PointCategory


# ------------------------------------------------------------ Live Stream
class LiveStartRequest(BaseModel):
    camera_id: int
    source: str  # URL YouTube/RTSP/HLS ou "0" para webcam


class LiveStatus(BaseModel):
    camera_id: int
    running: bool
    source: str
    resolved_source: str
    fps_real: float
    frames_processed: int
    total_counted: int
    by_type: dict[str, int]
    uptime_s: float
    error: Optional[str] = None
    using_fallback_detector: bool


# ------------------------------------------------------------ Alerts
class AlertOut(BaseModel):
    id: int
    level: AlertLevel
    title: str
    message: str
    variation_pct: float
    city_id: Optional[int] = None
    camera_id: Optional[int] = None
    created_at: datetime
    acknowledged: bool

    model_config = ConfigDict(from_attributes=True)
