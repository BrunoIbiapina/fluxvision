# Design Critique: FluxVision Dashboard (Overview)

Escopo: página `/` (Dashboard), com foco nos componentes `HourlyFlowChart`, `AlertsPanel`, `KpiCard`, `FiltersBar`, `LocationRanking`, `VehicleTypeBreakdown`, tokens Tailwind e CSS base. Estágio: produto em demo — já entregando valor, precisando de polimento antes de mostrar pra stakeholder.

---

## Impressão Geral

O dark theme cyan-over-navy funciona bem pra "inteligência urbana" — a paleta é coesa e profissional. A hierarquia de KPI → gráficos → mapa + ranking → breakdown está correta (macro → detalhe). Principal oportunidade: a tela ainda trata dados em tempo real como se fossem dados históricos, então o operador não percebe quando é "agora" vs "janela". Segundo: copy tem resquícios do schema antigo (anomalia-vs-baseline) que não combinam com os alertas novos (viatura, veículo parado).

---

## Usabilidade

| Achado | Severidade | Recomendação |
|---|---|---|
| Tooltip do gráfico horário mostra `23:00 / veículos : 719` — espaço antes dos dois-pontos, label minúsculo inconsistente com o resto da UI. | 🟡 Moderado | Recharts `formatter` → devolve `["719", "veículos"]` e usa `labelFormatter` pra título; ajusta `itemStyle`/`labelStyle` pra casar com o resto. |
| Legenda "últimas 4 horas" (chip) contradiz o conteúdo (gráfico cobre 5 horas: 19–00). Conta buckets, não janela. | 🟡 Moderado | Trocar pra "{N} horas · início às HH:MM" ou somar a duração real entre primeiro e último bucket. |
| `AlertsPanel` mostra `formatPct(variation_pct)` → os alertas novos (viatura / veículo parado) têm `variation_pct=0`, então aparece `+0.0%` — ruído semanticamente vazio. | 🔴 Crítico | Só renderizar o badge quando `variation_pct !== 0`. Pros alertas event-driven, mostrar tag tipo "evento" ou o ícone da categoria no lugar. |
| Header do `AlertsPanel` diz "Anomalias detectadas em relação ao baseline histórico" — copy do schema antigo. | 🟡 Moderado | "Eventos e anomalias em tempo real" cobre os dois tipos. |
| "marcar como visto" é link underline 11px — affordance fraca, alvo pequeno. | 🟡 Moderado | Botão `btn-ghost` com ícone `Check` + aria-label "Marcar alerta como visto". |
| `FiltersBar`: texto "referência: últimos 30 dias" duplica o botão já selecionado acima. | 🟢 Menor | Remover — ou trocar por janela absoluta ("17 mar – 17 abr"). |
| Filtro de período é global mas o `MapView`/intensity usa escala absoluta fixa (50k ref). Uma câmera em "hoje" vai parecer sempre baixa. | 🟡 Moderado | Ou escalar a referência pelo `days` selecionado, ou expor a escala na legenda do mapa. |
| Card "Horário de pico" mostra `"—"` em estado frio — OK — mas KPI cards `"Média por hora"` e `"Fluxo total"` mostram `0` sem distinguir "nada capturado" de "capturado e zero". | 🟡 Moderado | Mostrar "—" quando `kpi.data_start == null`; reservar `0` só pra zero real. |
| `CaptureWindow` (texto de "Dados de X até Y") só aparece sob o título — não há repetição no gráfico, então ao scrollar o usuário esquece o recorte. | 🟢 Menor | Repetir a janela dentro do `HourlyFlowChart` (subtítulo ao lado do chip). |

---

## Hierarquia Visual

O que a visão pega primeiro: os 4 `KpiCard` (gradiente colorido + valor 3xl bold). Isso é correto — é o resumo. Depois vai pro gráfico grande (coluna 2/3) e pro painel de alertas (coluna 1/3). Boa diagonal.

Pontos de atenção:

