"""Detectores de anomalia rodando em cima dos tracks do `IoUTracker`.

Abordagem pragmática: em vez de tentar classificar "é acidente?" (caro e
propenso a falso positivo), detectamos sinais objetivos e deixamos o
operador interpretar:

    - `StoppedVehicleDetector`: veículo parado por muito tempo em área que
      deveria ser de fluxo. Emite WARNING após ~20s e CRITICAL após ~60s.

Decisões de design:

    - Estado por track_id (não por posição física). Assim dois carros que
      param no mesmo lugar em momentos distintos geram dois alertas.
    - "Âncora deslizante": enquanto o track se move, reancoramos posição e
      timestamp. Quando ele estabiliza perto da âncora, o tempo parado
      começa a correr. Evita falso positivo com veículo que entra no
      frame e sai logo (path[0] vs path[-1] seria sempre longo).
    - Descarta tracks em ROI de borda (margem configurável). Calçadas,
      estacionamentos adjacentes e tráfego transversal costumam aparecer
      nas bordas — ignorar reduz ruído.
    - Semáforo/farol ainda pode gerar falso positivo. A mitigação MVP é
      colocar `warn_after_s` acima do ciclo típico do semáforo (>= 20s).
      Mitigação futura: máscara de "zonas de parada permitida" por câmera.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Dict, List, Optional

from .tracker import Track

logger = logging.getLogger(__name__)


@dataclass
class AnomalyEvent:
    """Evento emitido pelo detector. O worker decide o que persistir."""

    kind: str                  # "stopped_vehicle"
    level: str                 # "warning" | "critical"
    track_id: int
    vehicle_type: str
    stopped_for_s: float
    cx: float
    cy: float


@dataclass
class _StopState:
    # Âncora deslizante: última posição considerada "parada o suficiente".
    anchor_ts: float
    anchor_x: float
    anchor_y: float
    alerted_warn: bool = False
    alerted_crit: bool = False


class StoppedVehicleDetector:
    """Dispara eventos quando um track permanece quase imóvel por muito tempo.

    A heurística é deliberadamente conservadora — preferimos perder casos
    marginais a inundar o operador com falso positivo. Thresholds expostos
    para ajuste por câmera no futuro.
    """

    def __init__(
        self,
        stop_px: float = 20.0,
        warn_after_s: float = 20.0,
        critical_after_s: float = 60.0,
        roi_margin_frac: float = 0.08,
    ) -> None:
        self.stop_px = stop_px
        self.warn_after_s = warn_after_s
        self.critical_after_s = critical_after_s
        self.roi_margin_frac = roi_margin_frac
        self._states: Dict[int, _StopState] = {}

    # ------------------------------------------------------------------ API
    def update(
        self,
        active_tracks: List[Track],
        expired_tracks: List[Track],
        frame_w: int,
        frame_h: int,
        ts: float,
    ) -> List[AnomalyEvent]:
        events: List[AnomalyEvent] = []
        margin_x = frame_w * self.roi_margin_frac
        margin_y = frame_h * self.roi_margin_frac

        for tr in active_tracks:
            # Ignora bordas: calçada, estacionamento adjacente, tráfego
            # cruzando perpendicular só no canto.
            if tr.cx < margin_x or tr.cx > (frame_w - margin_x):
                continue
            if tr.cy < margin_y or tr.cy > (frame_h - margin_y):
                continue

            st = self._states.get(tr.track_id)
            if st is None:
                # Primeira vez que vemos este track — ancora aqui.
                self._states[tr.track_id] = _StopState(
                    anchor_ts=ts, anchor_x=tr.cx, anchor_y=tr.cy
                )
                continue

            dx = tr.cx - st.anchor_x
            dy = tr.cy - st.anchor_y
            dist = (dx * dx + dy * dy) ** 0.5

            if dist > self.stop_px:
                # Track andou — reancora e zera alertas.
                st.anchor_ts = ts
                st.anchor_x = tr.cx
                st.anchor_y = tr.cy
                st.alerted_warn = False
                st.alerted_crit = False
                continue

            stopped_for = ts - st.anchor_ts

            # Critical primeiro (se aplicável) pra não duplicar com warning
            # na mesma rodada quando o track bateu os dois thresholds juntos.
            if stopped_for >= self.critical_after_s and not st.alerted_crit:
                st.alerted_crit = True
                events.append(
                    AnomalyEvent(
                        kind="stopped_vehicle",
                        level="critical",
                        track_id=tr.track_id,
                        vehicle_type=tr.vehicle_type,
                        stopped_for_s=stopped_for,
                        cx=tr.cx,
                        cy=tr.cy,
                    )
                )
            elif stopped_for >= self.warn_after_s and not st.alerted_warn:
                st.alerted_warn = True
                events.append(
                    AnomalyEvent(
                        kind="stopped_vehicle",
                        level="warning",
                        track_id=tr.track_id,
                        vehicle_type=tr.vehicle_type,
                        stopped_for_s=stopped_for,
                        cx=tr.cx,
                        cy=tr.cy,
                    )
                )

        # Libera memória de tracks que o tracker já descartou.
        for tr in expired_tracks:
            self._states.pop(tr.track_id, None)

        return events

    def clear(self) -> None:
        self._states.clear()
