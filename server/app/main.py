"""Entrypoint FastAPI do FluxVision."""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import alerts as alerts_api
from .api import analytics as analytics_api
from .api import cameras as cameras_api
from .api import cities as cities_api
from .api import heatmap as heatmap_api
from .api import live as live_api
from .api import videos as videos_api
from .config import settings
from .db import SessionLocal, init_db

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s  %(name)s  %(message)s",
)
log = logging.getLogger("fluxvision")


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("Booting %s", settings.app_name)
    init_db()
    if settings.seed_on_start:
        from . import seed

        with SessionLocal() as db:
            if seed.is_empty(db):
                log.info("Banco vazio — rodando seed automático…")
                seed.run(db)
    yield
    log.info("Shutting down — encerrando live workers")
    from .vision.live import manager as live_manager

    live_manager.stop_all()


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description=(
        "FluxVision — plataforma de inteligência de fluxo urbano por vídeo. "
        "Recebe vídeos, detecta e rastreia veículos, e expõe métricas, "
        "comparativos, heatmaps e alertas para o dashboard."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(cities_api.router)
app.include_router(cameras_api.router)
app.include_router(videos_api.router)
app.include_router(analytics_api.router)
app.include_router(heatmap_api.router)
app.include_router(alerts_api.router)
app.include_router(live_api.router)


@app.get("/health", tags=["meta"])
def health() -> dict:
    return {"status": "ok", "service": settings.app_name, "version": "0.1.0"}


@app.get("/", tags=["meta"])
def root() -> dict:
    return {
        "name": settings.app_name,
        "docs": "/docs",
        "health": "/health",
    }
