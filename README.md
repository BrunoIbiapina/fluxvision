# FluxVision — Plataforma de Inteligência de Fluxo Urbano por Vídeo

> Sistema de IA que analisa vídeos de câmeras urbanas para monitorar fluxo de
> veículos, gerar dashboards analíticos, mapas de calor, comparativos históricos
> e alertas de anomalias — com foco em segurança pública, mobilidade e
> inteligência operacional.

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│   FluxVision  ·  urban flow intelligence from video                      │
│                                                                          │
│   [vídeo/stream] → [IA de detecção + tracking] → [banco temporal]        │
│                                       ↓                                  │
│   [dashboard] ← [analytics engine] ← [heatmap + alertas + comparativos]  │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

## Arquitetura separada (não-monolítica)

Este projeto segue **arquitetura 100% separada**: backend, frontend e
documentação são independentes. Cada parte tem seu próprio gerenciador de
dependências, scripts e pode ser implantada isoladamente.

```
IA Controle Fluxo/
├── server/           # Backend Python (FastAPI + OpenCV + YOLO)  ·  independente
├── web/              # Frontend Next.js (Tailwind + Recharts + Leaflet) · independente
├── docs/             # Especificação, arquitetura e visão de produto
├── docker-compose.yml
└── README.md         # este arquivo
```

Você pode rodar `cd server && pip install -r requirements.txt` **sem nunca
tocar no frontend**, e vice-versa.

## O que o sistema faz

1. **Ingestão de vídeo** — upload manual, pasta monitorada, RTSP ou URL
2. **Detecção** — YOLOv8 identifica carro, moto, ônibus, caminhão, bicicleta
3. **Tracking** — algoritmo IoU/ByteTrack evita contagem duplicada
4. **Contagem por zona** — linhas virtuais contam entradas/saídas
5. **Persistência temporal** — cada detecção é salva com timestamp e localização
6. **Analytics** — fluxo por hora/dia/semana/mês/ano, médias, tendências
7. **Mapa de calor** — dentro do frame (densidade) e no mapa geográfico
8. **Comparações** — hoje vs. ontem, mês vs. mês, evento vs. normal, local A vs. B
9. **Alertas** — anomalias (pico, queda brusca, horário crítico)
10. **Dashboard** — visualização profissional com KPIs, mapas, gráficos e ranking

## Quick start

```bash
# 1) Backend
cd server
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m app.seed            # popula banco com dados de exemplo
uvicorn app.main:app --reload --port 8000

# 2) Frontend (em outro terminal)
cd web
npm install
npm run dev                   # http://localhost:3000
```

Ou com Docker:

```bash
docker compose up --build
# Frontend → http://localhost:3000
# API      → http://localhost:8000/docs
```

## Documentação

- [`docs/SPECIFICATION.md`](docs/SPECIFICATION.md) — visão de produto, casos de uso, KPIs
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — arquitetura técnica detalhada
- [`docs/RUN.md`](docs/RUN.md) — guia de execução passo a passo
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — plano em fases (MVP → produção)

## Stack

| Camada            | Tecnologia                                       |
|-------------------|--------------------------------------------------|
| Frontend          | Next.js 14, React 18, Tailwind, Recharts, Leaflet|
| Backend           | Python 3.11, FastAPI, Uvicorn, SQLAlchemy        |
| Visão computacional | Ultralytics YOLOv8, OpenCV, NumPy              |
| Tracking          | IoU Tracker (MVP) → ByteTrack (produção)         |
| Banco de dados    | SQLite (MVP) → PostgreSQL + TimescaleDB (prod)   |
| Fila              | FastAPI BackgroundTasks (MVP) → Celery + Redis   |
| Storage           | filesystem (MVP) → S3 / MinIO (prod)             |
| Observabilidade   | Uvicorn logs (MVP) → Prometheus + Grafana (prod) |

## Licença

Uso interno / PoC. Não redistribuir sem autorização.
