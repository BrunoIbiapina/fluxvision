"""Configurações centralizadas (pydantic-settings)."""
from __future__ import annotations

from pathlib import Path
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuração lida de variáveis de ambiente / .env."""

    model_config = SettingsConfigDict(
        env_prefix="FLUXVISION_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ---------- core ----------
    app_name: str = "FluxVision API"
    env: str = "dev"

    # ---------- persistência ----------
    db_url: str = "sqlite:///./data/fluxvision.db"
    upload_dir: Path = Path("./data/uploads")
    heatmap_dir: Path = Path("./data/heatmaps")
    annotated_dir: Path = Path("./data/annotated")

    # ---------- CORS ----------
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    # ---------- visão computacional ----------
    # Pode ser qualquer peso suportado pelo Ultralytics — YOLO (v8/v9/v10/v11)
    # ou RT-DETR. O `VehicleDetector` detecta a arquitetura pelo prefixo:
    # "rtdetr*" carrega a classe RTDETR, qualquer outra coisa vira YOLO.
    #
    # Default: YOLOv8n — peso conhecido, rápido em CPU, bem calibrado pra
    # tráfego urbano típico. Upgrades disponíveis (drop-in via env var):
    #   - "yolo11n.pt": mesmo custo, 2-3% mais acurácia no COCO.
    #   - "yolo11s.pt" / "yolo11m.pt": mais acurado, mais lento.
    #   - "rtdetr-l.pt": transformer, melhor em oclusão pesada (pedágio,
    #     cruzamento congestionado). ~1.5-2x mais lento — só vale se o
    #     cenário tem oclusão frequente.
    # Primeira execução baixa o peso da CDN da Ultralytics.
    yolo_model: str = "yolov8n.pt"
    frame_stride: int = 3
    # Para streams ao vivo a inferência roda a cada N frames; entre essas, o
    # overlay é redesenhado com as últimas tracks. Stride mais alto = menos CPU.
    live_frame_stride: int = 2
    live_jpeg_quality: int = 78
    # 0.45 corta a cauda de detecções duvidosas (pedestres marcados como moto,
    # sombras interpretadas como carro). Se estiver perdendo carros reais em
    # cena muito escura, baixa para 0.40.
    conf_threshold: float = 0.45

    # ---------- regras de negócio ----------
    anomaly_threshold_pct: float = 40.0
    seed_on_start: bool = True
    # Fuso horário usado pra exibir KPIs (ex.: "horário de pico 20h").
    # O banco guarda tudo em UTC; a conversão é na borda de saída.
    display_tz: str = "America/Sao_Paulo"

    # ---------- detector de veículo parado ----------
    # Distância máxima (px) pra considerar um track "ainda parado" em
    # relação à âncora. ~20px tolera jitter de detecção do YOLO.
    stopped_px: float = 20.0
    # Tempo parado pra emitir Alert WARNING. Acima do ciclo típico de
    # semáforo (>=20s) pra evitar falso positivo de farol.
    stopped_warn_s: float = 25.0
    # Tempo parado pra escalar o mesmo track pra CRITICAL.
    stopped_critical_s: float = 75.0

    # ---------- detector de pedestre na via ----------
    # Emite Alert WARNING quando uma pessoa permanece dentro da faixa
    # vertical de risco (centro do frame, onde fica a pista). Rate-limited:
    # no máximo um alerta a cada `pedestrian_alert_interval_s` por câmera.
    pedestrian_alert_enabled: bool = True
    # Fração vertical que delimita a "faixa de risco". Valores default
    # (0.35..0.75) cobrem o miolo do frame, que em câmeras de tráfego típicas
    # corresponde à pista. Ajuste por câmera depois se houver ROI fina.
    pedestrian_risk_zone_top_frac: float = 0.35
    pedestrian_risk_zone_bottom_frac: float = 0.75
    # Tempo mínimo dentro da zona pra disparar Alert. Evita falso positivo
    # de pedestre que só "beira" a via (passa pela calçada e ponto).
    pedestrian_min_duration_s: float = 1.5
    # Intervalo mínimo entre alertas de pedestre por câmera (anti-spam
    # global — não por track).
    pedestrian_alert_interval_s: float = 20.0

    # ---------- classificador de viatura policial (VLM) ----------
    # Quando true, envia recortes de veículos pro Claude Vision pra
    # classificar se é viatura. Gera Alert INFO quando detecta. Desligado
    # por padrão porque tem custo operacional por chamada.
    vlm_police_enabled: bool = False
    vlm_model: str = "claude-3-5-sonnet-20241022"
    # Intervalo mínimo entre chamadas por câmera. Evita estourar custo
    # em horário de pico (várias câmeras classificando ao mesmo tempo).
    vlm_police_interval_s: float = 30.0
    # Confiança mínima do YOLO pra um track virar candidato. 0.55 filtra
    # detecções duvidosas que só desperdiçariam tokens.
    vlm_police_min_confidence: float = 0.55

    @property
    def cors_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    def ensure_dirs(self) -> None:
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        self.heatmap_dir.mkdir(parents=True, exist_ok=True)
        self.annotated_dir.mkdir(parents=True, exist_ok=True)


settings = Settings()
settings.ensure_dirs()
