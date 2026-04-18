# FluxVision — Especificação de Produto

> Plataforma de Inteligência de Fluxo Urbano por Vídeo.

## 1. Visão geral

### 1.1. Proposta de valor

FluxVision é uma plataforma de IA que transforma vídeos de câmeras urbanas em
**inteligência operacional**: quantos veículos passaram por onde, quando, em
que direção e com que variação em relação ao esperado. O sistema oferece
dashboards, mapas de calor, comparativos históricos e alertas, com foco em
**segurança pública, mobilidade urbana e planejamento estratégico**.

### 1.2. Problema resolvido

Centrais de monitoramento urbano hoje dependem de observação humana de dezenas
de câmeras. Isso é caro, não-escalável e não-mensurável. FluxVision
automatiza a extração de métricas objetivas de fluxo e as entrega em um
painel pronto para tomada de decisão.

### 1.3. Público-alvo

- Secretarias de Segurança Pública / Guardas Municipais
- Gestores de Mobilidade Urbana / Controle de Tráfego
- Organizadores de grandes eventos
- Redes varejistas que operam em regiões de alta circulação
- Pesquisadores urbanos

### 1.4. Impacto prático

- Redução do tempo médio para detectar anomalias de circulação
- Base quantitativa para dimensionar patrulhas e fiscalização
- Evidência numérica para decisões de infraestrutura urbana
- Avaliação objetiva de impacto de eventos (shows, jogos, manifestações)

---

## 2. Escopo funcional

### 2.1. Ingestão de vídeo

| Meio                             | Suportado no MVP | Observações |
|----------------------------------|------------------|-------------|
| Upload manual (MP4/MOV/AVI)      | **sim**          | Endpoint `/api/videos/upload` |
| URL externa (HTTP/HTTPS)         | roadmap fase 2   | Download e processamento assíncrono |
| Pasta monitorada (fs watcher)    | roadmap fase 2   | `watchdog` escuta `./data/inbox` |
| RTSP / câmera IP                 | roadmap fase 3   | Via `opencv.VideoCapture` + reconexão |
| CCTV integrado (ONVIF)           | roadmap fase 4   | Parceria ou SDK do fornecedor |

Metadados obrigatórios: `camera_id` (que já carrega location, lat/lng,
categoria). Opcional: `recorded_at` (ISO-8601).

### 2.2. Processamento com IA

Stack:

- **Detector**: Ultralytics YOLOv8 (n/s/m dependendo do hardware)
- **Classes aceitas** (COCO): `bicycle`, `car`, `motorcycle`, `bus`, `truck`
- **Tracker**: IoU Tracker (MVP) → ByteTrack / BoT-SORT (produção)
- **Contagem por linha virtual**: orientação entrada/saída via sinal do
  produto vetorial (ver `app/vision/tracker.py::cross_line`)
- **Heatmap**: acumulador gaussiano sobre as bounding boxes, renderizado com
  `cv2.COLORMAP_JET` e sobreposto ao último frame

Parâmetros configuráveis via `.env` (`FLUXVISION_*`):

- `FRAME_STRIDE`: processa 1 a cada N frames (default 3)
- `CONF_THRESHOLD`: confiança mínima da detecção (default 0.35)
- `YOLO_MODEL`: peso a usar (default `yolov8n.pt`)

### 2.3. Dashboard analítico

Páginas:

- **Overview** (`/`) — KPIs, fluxo horário, mapa geo, ranking, alertas,
  fluxo diário por tipo de veículo, mix
- **Analytics** (`/analytics`) — detalhamento temporal (hora/dia/mês),
  comparativo mensal por ano
- **Comparativo** (`/comparison`) — presets (hoje vs. ontem, semana vs.
  anterior, mês vs. anterior, 30 vs. 30)
- **Mapa de calor** (`/heatmap`) — visualização geográfica em tela cheia
- **Alertas** (`/alerts`) — lista, ack
- **Câmeras** (`/cameras`) — cadastro e status
- **Upload** (`/upload`) — envio de vídeos e histórico de processamento

### 2.4. KPIs expostos

| KPI                              | Fórmula / origem |
|----------------------------------|------------------|
| Fluxo total do período           | Σ(`traffic_summaries.total`) no filtro |
| Média por hora                   | total / horas contadas |
| Horário de pico                  | hora com maior Σ na curva diurna média |
| Variação vs. período anterior    | (Σ_atual − Σ_anterior) / Σ_anterior · 100 |
| Índice de anomalia               | max |variação| na última hora vs. baseline 14d |
| Densidade de veículos            | Σ(área das bboxes) / área do frame (heatmap-level) |
| Tendência mensal                 | regressão simples sobre séries mensais |
| Fluxo por tipo de veículo        | segmentação por `VehicleType` |

