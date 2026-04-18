"use client";

import { AlertTriangle, CheckCircle2, Info, Siren } from "lucide-react";
import { useEffect, useState } from "react";

import type { Alert } from "@/lib/types";
import { ackAlert } from "@/lib/api";
import { cn, formatPct } from "@/lib/utils";

interface Props {
  alerts: Alert[];
  compact?: boolean;
}

const STYLE = {
  critical: { icon: Siren, color: "text-critical", bg: "bg-critical/10 border-critical/30" },
  warning:  { icon: AlertTriangle, color: "text-warning",  bg: "bg-warning/10 border-warning/30" },
  info:     { icon: Info, color: "text-brand", bg: "bg-brand/10 border-brand/30" },
};

export default function AlertsPanel({ alerts, compact = false }: Props) {
  const [list, setList] = useState(alerts);

  // Mantém o estado local sincronizado quando a lista de alertas vinda do pai muda
  useEffect(() => {
    setList(alerts);
  }, [alerts]);

  async function handleAck(id: number) {
    try {
      await ackAlert(id);
      setList((xs) => xs.filter((a) => a.id !== id));
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold">Alertas ativos</h3>
          <p className="text-xs text-ink-muted">
            Anomalias detectadas em relação ao baseline histórico
          </p>
        </div>
        <span className="chip">{list.length}</span>
      </div>

      {list.length === 0 ? (
        <div className="text-center py-10 text-ink-muted text-sm flex flex-col items-center gap-2">
          <CheckCircle2 size={28} className="text-positive" />
          Sem alertas ativos no momento.
        </div>
      ) : (
        <ul className={cn("space-y-3", compact && "max-h-72 overflow-auto pr-1")}>
          {list.map((a) => {
            const s = STYLE[a.level];
            const Icon = s.icon;
            return (
              <li
                key={a.id}
                className={cn("rounded-lg border p-3 flex items-start gap-3", s.bg)}
              >
                <Icon size={18} className={cn("mt-0.5 shrink-0", s.color)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium truncate">{a.title}</span>
                    <span className={cn("text-xs font-semibold", s.color)}>
                      {formatPct(a.variation_pct)}
                    </span>
                  </div>
                  <p className="text-xs text-ink-muted mt-0.5">{a.message}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      onClick={() => handleAck(a.id)}
                      className="text-[11px] text-ink-muted hover:text-ink underline underline-offset-2"
                    >
                      marcar como visto
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
