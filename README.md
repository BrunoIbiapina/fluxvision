# FluxVision — Plataforma de Inteligência de Fluxo Urbano por Vídeo

![FluxVision: painel de contagem de veículos](docs/preview-portfolio.png)

> Sistema de IA que analisa vídeos e câmeras ao vivo para monitorar fluxo de
> veículos e pedestres, gerar dashboards analíticos, mapas de calor,
> comparativos históricos e alertas de anomalias — com foco em segurança
> pública, mobilidade e inteligência operacional.

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│   FluxVision  ·  urban flow intelligence from video                      │
│                                                                          │
│   [upload | RTSP | HLS | YouTube | webcam | drone] → [IA detecção        │
│          + tracking + contagem + alertas] → [banco temporal + MJPEG]     │
│                                       ↓                                  │
│   [dashboard] ← [analytics engine] ← [heatmap + alertas + comparativos]  │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

## O que o sistema faz hoje

1. **Ingestão** — upload de vídeo MP4, RTSP, HLS (`.m3u8`), YouTube live/VOD, webcam local e RTMP (via gateway externo para drones de consumo).
2. **Detecção** — YOLOv8/v11 ou RT-DETR (Ultralytics) identifica carros, motos, ônibus, caminhões, bicicletas **e pessoas**.
3. **Tracking** — IoU tracker class-agnostic + NMS cross-class a IoU 0.6 para evitar contagem duplicada de pedestre classificado como moto.
4. **Contagem por tipo** — veículos e pedestres são contados separadamente; pedestre nunca entra em "fluxo de veículos".
5. **Persistência temporal** — batch (vídeos processados) e live (janelas flush por evento) gravam `TrafficSummary` agregado por hora/dia/mês.
6. **Analytics** — fluxo por hora/dia/mês, KPIs com janela de captura e fuso horário (`America/Sao_Paulo`), tendências, pico, ranking e `compare` A/B.
7. **Mapa de calor** — dentro do frame (densidade espacial) e geográfico (intensidade por câmera).
8. **Alertas automáticos** — anomalia estatística (pico/queda vs. baseline), veículo parado (WARNING a 25s, CRITICAL a 75s), **pedestre em faixa de risco da pista** e classificador opcional de **viatura policial** via VLM.
9. **Streaming ao vivo** — MJPEG servido via `/api/live/{camera_id}/mjpeg` com overlay de boxes + contagens + FPS em tempo real.
10. **Dashboard** — Next.js 14 com KPIs, mapas Leaflet, gráficos Recharts e ranking com variação.

## Roadmap de demo (3 níveis)

| Nível | Entrega | Estado |
|-------|---------|--------|
| **1. Batch** | Upload de vídeo → processa → MP4 anotado + heatmap + contagens no dashboard | ✅ |
| **2. Vídeo anotado** | `/api/videos/{id}/annotated` + página `/videos/[id]` reproduz com boxes desenhados | ✅ |
| **3. Live overlay** | `/api/live/start` sobe worker, `<img>` consome MJPEG com boxes ao vivo | ✅ |

Só se sobe de nível depois que o anterior valida.

## Arquitetura separada (não-monolítica)

```
IA Controle Fluxo/
├── server/           # Backend Python (FastAPI + OpenCV + YOLO)  ·  independente
├── web/              # Frontend Next.js (Tailwind + Recharts + Leaflet) · independente
├── docs/             # Especificação, arquitetura, roadmap, guia de execução
├── docker-compose.yml
└── README.md
```

Backend e frontend têm gerenciadores de dependência, scripts e `Dockerfile`
próprios. `cd server && pip install -r requirements.txt` não toca o
frontend e vice-versa.

## Quick start

```bash
# 1) Backend
cd server
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
# → seed automático se o banco estiver vazio (FLUXVISION_SEED_ON_START=true)

# 2) Frontend (em outro terminal)
cd web
npm install
npm run dev                   # http://localhost:3000
```

Ou com Docker:

```bash
docker compose up --build
# Frontend → http://localhost:3000
# API + Swagger → http://localhost:8000/docs
```

**Modo degradado:** se `ultralytics` não estiver instalado ou não houver
GPU, o `VehicleDetector` cai num detector simulado que gera tracks
sintéticos. Útil para demo offline — o fluxo end-to-end funciona sem
peso real.

## Fontes de vídeo suportadas

| Tipo | Exemplo de `source` | Observações |
|------|---------------------|-------------|
| Upload MP4 | `POST /api/videos/upload` | Processa em background; grava anotado |
| Webcam local | `"0"`, `"1"` | OpenCV abre com `int`; pensado para dev |
| RTSP | `rtsp://user:pwd@192.168.1.10/stream1` | Câmeras IP profissionais |
| HLS | `https://.../playlist.m3u8` | CDNs de transmissão |
| YouTube | `https://www.youtube.com/watch?v=...` | `yt-dlp` resolve manifest HLS |
| Arquivo local | `/caminho/arquivo.mp4` | Útil para testes |
| Drone | RTMP via gateway externo (`nginx-rtmp`) → vira RTSP/HLS | Consumidor (DJI etc.) não fala RTSP nativo |

