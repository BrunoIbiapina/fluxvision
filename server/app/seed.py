"""Seed — intencionalmente vazio.

O FluxVision agora nasce sem dados sintéticos. Toda métrica no dashboard
vem dos vídeos enviados pelo usuário (batch) ou do stream ao vivo de
câmeras cadastradas. Mantemos este módulo para preservar o contrato do
`main.lifespan` (chama `seed.is_empty`/`seed.run` quando `SEED_ON_START`
está ligado), mas ambos são no-op aqui.
"""
from __future__ import annotations

from sqlalchemy.orm import Session

from .db import Base, SessionLocal, engine
from .models import City


def is_empty(db: Session) -> bool:
    """Mantido por compat — verifica se ainda não há cidades cadastradas."""
    return db.query(City).count() == 0


def run(db: Session) -> None:
    """No-op: nada é populado automaticamente. O usuário cadastra
    cidades/câmeras pela UI (/cameras) e envia vídeos / inicia live para
    gerar métricas reais."""
    return None


# ---------------------------------------------------------------------------
if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        print("Seed vazio — banco mantido como está.")
