# FluxVision · Web (Next.js)

Dashboard profissional de inteligência de fluxo urbano.

## Rodando localmente

```bash
cd web
cp .env.example .env.local
npm install
npm run dev     # http://localhost:3000
```

Requer a API em `NEXT_PUBLIC_API_BASE_URL` (default: `http://localhost:8000`).

## Estrutura

```
web/
├── app/                        # App Router (Next.js 14)
│   ├── layout.tsx
│   ├── page.tsx                # Dashboard principal (overview)
│   ├── globals.css
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
│   ├── MapView.tsx             # Leaflet
│   ├── AlertsPanel.tsx
│   └── FiltersBar.tsx
└── lib/
    ├── api.ts                  # Cliente HTTP tipado para a API
    ├── types.ts                # Tipos compartilhados
    └── utils.ts
```

## Páginas

| Rota              | O que mostra                                                   |
|-------------------|----------------------------------------------------------------|
| `/`               | Overview: KPIs, fluxo por hora, mapa geo, ranking, alertas     |
| `/analytics`      | Detalhes: hora, dia, mês, por tipo de veículo                  |
| `/comparison`     | Comparativo entre períodos (hoje vs. ontem etc.)               |
| `/heatmap`        | Mapa geográfico de intensidade                                 |
| `/alerts`         | Lista completa de alertas com ack                              |
| `/cameras`        | Câmeras cadastradas e status                                   |
| `/upload`         | Upload de vídeo para processamento                             |
