# Arquitetura Técnica — FluxVision

## 1. Diagrama lógico

```
                       ┌──────────────────────────────────────┐
                       │           FRONTEND (Next.js)         │
                       │  app/page.tsx    ← Dashboard         │
                       │  Recharts · Leaflet · Tailwind       │
                       └──────────────┬───────────────────────┘
                                      │ HTTP JSON
                                      ▼
                       ┌──────────────────────────────────────┐
                       │         BACKEND API (FastAPI)        │
                       │  /api/videos · /api/analytics · …    │
                       └──────┬───────────────┬───────────────┘
                              │               │
              ┌───────────────▼────┐   ┌──────▼───────────────────┐
              │ VIDEO PIPELINE     │   │ ANALYTICS SERVICE        │
              │ (BackgroundTasks)  │   │ summaries, ranking,      │
              │ YOLOv8 + Tracker   │   │ compare, geo             │
              │ + HeatmapAccum     │   └──────────────┬───────────┘
              └───────┬────────────┘                  │
                      │                               │
                      ▼                               ▼
              ┌──────────────┐                ┌──────────────────┐
              │ Filesystem   │                │ SQLite           │
              │ data/uploads │                │ fluxvision.db    │
              │ data/heatmaps│                │ (SQLAlchemy 2.x) │
              └──────────────┘                └──────────────────┘
```

## 2. Camadas

### 2.1. Frontend

- Next.js 14 (App Router) com client components para os dashboards
- Tailwind para estilo, design dark profissional
- Recharts (gráficos) + Leaflet (mapa)
- Fetch direto da API — sem BFF no MVP
- Todo dado tipado via `lib/types.ts`, consumido por `lib/api.ts`

### 2.2. Backend

- FastAPI (ASGI, tipado via Pydantic)
- SQLAlchemy 2.x (ORM declarativo)
- `BackgroundTasks` do FastAPI para processamento assíncrono de vídeos
  (MVP) — fase 3 migra para Celery + Redis
- Roteadores agrupados em `app/api/*.py`
- Serviços (regras de negócio) em `app/services/*.py`
- Visão computacional em `app/vision/*.py`

### 2.3. Visão computacional

```
VideoPipeline.run(video_id)
 ├─ cv2.VideoCapture(path)
 ├─ loop frames (stride configurável)
 │   ├─ VehicleDetector.detect(frame)  → List[Detection]
 │   ├─ IoUTracker.update(detections)  → List[Track]
 │   ├─ cross_line(track, line)        → 'in' | 'out' | None
 │   └─ HeatmapAccumulator.add_box(…)
 ├─ heatmap.save(heatmap.png)
 ├─ DB: marca video.status = DONE
 ├─ DB: insere Detection para cada track estável
 └─ DB: upsert TrafficSummary(granularity='hour', bucket=recorded_at)
```

### 2.4. Persistência

- **MVP**: SQLite (uma tabela por arquivo, sem setup) — suficiente para
  dezenas de milhares de detections
- **Produção**: PostgreSQL 16 + TimescaleDB (hypertables em
  `detections.first_seen` e `traffic_summaries.bucket_start`)
- Migrações: Alembic configurado (pasta `alembic/` — roadmap fase 2)

### 2.5. Storage de arquivos

- **MVP**: filesystem local (`./data/uploads`, `./data/heatmaps`)
- **Produção**: S3/MinIO; o `filepath` no banco vira `s3://bucket/key`

## 3. Padrões de código

- Todos os módulos usam `from __future__ import annotations` (PEP 604)
- Pydantic v2 (`model_config = ConfigDict(from_attributes=True)`)
- `pydantic-settings` para configuração (prefixo `FLUXVISION_`)
- Sessão de DB via `Depends(get_db)` em endpoints e `session_scope()` em
  scripts/workers
- Frontend: import alias `@/*`, componentização agressiva
  (cada gráfico em arquivo próprio)

## 4. Fluxos principais

### 4.1. Upload de vídeo

```
POST /api/videos/upload  (multipart)
 ├─ grava file em upload_dir/cam{id}_{uuid}.mp4
 ├─ cria linha em videos (status=PENDING)
 ├─ agenda BackgroundTask → _process_video(video.id)
 └─ retorna 202 com Video
```

### 4.2. Processamento assíncrono

```
_process_video(video_id)
 └─ VideoPipeline().run(video_id)
    ├─ status=PROCESSING
    ├─ detecção + tracking + heatmap
    ├─ persiste Detection(s) + TrafficSummary
    └─ status=DONE, grava heatmap_path
```

### 4.3. Consulta do dashboard

```
GET /api/analytics/summary?days=30
 └─ analytics_service.compute_kpis(db, days=30)
    ├─ lê traffic_summaries entre start..end
    ├─ lê período anterior para variação
    └─ retorna Kpi(total, avg, peak, …)
```

## 5. Decisões arquiteturais (ADRs resumidos)

### ADR-001. Por que SQLite no MVP?

Evita dependência externa, permite `python -m app.seed && uvicorn` sem
Docker. Troca é trivial — basta mudar `FLUXVISION_DB_URL`.

### ADR-002. Por que IoU Tracker e não ByteTrack no MVP?

Zero dependência extra, código próprio (transparente e testável),
suficiente para vídeos urbanos com FPS >= 10. ByteTrack entra quando
precisarmos lidar com oclusão pesada e tráfego caótico.

### ADR-003. Por que BackgroundTasks e não Celery?

MVP foca em simplicidade de execução — `pip install + uvicorn` basta.
Celery entra quando precisarmos de múltiplos workers, retry e priorização.

### ADR-004. Por que Recharts e não Plotly/D3 direto?

Recharts tem DX superior em React, o dataset do MVP é pequeno, não
precisamos das capabilities avançadas do D3.

### ADR-005. Por que Leaflet e não Mapbox?

Zero configuração, sem API key, totalmente open-source, tiles CARTO Dark
batem visualmente com o tema do dashboard.

## 6. Segurança (roadmap detalhado)

1. **Autenticação**: JWT com refresh tokens; provider OIDC (Keycloak ou
   auth0) para SSO institucional.
2. **Autorização**: RBAC com papéis `admin`, `analista`, `visualizador`.
3. **TLS**: API sempre atrás de reverse proxy (nginx/caddy) com cert Let's
   Encrypt.
4. **Rate-limit**: 60 req/min/IP para endpoints públicos (se expostos).
5. **Audit log**: cada consulta analítica e cada ack de alerta é gravado.
6. **Secrets management**: `docker-compose secrets` ou Vault em produção.

## 7. Testes (fase 2)

- `pytest` + `httpx.AsyncClient` para testes de integração da API
- `pytest-asyncio` para background tasks
- Vídeos sintéticos pequenos (gerados com `cv2.VideoWriter`) para testar
  o pipeline de ponta a ponta
- CI: GitHub Actions rodando testes + lint (`ruff`) + type-check (`mypy`)
