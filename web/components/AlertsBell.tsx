"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { getAlerts, getKpis } from "@/lib/api";
import {
  ALERT_LEVEL_COLOR,
  type AlertGroup,
  formatAlertMoment,
  formatAlertTitle,
  groupAlertsByKind,
} from "@/lib/alertGroups";
import { cn, formatNumber } from "@/lib/utils";

const REFRESH_MS = 30_000;

/**
 * Sino do topo: mostra quantos alertas estão abertos e abre um painel com os
 * tipos agrupados. A lista completa fica na tela Alertas.
 */
export default function AlertsBell() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [total, setTotal] = useState<number | null>(null);
  const [groups, setGroups] = useState<AlertGroup[]>([]);
  const [sampleSize, setSampleSize] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      try {
        const [kpi, alerts] = await Promise.all([getKpis(1), getAlerts(true)]);
        if (cancelled) return;
        setTotal(Math.max(kpi.active_alerts, alerts.length));
        setGroups(groupAlertsByKind(alerts));
        setSampleSize(alerts.length);
      } catch {
        // API fora do ar: o estado da API ao lado já avisa; o sino fica sem número.
        if (!cancelled) setTotal(null);
      }
    }
    refresh();
    const t = setInterval(refresh, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [path]);

  // Fecha ao trocar de tela, com Esc e ao clicar fora.
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  const count = total ?? 0;
  const label =
    total === null
      ? "Alertas"
      : count === 0
      ? "Nenhum alerta aberto"
      : `${formatNumber(count)} alertas abertos`;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="painel-alertas"
        aria-label={label}
        className={cn(
          "inline-flex h-11 items-center gap-1.5 rounded-md px-2.5 text-sm font-semibold hover:bg-bg-elevated",
          count > 0 ? "text-ink" : "text-ink-muted"
        )}
      >
        <Bell size={18} aria-hidden />
        {count > 0 && (
          <span className="text-[15px] font-bold leading-none tabular-nums">
            {formatNumber(count)}
          </span>
        )}
      </button>

      {open && (
        <div
          id="painel-alertas"
          role="dialog"
          aria-label="Alertas abertos"
          className="card fixed inset-x-4 top-[6.75rem] z-[1100] p-4 shadow-overlay sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-1 sm:w-[22rem]"
        >
          <h2 className="font-display text-xl font-semibold leading-tight">
            {count === 0 ? "Nenhum alerta aberto" : label}
          </h2>

          {groups.length === 0 ? (
            <p className="mt-2 text-sm text-ink-muted">
              Pedestre na pista, veículo parado e variação fora do padrão
              aparecem aqui.
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {groups.map((g) => (
                <li
                  key={`${g.level}|${g.title}`}
                  className="flex items-baseline justify-between gap-4"
                >
                  <div className="min-w-0">
                    <p className={cn("font-semibold leading-snug", g.level === "critical" && ALERT_LEVEL_COLOR.critical)}>
                      {formatAlertTitle(g.title)}
                    </p>
                    <p className="text-sm text-ink-muted">
                      Último em {formatAlertMoment(g.latest)}
                    </p>
                  </div>
                  <p className="shrink-0 font-display text-2xl font-semibold leading-none tabular-nums">
                    {formatNumber(g.count)}
                  </p>
                </li>
              ))}
            </ul>
          )}

          {count > sampleSize && sampleSize > 0 && (
            <p className="mt-3 text-sm text-ink-muted">
              Contagem por tipo feita sobre os {formatNumber(sampleSize)} mais
              recentes.
            </p>
          )}

          <Link href="/alerts" className="btn mt-4 w-full">
            Abrir Alertas
          </Link>
        </div>
      )}
    </div>
  );
}
