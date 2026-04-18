"""Modelos ORM — entidades do domínio FluxVision.

Hierarquia:
    City 1─N Camera 1─N Video 1─N Detection
                         │
                         └─N TrafficSummary  (granularidade: hour/day/month)
                         └─1 HeatmapAsset

A cidade é apenas um agrupador (nome). A câmera concentra os dados espaciais
(latitude, longitude, categoria, distrito) e é onde a URL do stream vive.
Toda análise (dashboard, heatmap, mapa) nasce dos vídeos/live vinculados à
câmera; o banco começa vazio.

Alerts e Events podem referenciar Camera e/ou City.
"""
from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import (
    JSON,
    Column,
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


# --------------------------------------------------------------------- enums
class VehicleType(str, enum.Enum):
    CAR = "car"
    MOTORCYCLE = "motorcycle"
    BUS = "bus"
    TRUCK = "truck"
    BICYCLE = "bicycle"
    VAN = "van"
    # PERSON é o único "não-veículo" no enum — tratar pedestre como uma
    # categoria do tráfego era mais barato que criar uma tabela paralela
    # só pra isso. Contagem vai pra coluna `pedestrians` do TrafficSummary
    # (fora do total de veículos) e é agregada separadamente no dashboard.
    PERSON = "person"
    OTHER = "other"


class VideoStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    DONE = "done"
    FAILED = "failed"


class AlertLevel(str, enum.Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class PointCategory(str, enum.Enum):
    AVENUE = "avenue"
    CROSSING = "crossing"
    HIGHWAY = "highway"
    EVENT_GATE = "event_gate"
    SQUARE = "square"
    PARKING = "parking"
    OTHER = "other"


# --------------------------------------------------------------------- tabelas
class City(Base):
    """Agrupa câmeras de uma mesma cidade. Só um rótulo — não tem coordenadas.

    As coordenadas (e distrito/categoria) ficam na câmera, porque são elas
    que aparecem no mapa e no heatmap.
    """

    __tablename__ = "cities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False, unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    cameras: Mapped[list["Camera"]] = relationship(
        back_populates="city", cascade="all, delete-orphan"
    )


class Camera(Base):
    """Ponto físico de captura. É quem carrega lat/lng, distrito, categoria
    e a URL do stream (RTSP/HLS/YouTube/0 para webcam)."""

    __tablename__ = "cameras"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    city_id: Mapped[int] = mapped_column(ForeignKey("cities.id"), nullable=False)

    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    district: Mapped[str] = mapped_column(String(80), nullable=True)
    category: Mapped[PointCategory] = mapped_column(
        Enum(PointCategory), default=PointCategory.AVENUE
    )
    notes: Mapped[str] = mapped_column(Text, nullable=True)

    stream_url: Mapped[str] = mapped_column(String(500), nullable=True)
    active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    city: Mapped["City"] = relationship(back_populates="cameras")
    videos: Mapped[list["Video"]] = relationship(
        back_populates="camera", cascade="all, delete-orphan"
    )


class Video(Base):
    __tablename__ = "videos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    camera_id: Mapped[int] = mapped_column(ForeignKey("cameras.id"), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    filepath: Mapped[str] = mapped_column(String(500), nullable=False)
    status: Mapped[VideoStatus] = mapped_column(Enum(VideoStatus), default=VideoStatus.PENDING)
    duration_s: Mapped[float] = mapped_column(Float, default=0.0)
    width: Mapped[int] = mapped_column(Integer, default=0)
    height: Mapped[int] = mapped_column(Integer, default=0)
    fps: Mapped[float] = mapped_column(Float, default=0.0)
    recorded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    processed_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    error: Mapped[str] = mapped_column(Text, nullable=True)
    heatmap_path: Mapped[str] = mapped_column(String(500), nullable=True)
    annotated_path: Mapped[str] = mapped_column(String(500), nullable=True)

    camera: Mapped["Camera"] = relationship(back_populates="videos")
    detections: Mapped[list["Detection"]] = relationship(
        back_populates="video", cascade="all, delete-orphan"
    )
    summaries: Mapped[list["TrafficSummary"]] = relationship(
        back_populates="video", cascade="all, delete-orphan"
    )


class Detection(Base):
    """Uma linha por veículo único contado em um vídeo (após tracking)."""

    __tablename__ = "detections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    video_id: Mapped[int] = mapped_column(ForeignKey("videos.id"), nullable=False)
    camera_id: Mapped[int] = mapped_column(ForeignKey("cameras.id"), nullable=False)
    track_id: Mapped[int] = mapped_column(Integer, nullable=False)
    vehicle_type: Mapped[VehicleType] = mapped_column(Enum(VehicleType), default=VehicleType.CAR)
    direction: Mapped[str] = mapped_column(String(16), nullable=True)  # "in" | "out" | "unknown"
    first_seen: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    last_seen: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, default=0.0)

    video: Mapped["Video"] = relationship(back_populates="detections")