### 2.5. Comparações temporais suportadas

- Hoje vs. ontem
- Semana atual vs. anterior
- Mês atual vs. mês anterior
- Mês do ano vs. mesmo mês do ano anterior (sazonalidade)
- Evento (janela do `events.starts_at` → `ends_at`) vs. baseline mesmo dia/hora
- Local A vs. Local B
- Cidade A vs. Cidade B (somando locais)

### 2.6. Alertas e anomalias

Trigger automático roda periodicamente e compara a contagem da última hora
de cada local com o **baseline da mesma hora nos últimos 14 dias**. Se a
variação absoluta exceder `FLUXVISION_ANOMALY_THRESHOLD_PCT`:

- `warning` se |var| < 2× threshold
- `critical` se |var| ≥ 2× threshold

Alertas ficam pendentes até serem marcados como visualizados
(`POST /api/alerts/{id}/ack`).

---

## 3. Regras de negócio

1. **Contagem única por track_id**: um veículo rastreado só é contabilizado
   uma vez, mesmo que saia e volte ao frame (até `max_miss` frames).
2. **Linha virtual de contagem**: cada câmera pode ter uma linha imaginária
   horizontal (MVP) ou customizada (roadmap). O cruzamento conta como `in`
   ou `out` dependendo do sentido do produto vetorial.
3. **Vídeos muito ruins** (resolução < 320p, FPS < 5) são rejeitados com
   `VideoStatus.FAILED` e mensagem de erro.
4. **Baseline de anomalia**: 14 dias é o mínimo. Se não houver histórico
   suficiente, o alerta não é disparado.
5. **Anonimização**: o sistema NÃO persiste nenhuma imagem ou crop de
   pessoas. Só são salvos frames de heatmap agregado (sem rostos
   reconhecíveis). Placas NÃO são extraídas neste MVP.
6. **Retenção**: configurável — default 90 dias para `traffic_summaries`,
   30 dias para `detections` (individuais), 30 dias para vídeos upados.

---

## 4. Dados e modelagem

Ver `server/app/models.py`. Resumo:

```
Location 1 ── N Camera 1 ── N Video 1 ── N Detection
                                 │
                                 └── N TrafficSummary  (hour|day|month)
                                 └── 1 HeatmapAsset

Alert  (opcional FK para Location, Camera)
Event  (opcional FK para Location, com metadata JSON)
```

### 4.1. Principais campos

- **Location**: `name, city, district, category, lat, lng, notes`
- **Camera**: `name, location_id, rtsp_url, active`
- **Video**: `camera_id, filename, filepath, status, duration_s, fps,
  recorded_at, processed_at, heatmap_path`
- **Detection**: `video_id, track_id, vehicle_type, direction, first_seen,
  last_seen, confidence`
- **TrafficSummary**: `granularity, bucket_start, total, cars, motorcycles,
  buses, trucks, others`

### 4.2. Evolução para produção

- Trocar SQLite por **PostgreSQL**
- Ativar **TimescaleDB** nas tabelas `detections` e `traffic_summaries`
  (hypertables por `bucket_start` / `first_seen`)
- Índices compostos `(location_id, bucket_start)` em `traffic_summaries`

---

## 5. KPIs e visualizações

| Visual                             | Biblioteca | Componente          |
|------------------------------------|------------|---------------------|
| KPI cards                          | —          | `KpiCard`           |
| Fluxo por hora (área)              | Recharts   | `HourlyFlowChart`   |
| Fluxo diário empilhado por tipo    | Recharts   | `DailyFlowChart`    |
| Comparativo mensal por ano (linha) | Recharts   | `MonthlyComparisonChart` |
| Mix de veículos (donut)            | Recharts   | `VehicleTypeBreakdown` |
| Ranking de locais                  | custom     | `LocationRanking`   |
| Mapa de calor geo                  | Leaflet    | `MapView`           |
| Painel de alertas                  | custom     | `AlertsPanel`       |
| Comparativo lado a lado (barras)   | Recharts   | `/comparison` page  |

---

## 6. Roadmap em fases

### Fase 1 — MVP **(este release)**

- Upload manual de vídeo
- Detecção + tracking + contagem
- Heatmap por vídeo
- Dashboard com KPIs, mapa, ranking
- Comparativos presets
- Alertas básicos
- Seed realista

