---
version: 1
slug: "web-app-page-tsx"
primary_target: "web/app/page.tsx"
related_targets: ["web/app/layout.tsx"]
---

# Painel FluxVision (todas as rotas de `web/app`)

Modo: Operate. Público desta superfície: visitante de portfólio, poucos minutos, notebook ou celular, de dia. Por isso o tema padrão é claro; o escuro acompanha o sistema.

Tarefa: entender que há contagem real por visão computacional e navegar entre contagem, alertas, câmeras, envio de vídeo e transmissão ao vivo. Fica intocado: rotas, chamadas de API, dados e funcionalidades.

## Direction contract

THESIS: o painel é a ficha de contagem volumétrica classificada que a engenharia de tráfego entrega, preenchida pela câmera. Recusa a faixa de cartões de KPI sobre fundo escuro com acento neon.

OWN-WORLD: papel técnico branco-frio (#F3F5F4) com folhas brancas de cantos quase retos e fios de 1 px; tinta #12171A; trilho em verde de placa de indicação (#0B5A3C); amarelo de faixa (#F2B705) só para seleção e para o eixo da faixa de fluxo; vermelho de regulamentação só para alerta crítico. Letra Overpass (derivada da letra de placa rodoviária) e Overpass Mono nos numerais de tabela. Marcas de dado em tons de tinta, sem uma cor por classe.

STORY: o visitante lê quantos veículos a câmera contou e em que janela, vê a contagem por classe e hora, e segue para o vídeo anotado ou a transmissão ao vivo.

FIRST VIEWPORT: trilho verde à esquerda com o nome e a navegação em texto; à direita, título da página e seletor de período num único controle segmentado; abaixo, a folha principal com o total em frase, a faixa de fluxo de ponta a ponta e a tabela de contagem classificada alinhada a ela; alertas agrupados por tipo na coluna ao lado.

SIGNATURE: a faixa de fluxo, uma pista desenhada em SVG cuja largura em cada hora é proporcional ao volume contado, com eixo tracejado em amarelo de faixa; passar o ponteiro por uma hora destaca a linha correspondente na tabela.

FORM: ficha de contagem volumétrica classificada, posição 3 da lista própria, seed f019fefd.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