- O pico de 719 no `HourlyFlowChart` visualmente anula o resto da curva — com uma única hora ativa, o eixo Y escala pro pico e as outras horas viram chão. Considerar `YAxis domain={[0, 'dataMax']}` com `dataMin` coerente, ou desenhar "sem dados" pras horas sem captura em vez de extrapolar pra zero (ver "Consistência" abaixo).
- Os 4 KpiCard usam 4 accents diferentes (brand/positive/warning/negative). Funciona como gradiente decorativo mas sinaliza coisa inexistente: "Horário de pico" não é warning, "Alertas ativos" muda de positive↔negative corretamente mas os dois primeiros são arbitrários. Sugere usar `brand` como default e só colorir com semântica (positive/negative pra variation).
- `VehicleTypeBreakdown`: pizza + legenda lado a lado. O valor numérico ao lado de cada tipo disputa com o percentual em parênteses. Reforçar hierarquia: valor `font-medium`, percentual `text-ink-soft`. (já está quase lá, só afinar.)

---

## Consistência

| Elemento | Problema | Recomendação |
|---|---|---|
| Cores vermelhas | `critical: #ef4444` e `negative: #f87171` são duas vermelhas próximas mas usadas indistintamente pros alertas. | Definir intenção: `negative` = métrica que piorou (variação -), `critical` = severidade máxima de alerta. Ou unificar. |
| Curva do gráfico | `type="monotone"` no `HourlyFlowChart` suaviza artificialmente — fluxo por hora é escalonado por natureza. | Trocar pra `type="linear"` ou `"stepAfter"` — transmite que cada valor é um bucket, não uma função contínua. |
| Zero vs. ausência | Horas sem captura viram 0 no gráfico, que visualmente é indistinguível de "zero veículos passaram". | No `hourly_series`, retornar `null` pras horas fora da janela `data_start..data_end`. Recharts aceita `connectNulls={false}` — linha fica cortada. |
| Tooltips | Cada chart redeclara `contentStyle` com os mesmos hex. | Extrair `chartTooltipStyle` em `lib/utils.ts` (ou um `<ChartTooltip>` wrapper). |
| Chip | `chip` em `AlertsPanel` mostra contagem (`{list.length}`), em `HourlyFlowChart` mostra descrição ("últimas N horas"). Papéis diferentes, mesma pílula. | Usar chip só pra rótulo-categoria; contagens merecem `badge` próprio (fundo brand/10, text-brand). |
| "Ranking de câmeras" | Barra de progresso usa `from-brand to-positive`. Ranking aqui não tem conotação de qualidade — só volume. | Gradiente single-tone `from-brand/60 to-brand`; ou intensidade log alinhada com o mapa. |

---

## Acessibilidade (check rápido WCAG 2.1 AA)