Resolução e tipagem ficam em `server/app/utils/sources.py`. Webcam
retorna `int` (não string) porque `cv2.VideoCapture` só abre o device
com tipo inteiro.

## Superfície da API

```
GET    /health
GET    /docs                         # Swagger

GET    /api/cities                   # CRUD cidades
CRUD   /api/cameras                  # CRUD câmeras (lat/lng, categoria, stream_url)

POST   /api/videos/upload            # upload MP4 (background processing)
GET    /api/videos                   # lista
GET    /api/videos/{id}              # detalhe
GET    /api/videos/{id}/result       # contagens + heatmap_url + annotated_url
GET    /api/videos/{id}/annotated    # MP4 anotado
POST   /api/videos/{id}/reprocess    # re-executa pipeline

GET    /api/analytics/summary        # KPI (janela + fuso)
GET    /api/analytics/hourly|daily|monthly
GET    /api/analytics/ranking        # top câmeras
GET    /api/analytics/geo            # pontos pra mapa
GET    /api/analytics/compare        # A/B

GET    /api/alerts                   # lista
POST   /api/alerts/{id}/ack          # reconhecer
POST   /api/alerts/detect            # roda detector estatístico on-demand

GET    /api/heatmap/{video_id}       # PNG de densidade no frame

GET    /api/live                     # lista streams ativos
POST   /api/live/start               # body: { camera_id, source }
GET    /api/live/{camera_id}         # status JSON (fps, contagens, erros)
GET    /api/live/{camera_id}/mjpeg   # multipart/x-mixed-replace
POST   /api/live/{camera_id}/stop
```

## Alertas implementados

| Tipo | Gatilho | Nível | Arquivo |
|------|---------|-------|---------|
| Anomalia estatística | Variação > `anomaly_threshold_pct` vs. baseline | WARNING/CRITICAL | `vision/anomaly.py` |
| Veículo parado | Track estacionado ≥ 25s / ≥ 75s dentro de `stopped_px` | WARNING / CRITICAL | `vision/live.py` |
| Pedestre em faixa de risco | Pessoa dentro da faixa vertical da pista por ≥ `pedestrian_min_duration_s` | WARNING | `vision/pedestrian_alert.py` |
| Viatura policial (opcional) | Classificador VLM (Claude Vision) confirma elementos institucionais | INFO | `vision/police_classifier.py` |

Alertas são rate-limited (dedupe por track + intervalo global por câmera) para não estourar o banco.

## Stack

| Camada              | Tecnologia                                        |
|---------------------|---------------------------------------------------|
| Frontend            | Next.js 14, React 18, Tailwind, Recharts, Leaflet |
| Backend             | Python 3.11, FastAPI, Uvicorn, SQLAlchemy 2.x     |
| Visão computacional | Ultralytics (YOLOv8/v11/RT-DETR), OpenCV, NumPy   |
| Tracking            | IoU class-agnostic + NMS cross-class (MVP) → ByteTrack (prod) |
| Banco               | SQLite (MVP) → PostgreSQL + TimescaleDB (prod)    |
| Fila                | FastAPI BackgroundTasks (MVP) → Celery + Redis    |
| Storage             | filesystem (MVP) → S3 / MinIO (prod)              |
| VLM (opcional)      | Anthropic Claude 3.5 Sonnet (vision)              |
| Ingestão drone      | Externa: nginx-rtmp (consumidor fala RTMP)        |

## Configuração (variáveis de ambiente)

Prefixo `FLUXVISION_` — todas opcionais, defaults sensatos.

```
FLUXVISION_DB_URL=sqlite:///./data/fluxvision.db
FLUXVISION_YOLO_MODEL=yolov8n.pt          # ou yolo11n.pt, rtdetr-l.pt...
FLUXVISION_FRAME_STRIDE=3                 # batch (1 = todo frame)
FLUXVISION_LIVE_FRAME_STRIDE=2            # live
FLUXVISION_CONF_THRESHOLD=0.45

FLUXVISION_STOPPED_WARN_S=25
FLUXVISION_STOPPED_CRITICAL_S=75

FLUXVISION_PEDESTRIAN_ALERT_ENABLED=true
FLUXVISION_PEDESTRIAN_MIN_DURATION_S=1.5
FLUXVISION_PEDESTRIAN_ALERT_INTERVAL_S=20

# VLM de viatura — desligado por padrão porque tem custo por chamada
FLUXVISION_VLM_POLICE_ENABLED=false
FLUXVISION_VLM_MODEL=claude-3-5-sonnet-20241022
ANTHROPIC_API_KEY=sk-ant-...              # só se habilitar VLM

FLUXVISION_DISPLAY_TZ=America/Sao_Paulo
FLUXVISION_SEED_ON_START=true
```

## Documentação

- [`docs/SPECIFICATION.md`](docs/SPECIFICATION.md) — visão de produto, casos de uso, KPIs
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — arquitetura técnica detalhada
- [`docs/RUN.md`](docs/RUN.md) — guia de execução passo a passo
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — plano em fases (MVP → produção)

## Licença

Uso interno / PoC. Não redistribuir sem autorização.
