"use client";

import { ArrowDown, ArrowUp, Minus } from "lucide-react";

import type { RankingRow } from "@/lib/types";
import { categoryLabel, cn, formatNumber, formatPct } from "@/lib/utils";

interface Props {
  rows: RankingRow[];
  limit?: number;
}

// Mantém o nome `LocationRanking` pra não quebrar imports — a visão agora
// é por câmera (cada câmera é um ponto de análise, a cidade é só um rótulo).
export default function LocationRanking({ rows, limit = 8 }: Props) {
  const data = rows.slice(0, limit);
  const max = Math.max(1, ...data.map((r) => r.total));

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold">Ranking de câmeras</h3>
          <p className="text-xs text-ink-muted">
            Maior fluxo acumulado no período
          </p>
        </div>
      </div>

      {data.length === 0 && (
        <p className="text-xs text-ink-muted">
          Nenhuma câmera com dados no período.
        </p>
      )}

      <ul className="space-y-3">
        {data.map((r, i) => {
          const pct = (r.total / max) * 100;
          const Icon =
            r.variation_pct > 1 ? ArrowUp : r.variation_pct < -1 ? ArrowDown : Minus;
          const color =
            r.variation_pct > 1
              ? "text-positive"
              : r.variation_pct < -1
              ? "text-negative"
              : "text-ink-muted";
          return (
            <li key={r.camera_id}>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-5 text-ink-muted tabular-nums text-xs">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="truncate">
                    {r.camera_name}
                    <span className="text-ink-muted"> · {r.city_name}</span>
                  </span>
                  <span className="chip hidden sm:inline-flex">
                    {categoryLabel(r.category)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold tabular-nums">
                    {formatNumber(r.total)}
                  </span>
                  <span className={cn("inline-flex items-center gap-0.5 text-xs w-14 justify-end", color)}>
                    <Icon size={12} />
                    {formatPct(r.variation_pct, false)}
                  </span>
                </div>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-bg-elevated overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-brand to-positive"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
