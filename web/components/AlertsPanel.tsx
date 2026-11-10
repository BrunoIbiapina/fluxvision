"use client";

import { Check, CircleCheck, Info, Siren, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";

import Sheet from "@/components/Sheet";
import type { Alert, AlertLevel } from "@/lib/types";
import { ackAlert } from "@/lib/api";
import {
  ALERT_LEVEL_COLOR,
  ALERT_LEVEL_LABEL,
  formatAlertMoment,
  formatAlertTitle,
} from "@/lib/alertGroups";
import { cn, formatNumber, formatPct } from "@/lib/utils";

interface Props {
  alerts: Alert[];
}

const LEVEL_ICON: Record<AlertLevel, typeof Siren> = {
  critical: Siren,
  warning: TriangleAlert,
  info: Info,
};

// Variação só faz sentido em anomalia estatística; alerta de evento vem com 0.
function hasMeaningfulVariation(v: number | undefined | null): v is number {
  return typeof v === "number" && Math.abs(v) >= 0.05;
}

export default function AlertsPanel({ alerts }: Props) {
  const [list, setList] = useState(alerts);
  const [ackError, setAckError] = useState<string | null>(null);

  useEffect(() => {
    setList(alerts);
  }, [alerts]);

  async function handleAck(id: number) {
    setAckError(null);
    try {
      await ackAlert(id);
      setList((xs) => xs.filter((a) => a.id !== id));
    } catch (err: any) {
      setAckError(
        `Não foi possível marcar o alerta ${id} como visto: ${
          err?.message ?? "a API não respondeu"
        }. Tente de novo.`
      );
    }
  }

  return (
    <Sheet
      title={
        list.length === 1 ? "1 alerta" : `${formatNumber(list.length)} alertas`
      }
    >
      {ackError && (
        <p role="alert" className="alert-error mb-3">
          {ackError}
        </p>
      )}
      {list.length === 0 ? (
        <EmptyAlerts />
      ) : (
        <ul>
          {list.map((a) => {
            const Icon = LEVEL_ICON[a.level];
            const color = ALERT_LEVEL_COLOR[a.level];
            const label = ALERT_LEVEL_LABEL[a.level];
            return (
              <li
                key={a.id}
                className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start"
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <Icon size={18} className={cn("mt-0.5 shrink-0", color)} aria-hidden />
                  <div className="min-w-0">
                    <p className="font-semibold leading-snug">
                      <span className="sr-only">{label}: </span>
                      {formatAlertTitle(a.title)}
                      {hasMeaningfulVariation(a.variation_pct) && (
                        <span className={cn("ml-2 text-sm tabular-nums", color)}>
                          {formatPct(a.variation_pct)}
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 max-w-[75ch] text-sm text-ink-muted">
                      {a.message}
                    </p>
                    <p className="mt-1 text-xs text-ink-soft">
                      {formatAlertMoment(a.created_at)}
                    </p>
                  </div>
                </div>
                {!a.acknowledged && (
                  <button
                    type="button"
                    onClick={() => handleAck(a.id)}
                    className="btn shrink-0 self-start"
                  >
                    <Check size={16} aria-hidden />
                    Marcar como visto
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Sheet>
  );
}

function EmptyAlerts() {
  return (
    <div className="flex items-center gap-3 py-2 text-ink-muted">
      <CircleCheck size={20} className="shrink-0 text-positive" aria-hidden />
      <p>Nenhum alerta aberto. Pedestre na pista, veículo parado e variação fora do padrão aparecem aqui.</p>
    </div>
  );
}
