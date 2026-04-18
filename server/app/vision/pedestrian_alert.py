"""Detector de pedestre na via.

Emite um Alert WARNING quando um track de `person` permanece dentro da
faixa vertical central do frame (a "zona de risco" que normalmente
corresponde à pista) por mais de `min_duration_s`.

Por que só faixa vertical e não uma ROI poligonal? A esmagadora maioria
das câmeras de tráfego que encaramos neste projeto enquadra a pista no
miolo do frame. Uma fração vertical (top=0.35, bottom=0.75 por padrão) já
elimina calçada de cima e calçada de baixo, e é trivialmente configurável
por câmera se precisarmos mais tarde. Poligonal exigiria UI de anotação
— escopo pra fase de produção.

Rate limit:
    - 1 alerta por track_id (nunca repete pro mesmo pedestre).
    - E ainda um intervalo global por câmera (`alert_interval_s`) pra não
      estourar a lista de alertas quando passa um grupo grande.

Mesma filosofia do StoppedVehicleDetector: o detector não tenta
"classificar acidente" ou "atravessando indevidamente" — ele sinaliza
presença anômala de pedestre na via e o operador investiga pela câmera.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Set

from .tracker import Track


@dataclass
class PedestrianEvent:
    """Uma pessoa permaneceu na zona de risco por tempo suficiente."""

    track_id: int
    cx: float
    cy: float
    duration_s: float


class PedestrianRoadwayDetector:
    """Mantém estado por track_id de quando entrou na zona de risco."""

    def __init__(
        self,
        zone_top_frac: float = 0.35,
        zone_bottom_frac: float = 0.75,
        min_duration_s: float = 1.5,
        alert_interval_s: float = 20.0,
    ) -> None:
        if not 0.0 <= zone_top_frac < zone_bottom_frac <= 1.0:
            raise ValueError(
                "zone_top_frac deve ser < zone_bottom_frac e ambas em [0, 1]"
            )
        self.zone_top_frac = zone_top_frac
        self.zone_bottom_frac = zone_bottom_frac
        self.min_duration_s = min_duration_s
        self.alert_interval_s = alert_interval_s
        # track_id → timestamp em que o track entrou na zona. Limpo quando
        # sai da zona (pessoa voltou pra calçada) ou quando o tracker
        # descarta o track.
        self._enter_ts: Dict[int, float] = {}
        # track_ids que já receberam alerta nessa sessão — nunca alerta
        # de novo pro mesmo pedestre, mesmo se sair e voltar.
        self._alerted: Set[int] = set()
        self._last_alert_ts: float = 0.0

    def update(
        self,
        active_tracks: List[Track],
        expired_tracks: List[Track],
        frame_w: int,
        frame_h: int,
        ts: float,
    ) -> List[PedestrianEvent]:
        """Processa os tracks ativos e expirados, devolve eventos novos.

        Args:
            active_tracks: tracks que o `IoUTracker` retornou neste update.
            expired_tracks: tracks removidos por `max_miss` neste update.
            frame_w/frame_h: dimensões do frame (pra calcular a zona).
            ts: timestamp em segundos relativo ao início do stream.
        """
        zone_y1 = frame_h * self.zone_top_frac
        zone_y2 = frame_h * self.zone_bottom_frac

        events: List[PedestrianEvent] = []
        seen_ids: Set[int] = set()

        for tr in active_tracks:
            if tr.vehicle_type != "person":
                continue
            seen_ids.add(tr.track_id)
            if tr.track_id in self._alerted:
                continue

            cy = (tr.y1 + tr.y2) / 2.0
            in_zone = zone_y1 <= cy <= zone_y2

            if not in_zone:
                # Saiu da zona — reseta o relógio pra esse track.
                self._enter_ts.pop(tr.track_id, None)
                continue

            # Dentro da zona. Primeira vez? Marca timestamp de entrada.
            if tr.track_id not in self._enter_ts:
                self._enter_ts[tr.track_id] = ts
                continue

            duration = ts - self._enter_ts[tr.track_id]
            if duration < self.min_duration_s:
                continue

            # Rate limit global por câmera — evita avalanche de alertas
            # se um grupo atravessa ao mesmo tempo.
            if (ts - self._last_alert_ts) < self.alert_interval_s:
                continue

            self._alerted.add(tr.track_id)
            self._last_alert_ts = ts
            cx = (tr.x1 + tr.x2) / 2.0
            events.append(
                PedestrianEvent(
                    track_id=tr.track_id,
                    cx=cx,
                    cy=cy,
                    duration_s=duration,
                )
            )

        # Limpa estado de tracks que expiraram — não vão voltar com o
        # mesmo id, então não precisamos continuar guardando.
        for tr in expired_tracks:
            self._enter_ts.pop(tr.track_id, None)

        # Garbage-collect `_enter_ts` de tracks que simplesmente não
        # apareceram neste update (o tracker ainda pode estar mantendo
        # via max_miss, mas a entrada no dict vai acabar desatualizada).
        stale = [
            tid for tid in self._enter_ts.keys() if tid not in seen_ids
        ]
        for tid in stale:
            self._enter_ts.pop(tid, None)

        return events
