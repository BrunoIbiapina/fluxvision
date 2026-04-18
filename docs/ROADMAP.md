# Roadmap

Versão atual: **0.1.0 MVP** (abril 2026).

## Legenda

- 🟢 entregue
- 🟡 em andamento
- 🔵 próximo
- ⚪️ planejado

---

## v0.1 — MVP (este release)

- 🟢 Arquitetura separada backend/frontend
- 🟢 FastAPI com SQLite + SQLAlchemy
- 🟢 YOLOv8 + IoU tracker
- 🟢 Contagem por linha virtual (horizontal)
- 🟢 Heatmap por vídeo (PNG sobre último frame)
- 🟢 Endpoints de analytics (KPIs, hourly/daily/monthly, ranking, geo, compare)
- 🟢 Alertas baseados em baseline de 14d
- 🟢 Seed realista (60 dias, 8 locais)
- 🟢 Dashboard Next.js com Recharts + Leaflet
- 🟢 Upload + processamento em background
- 🟢 Docker Compose

## v0.2 — Operacional

- 🔵 Autenticação JWT (login + roles `admin/analyst/viewer`)
- 🔵 Zonas de contagem configuráveis por câmera (polígonos)
- 🔵 Export CSV/Excel dos summaries
- 🔵 Agendamento automático de detecção de anomalia (APScheduler/Celery beat)
- 🔵 Migração para PostgreSQL (Alembic + docker-compose com postgres)
- 🔵 Pasta monitorada (watchdog) para ingestão automática
- 🔵 Download de vídeo via URL (HTTP/HTTPS)

## v0.3 — Tempo real

- ⚪️ Integração RTSP / câmera IP (worker permanente com reconexão)
- ⚪️ WebSocket para push de KPIs e alertas no dashboard
- ⚪️ Celery + Redis para fila distribuída
- ⚪️ TimescaleDB com hypertables em `detections` e `traffic_summaries`
- ⚪️ Cache Redis para queries frequentes (KPI summary, ranking)
- ⚪️ Paginação e filtro avançado no histórico de vídeos

## v0.4 — Inteligência

- ⚪️ Previsão de fluxo por local (Prophet/LightGBM)
- ⚪️ Correlação automática com `events` cadastrados
- ⚪️ Scoring de risco por região (combinação fluxo + tipo + hora)
- ⚪️ Detecção de padrões recorrentes (mesmo sentido/hora toda semana)
- ⚪️ Integração com Waze API / 190 / ocorrências SSP

## v1.0 — Produção em escala

- ⚪️ Multi-tenancy (cada secretaria/cidade isolada)
- ⚪️ Observabilidade (Prometheus + Grafana)
- ⚪️ Deploy em Kubernetes (Helm chart)
- ⚪️ Compliance LGPD: log de consentimento, retenção automática
- ⚪️ SDK Python/JS para clientes externos consumirem analytics