### Fase 2 — Múltiplas câmeras e georreferenciamento avançado

- Pasta monitorada e ingestão via URL
- Zonas de contagem configuráveis por câmera (polígonos, não só linha)
- Export (CSV/Excel) de summaries
- Agendamento de `alerts_service.detect_anomalies` (Celery beat)
- Auth JWT + RBAC (admin, analista, visualizador)

### Fase 3 — Tempo real

- Integração RTSP / câmeras IP (worker permanente)
- WebSocket para atualização em tempo real do dashboard
- Cache Redis para KPIs
- Migração para PostgreSQL + TimescaleDB
- Fila Celery/RQ para processar vídeos em paralelo

### Fase 4 — Inteligência preditiva

- Modelos de previsão de fluxo (Prophet/LightGBM) por local
- Correlação com eventos cadastrados
- Scoring de risco por região
- Integração com sistemas externos (SSP, Waze, 190)

---

## 7. Riscos e limitações

- **Qualidade de vídeo**: iluminação noturna e chuva degradam o YOLO. Modelo
  `yolov8m` + augmentation ajuda. Para produção, treinar em dataset
  específico de câmeras urbanas brasileiras.
- **Oclusão**: caminhões escondem carros menores. ByteTrack mitiga.
- **Custo computacional**: inferência YOLO em tempo real a 1080p exige GPU.
  Para MVP, frame_stride=3 em CPU Mx é viável em vídeos até 720p.
- **Falsos positivos**: placas, outdoors e reflexos às vezes disparam
  detecção. Threshold ajustado (0.35) e filtro por classe mitigam.
- **Privacidade / LGPD**: ver §8.
- **Posicionamento da câmera**: MVP assume câmeras fixas e não oscilantes.
  Para PTZ, reposicionar a linha de contagem após cada reset.

---

## 8. LGPD, ética e responsabilidade

FluxVision se posiciona como plataforma de **inteligência agregada**,
**não** como plataforma de identificação pessoal. Diretrizes:

1. **Não extraímos faces, placas ou identificadores individuais**.
2. Só persistimos **contagens agregadas** (hora/dia/mês) e metadados
   técnicos (bbox, track_id efêmero, confidence). Nenhum crop de imagem
   contendo pessoas é salvo.
3. O heatmap gerado é construído sobre o **último frame do vídeo** com
   overlay de densidade — o frame original pode ser descartado após o
   processamento.
4. Retenção explícita e configurável; contagens agregadas podem ser
   mantidas por tempo estendido, dados brutos devem ser apagados conforme
   política.
5. O operador do sistema deve declarar **base legal** para processamento
   (interesse público, contrato, consentimento via sinalização física).
6. Auditoria: toda consulta analítica pode ser logada.

---

## 9. Segurança da solução

- CORS restrito a `NEXT_PUBLIC_API_BASE_URL` conhecido
- Roadmap: autenticação via JWT/OIDC, rate-limiting, WAF em frente à API
- Armazenamento: se em nuvem, bucket S3 com encryption-at-rest
- Segredos em variáveis de ambiente, nunca em código

---

## 10. Estratégia de testes

- **Unitários**: `tracker._iou`, `cross_line`, `analytics_service.compute_kpis`
- **Integração**: subir API com banco temporário, fazer upload de um vídeo
  sintético curto, verificar que detections aparecem
- **E2E smoke** (fase 2): playwright abre o dashboard e verifica presença
  de KPIs > 0 após seed

---

## 11. Observabilidade (roadmap)

- Logs estruturados (JSON) via `structlog`
- Métricas Prometheus expostas em `/metrics`
  - `fluxvision_videos_processed_total`
  - `fluxvision_video_processing_seconds`
  - `fluxvision_detections_total{vehicle_type}`
  - `fluxvision_alerts_triggered_total{level}`
- Dashboard Grafana padrão
- Tracing OpenTelemetry

---

## 12. Glossário

- **Tracking**: associação temporal de detecções do mesmo objeto entre
  frames; evita contar 1 carro 30 vezes.
- **Linha virtual**: segmento imaginário desenhado sobre a imagem que
  define fronteira de contagem (carros que cruzam = contados).
- **Heatmap**: mapa de calor 2D (dentro do frame) ou geográfico (no mapa).
- **Baseline**: comportamento esperado de fluxo, derivado do histórico
  da mesma hora, dia da semana, local.
- **Anomalia**: desvio estatístico significativo em relação ao baseline.