- **Contraste**:
  - `text-ink` (#e2e8f0) sobre `bg` (#0a0e1a) → ~14:1 ✓
  - `text-ink-muted` (#94a3b8) sobre `bg-card` (#121a2e) → ~5.9:1 ✓
  - `text-ink-soft` (#64748b) sobre `bg` (#0a0e1a) → ~4.1:1 — passa AA pra 14px+, **falha** abaixo disso. Usado no footer em 12px → ajustar pra `text-ink-muted` ou subir pra 14px.
  - Rotulo `"marcar como visto"` em 11px (`text-[11px]`) com `text-ink-muted` → **falha** AA pra texto pequeno. Subir pra 12px ou `text-ink`.
- **Touch targets**: `.btn` com `py-1.5 px-3 text-sm` ≈ 30px altura. Passa mínimo WCAG (24px), mas abaixo do Apple HIG 44px — em mobile/tablet os presets de período vão ficar difíceis.
- **Iconografia como único canal**: ✓ variação usa ícone + cor (TrendingUp/Down). Alertas usam ícone específico por severidade. OK pra daltônicos.
- **Mapa**: a intensidade só é transmitida por cor. Precisa de legenda com 3-4 steps nomeados ("baixo / moderado / alto / crítico") + número de referência.
- **ARIA**: ícones decorativos (`Siren`, `AlertTriangle`, etc.) deveriam ter `aria-hidden="true"` e o nível semântico aparecer no texto. O icon-only button "marcar como visto" (se virar botão) precisa de `aria-label`.
- **Foco**: tailwind default mostra ring. Confirmar que todos os botões custom (`.btn`, `.btn-primary`) têm `focus-visible:ring`. Atualmente não está no `globals.css`.

---

## UX Copy

- "Agregado das últimas horas de captação" → jargão. Melhor: "Veículos por hora, somatório do período ativo".
- "Fluxo total (período)" → redundante (o filtro já diz período). "Fluxo total" basta.
- "vs. período anterior (30 dias)" → OK, mas quando `days=1` vira "vs. período anterior (1 dias)". Pluralização falta.
- "pico médio: 536" → ambíguo. Tradução: "Volume na hora de pico: 536" ou só "veículos no pico: 536".
- "Anomalias detectadas em relação ao baseline histórico" → substituir por "Eventos e anomalias em tempo real".
- "tudo dentro do normal" / "requerem atenção" → boa. Humano e direto.
- "referência: últimos N dias" → já comentado, redundante.

---

## O Que Funciona Bem

- Paleta coerente, dark theme bem calibrado, gradientes usados com parcimônia.
- `KpiCard` com gradient + ícone + variação pill é um padrão sólido — alguém lê a tela inteira em 2 segundos.
- `AlertsPanel` com empty state (`CheckCircle2` verde + copy) é acolhedor, não vazio-hostil.
- `FiltersBar` com presets é mais rápido que date-picker pra o caso de uso (dashboard de relance).
- `CaptureWindow` sob o título resolve o problema de "o que é esse recorte?" — adição correta.
- `LocationRanking` com barra de progresso, variação e categoria em chip é informação-densa sem poluir.
- Token system bem nomeado (`bg-card`, `ink-muted`, `brand`, `positive`…) — facilita consistência.

---

## Top 3 Prioridades

### 1. Alertas "event-driven" têm tratamento visual próprio (🔴 Crítico)
Os alertas de viatura e veículo parado que acabamos de adicionar estão sendo renderizados com o badge `+0.0%` — visualmente parecem métricas com variação zero, o que é absurdo. A correção rápida é condicionar o badge a `variation_pct !== 0`; a correção bonita é introduzir um campo `kind` no Alert (`anomaly_baseline | event`) e renderizar um chip de categoria ("viatura", "parado", "fluxo acima do normal") no lugar. Atualiza também o subtítulo do painel pra "Eventos e anomalias em tempo real".

### 2. Distinguir "sem dados" de "zero" no gráfico e KPI cards (🟡 Moderado)
Hoje, horas sem captura aparecem como zero no `HourlyFlowChart` e como `0` nos KPI cards. Em um dashboard de stream ao vivo, isso é enganoso — o operador vai achar que "passaram zero veículos das 21h às 00h" quando na verdade "a câmera não rodou nessa janela". Mudar para: (a) `hourly_series` retorna pontos só dentro da janela real de captura; (b) KPIs mostram `—` quando `data_start == null`; (c) curva do gráfico vira `stepAfter` pra reforçar "cada bucket é discreto".

### 3. Semântica de cor mais enxuta + legenda no mapa (🟡 Moderado)
Hoje há duas vermelhas (`critical` vs `negative`) sendo usadas sem critério claro, 4 accents decorativos nos KPI cards sem semântica, e intensidade do mapa transmitida exclusivamente por cor. Propor: (a) `critical` reservado pra severidade CRITICAL de alerta; `negative` pra variações negativas; (b) KPI cards com `brand` default, `positive`/`negative` só para delta; (c) mapa ganha uma legenda compacta no canto com 4 marcos ("≤100 / ≤1k / ≤10k / ≥50k") e as cores equivalentes.

---

## Não Crítico, Mas Considerar

- Extrair `<ChartCard>` wrapper (`.card p-5` + header padrão com título/subtítulo/chip-opcional). Hoje o pattern repete em 6 componentes.
- `ChartTooltip` shared component — o mesmo objeto de estilo aparece 4 vezes.
- Shortcut de teclado pra trocar período (`[1]` / `[7]` / `[30]`) — painel de pilotos acostuma com teclado.
- Estado de loading: hoje `loadAll` deixa tudo stale enquanto busca. Considerar skeleton cards (`animate-pulse`) no lugar de "carregando…" no footer.
