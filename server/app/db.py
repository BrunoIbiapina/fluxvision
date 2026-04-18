"""Camada de acesso ao banco — SQLAlchemy 2.x."""
from __future__ import annotations

import logging
from contextlib import contextmanager
from typing import Generator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import settings

logger = logging.getLogger(__name__)


class Base(DeclarativeBase):
    """Base declarativa dos modelos."""


engine = create_engine(
    settings.db_url,
    echo=False,
    future=True,
    connect_args={"check_same_thread": False} if settings.db_url.startswith("sqlite") else {},
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def init_db() -> None:
    """Cria todas as tabelas e aplica micro-migrações de MVP."""
    # Importação explícita para registrar os modelos na Base.metadata.
    from . import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    _apply_mvp_migrations()


def _apply_mvp_migrations() -> None:
    """Aplica migrações simples por introspecção.

    Enquanto não temos Alembic plugado, adiciona colunas novas em tabelas
    existentes sem destruir dados. Idempotente.
    """
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())

    if "videos" in tables:
        existing = {c["name"] for c in inspector.get_columns("videos")}
        if "annotated_path" not in existing:
            logger.info("Migração: adicionando coluna videos.annotated_path")
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE videos ADD COLUMN annotated_path VARCHAR(500)"))

    if "traffic_summaries" in tables:
        existing = {c["name"] for c in inspector.get_columns("traffic_summaries")}
        if "pedestrians" not in existing:
            logger.info("Migração: adicionando coluna traffic_summaries.pedestrians")
            with engine.begin() as conn:
                conn.execute(
                    text("ALTER TABLE traffic_summaries ADD COLUMN pedestrians INTEGER DEFAULT 0")
                )


def get_db() -> Generator[Session, None, None]:
    """Dependency injection para endpoints FastAPI."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def session_scope() -> Generator[Session, None, None]:
    """Context manager para scripts / tarefas em background."""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