class TrafficSummary(Base):
    """Agregação já computada. Granularidade = hour / day / month.

    Evita scans caros em detections para dashboards. Uma linha pode vir de
    um vídeo processado (video_id preenchido) ou de uma janela de live
    (video_id nulo — a câmera identifica a origem).
    """

    __tablename__ = "traffic_summaries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    city_id: Mapped[int] = mapped_column(ForeignKey("cities.id"), nullable=False)
    camera_id: Mapped[int] = mapped_column(ForeignKey("cameras.id"), nullable=True)
    video_id: Mapped[int] = mapped_column(ForeignKey("videos.id"), nullable=True)
    granularity: Mapped[str] = mapped_column(String(10), nullable=False)  # hour | day | month
    bucket_start: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    total: Mapped[int] = mapped_column(Integer, default=0)
    cars: Mapped[int] = mapped_column(Integer, default=0)
    motorcycles: Mapped[int] = mapped_column(Integer, default=0)
    buses: Mapped[int] = mapped_column(Integer, default=0)
    trucks: Mapped[int] = mapped_column(Integer, default=0)
    others: Mapped[int] = mapped_column(Integer, default=0)
    # Pedestres contados separadamente — ficam *fora* de `total` (que só
    # soma veículos). Útil pra dashboard mostrar pedestre como métrica
    # paralela sem inflar "fluxo total de veículos".
    pedestrians: Mapped[int] = mapped_column(Integer, default=0)

    video: Mapped["Video"] = relationship(back_populates="summaries")


class HeatmapAsset(Base):
    """Imagem de heatmap persistida por vídeo ou por agregação."""

    __tablename__ = "heatmaps"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    video_id: Mapped[int] = mapped_column(ForeignKey("videos.id"), nullable=True)
    camera_id: Mapped[int] = mapped_column(ForeignKey("cameras.id"), nullable=True)
    city_id: Mapped[int] = mapped_column(ForeignKey("cities.id"), nullable=True)
    path: Mapped[str] = mapped_column(String(500), nullable=False)
    generated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    city_id: Mapped[int] = mapped_column(ForeignKey("cities.id"), nullable=True)
    camera_id: Mapped[int] = mapped_column(ForeignKey("cameras.id"), nullable=True)
    level: Mapped[AlertLevel] = mapped_column(Enum(AlertLevel), default=AlertLevel.WARNING)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    variation_pct: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    acknowledged: Mapped[bool] = mapped_column(default=False)


class Event(Base):
    """Evento conhecido que pode ter influenciado o fluxo (show, jogo, feriado)."""

    __tablename__ = "events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    starts_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    ends_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    city_id: Mapped[int] = mapped_column(ForeignKey("cities.id"), nullable=True)
    camera_id: Mapped[int] = mapped_column(ForeignKey("cameras.id"), nullable=True)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)
