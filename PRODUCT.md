# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Quem abre o painel hoje é um visitante de portfólio: recrutador ou cliente em potencial que olha por poucos minutos, em notebook ou celular, e precisa entender o que o produto faz sem explicação. O público que o produto atende, segundo `docs/SPECIFICATION.md`, são secretarias de segurança pública, gestores de mobilidade urbana, organizadores de eventos e pesquisadores urbanos.

## Product Purpose

O FluxVision lê vídeo de câmera de rua (arquivo enviado ou transmissão ao vivo), detecta e acompanha veículos e pedestres e entrega contagens por hora, dia e mês, ranking de câmeras, mapa de calor, comparativos e alertas. Sucesso para o visitante: entender em uma tela que há visão computacional de verdade por trás dos números.

## Positioning

Contagem por cruzamento de linha virtual com rastreamento próprio (IoU tracker + NMS entre classes a IoU 0.6), separando pedestre de veículo, sobre YOLO/RT-DETR, com o vídeo anotado e a transmissão ao vivo visíveis no painel.

## Operating Context

Demonstração local com uma cidade (Teresina) e uma câmera (Avenida Rio Poty). O banco pode estar sem contagens no período e com muitos alertas de pedestre na via acumulados; as telas precisam ficar boas nesse estado.

## Capabilities and Constraints

- Rotas: `/` (visão geral), `/analytics`, `/comparison`, `/heatmap`, `/alerts`, `/cameras`, `/upload`, `/live`, `/videos/[id]`.
- Front em Next.js 14, Tailwind 3, Recharts, Leaflet e lucide-react; back em FastAPI, separado, falando por HTTP.
- O redesenho troca visual e composição de cada tela. Rotas, dados, chamadas de API e funcionalidades ficam iguais.
- Fuso dos dados: `America/Sao_Paulo`.

## Brand Commitments

Nome FluxVision. Sem logotipo desenhado: hoje a marca é a letra F num quadrado.

## Evidence on Hand

Dados reais do banco local (`server/data/fluxvision.db`), vídeos anotados e mapas de calor em `server/data/`. Não há clientes, depoimentos nem métricas de adoção: nada disso pode aparecer na interface.

## Product Principles

- O número mostrado sempre informa a janela de dados a que se refere.
- Pedestre nunca entra na contagem de veículos.
- Controle sem função real não aparece na tela.
- Estado sem dados explica o próximo passo.
