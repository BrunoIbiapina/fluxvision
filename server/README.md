# FluxVision · Backend

API FastAPI que processa vídeos de câmeras urbanas, detecta e rastreia
veículos com YOLOv8, persiste detecções e expõe endpoints analíticos para o
dashboard.

## Rodando localmente

```bash
cd server
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
python -m app.seed                 # popula com 60 dias de dados simulados
uvicorn app.main:app --reload --port 8000
```

Abra a documentação interativa em `http://localhost:8000/docs`.

## Estrutura

```
server/
├── app/
│   ├── main.py              # FastAPI app + wiring
│   ├── config.py            # pydantic-settings
│   ├── db.py                # SQLAlchemy engine / session
│   ├── models.py            # Entidades (Location, Camera, Video, Detection…)
│   ├── schemas.py           # Contratos Pydantic
│   ├── seed.py              # Popula banco com dados realistas de exemplo
│   ├── api/
│   │   ├── locations.py
│   │   ├── cameras.py
│   │   ├── videos.py        # upload + processamento
│   │   ├── analytics.py     # fluxo por período, ranking, comparativos
│   │   ├── heatmap.py
│   │   └── alerts.py
│   ├── services/
│   │   ├── analytics_service.py
│   │   └── alerts_service.py
│   └── vision/
│       ├── detector.py      # YOLOv8 (com fallback para modo simulado)
│       ├── tracker.py       # IoU tracker + contagem por linha virtual
│       ├── heatmap.py       # Geração de heatmap do frame
│       └── pipeline.py      # Pipeline end-to-end do vídeo
└── data/                     # uploads, heatmaps, sqlite (criados em runtime)
```

## Endpoints principais

| Método | Path                                  | O que faz                                       |
|--------|---------------------------------------|-------------------------------------------------|
| GET    | `/health`                             | Health check                                    |
| GET    | `/api/locations`                      | Lista locais monitorados                        |
| POST   | `/api/locations`                      | Cadastra local (cidade, bairro, lat/lng)        |
| GET    | `/api/cameras`                        | Lista câmeras                                   |
| POST   | `/api/cameras`                        | Cadastra câmera                                 |
| POST   | `/api/videos/upload`                  | Upload + processamento de vídeo                 |
| GET    | `/api/videos`                         | Histórico de vídeos processados                 |
| GET    | `/api/analytics/summary`              | KPIs globais (total, média, pico)               |
| GET    | `/api/analytics/hourly`               | Fluxo por hora do dia                           |
| GET    | `/api/analytics/daily`                | Fluxo por dia                                   |
| GET    | `/api/analytics/monthly`              | Fluxo por mês                                   |
| GET    | `/api/analytics/compare`              | Comparação entre períodos                       |
| GET    | `/api/analytics/ranking`              | Ranking de locais por fluxo                     |
| GET    | `/api/analytics/geo`                  | Pontos para o mapa (com intensidade)            |
| GET    | `/api/heatmap/{video_id}`             | Imagem heatmap de um vídeo                      |
| GET    | `/api/alerts`                         | Alertas de anomalia ativos                      |

Todos retornam JSON (exceto `/api/heatmap/{id}` que devolve PNG).
