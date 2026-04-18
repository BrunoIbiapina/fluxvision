# Como rodar o FluxVision

Este documento mostra **dois caminhos**: rodar direto (mais rápido, recomendado
para desenvolvimento) e rodar via Docker (mais isolado).

## Pré-requisitos

- Python 3.11+
- Node.js 20+
- Git

Opcional:

- Docker + Docker Compose (se for usar o caminho containerizado)
- GPU NVIDIA com CUDA (para inferência YOLO acelerada — não necessário)

---

## Caminho 1 — Direto (recomendado p/ desenvolvimento)

### 1.1. Backend

```bash
cd server
python3 -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env

# Popula o banco com dados realistas (60 dias de seed).
# Na primeira execução da API, se o banco estiver vazio, o seed roda sozinho.
python -m app.seed

# Sobe a API
uvicorn app.main:app --reload --port 8000
```

Abra `http://localhost:8000/docs` — você deve ver a documentação interativa
do FastAPI (Swagger UI).

> **Primeira vez com YOLO**: ao processar o primeiro vídeo, o Ultralytics
> baixa os pesos `yolov8n.pt` (~6 MB) para `~/.config/Ultralytics/`. Pode
> levar alguns segundos. Se você não instalar `ultralytics`, o sistema
> ainda roda — a detecção entra em modo simulado.

### 1.2. Frontend

Em outro terminal:

```bash
cd web
cp .env.example .env.local
npm install
npm run dev                          # http://localhost:3000
```

Pronto — abra `http://localhost:3000`.

Você verá o **dashboard preenchido com dados de seed**: 8 locais, 60 dias
de histórico horário, alertas ativos, heatmap geográfico e ranking.

### 1.3. Testando upload de vídeo

1. Baixe um vídeo de tráfego urbano (exemplo: YouTube downloader → MP4).
2. Na UI, vá em `/upload`, selecione uma câmera, arraste o arquivo.
3. A lista de "últimos vídeos processados" atualiza a cada 5s.
4. Quando o status vira `done`, clique em "heatmap" para ver a imagem.
5. O KPI "Fluxo total" na página inicial aumenta conforme o vídeo contribui.

---

## Caminho 2 — Docker Compose

```bash
cd "IA Controle Fluxo"
docker compose up --build
```

Espere as duas imagens subirem (2-3 min na primeira vez). Abra:

- Frontend → http://localhost:3000
- API + Swagger → http://localhost:8000/docs

Para parar:

```bash
docker compose down
```

---

## Troubleshooting

### CORS bloqueado

Confira se `FLUXVISION_CORS_ORIGINS` na `.env` do backend inclui
`http://localhost:3000` — já está configurado por padrão.

### Erro `ModuleNotFoundError: ultralytics`

Opcional. O sistema cai para detector simulado se não encontrar.
Para habilitar YOLO: `pip install ultralytics` dentro do venv.

### Porta 8000 ou 3000 ocupada

Backend: `uvicorn app.main:app --port 8080`
Frontend: edite `scripts.dev` em `web/package.json` para `-p 3001` e
ajuste `NEXT_PUBLIC_API_BASE_URL`.

### Banco com dados errados / quero resetar

```bash
rm server/data/fluxvision.db
# na próxima execução da API, o seed roda automaticamente
```

### Heatmap volta vazio

Indica que o pipeline não detectou nada no vídeo. Verifique:

- Vídeo tem veículos visíveis?
- `FLUXVISION_CONF_THRESHOLD` não está alta demais (default 0.35)
- Ultralytics carregou com sucesso (veja `server` logs — procure "Carregando modelo YOLO")

---

## Estrutura final no disco

```
IA Controle Fluxo/
├── README.md
├── docker-compose.yml
├── .gitignore
├── docs/
│   ├── SPECIFICATION.md
│   ├── ARCHITECTURE.md
│   ├── ROADMAP.md
│   └── RUN.md
├── server/
│   ├── requirements.txt
│   ├── .env.example
│   ├── Dockerfile
│   ├── README.md
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── db.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── seed.py
│   │   ├── api/
│   │   ├── services/
│   │   └── vision/
│   └── data/  (criado em runtime)
└── web/
    ├── package.json
    ├── tsconfig.json
    ├── next.config.mjs
    ├── tailwind.config.ts
    ├── postcss.config.mjs
    ├── .env.example
    ├── Dockerfile
    ├── README.md
    ├── app/
    │   ├── layout.tsx
    │   ├── globals.css
    │   ├── page.tsx         (Dashboard)
    │   ├── analytics/page.tsx
    │   ├── comparison/page.tsx
    │   ├── heatmap/page.tsx
    │   ├── alerts/page.tsx
    │   ├── cameras/page.tsx
    │   └── upload/page.tsx
    ├── components/
    │   ├── Sidebar.tsx
    │   ├── Topbar.tsx
    │   ├── KpiCard.tsx
    │   ├── HourlyFlowChart.tsx
    │   ├── DailyFlowChart.tsx
    │   ├── MonthlyComparisonChart.tsx
    │   ├── LocationRanking.tsx
    │   ├── VehicleTypeBreakdown.tsx
    │   ├── MapView.tsx
    │   ├── AlertsPanel.tsx
    │   └── FiltersBar.tsx
    └── lib/
        ├── api.ts
        ├── types.ts
        └── utils.ts
```
