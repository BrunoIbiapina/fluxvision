"use client";

import { useEffect, useState } from "react";

import AlertsPanel from "@/components/AlertsPanel";
import { getAlerts } from "@/lib/api";
import type { Alert } from "@/lib/types";

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [onlyOpen, setOnlyOpen] = useState(true);

  useEffect(() => {
    getAlerts(onlyOpen).then(setAlerts).catch(() => {});
  }, [onlyOpen]);

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Alertas</h1>
          <p className="text-sm text-ink-muted mt-1">
            Eventos de fluxo fora do padrão — picos, quedas bruscas e
            aglomerações sustentadas.
          </p>
        </div>
        <div className="flex gap-1">
          <button
            className={`px-3 py-1.5 text-xs rounded-md border ${
              onlyOpen
                ? "bg-brand/15 border-brand/40 text-brand"
                : "border-bg-border text-ink-muted hover:text-ink"
            }`}
            onClick={() => setOnlyOpen(true)}
          >
            Abertos
          </button>
          <button
            className={`px-3 py-1.5 text-xs rounded-md border ${
              !onlyOpen
                ? "bg-brand/15 border-brand/40 text-brand"
                : "border-bg-border text-ink-muted hover:text-ink"
            }`}
            onClick={() => setOnlyOpen(false)}
          >
            Todos
          </button>
        </div>
      </header>

      <AlertsPanel alerts={alerts} />
    </div>
  );
}
