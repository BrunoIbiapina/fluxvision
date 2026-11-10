"use client";

import Sheet from "@/components/Sheet";
import type { RankingRow } from "@/lib/types";
import { categoryLabel, cn, formatNumber, formatPct } from "@/lib/utils";

interface Props {
  rows: RankingRow[];
  limit?: number;
}

/** Câmeras ordenadas pelo fluxo acumulado no período. */
export default function LocationRanking({ rows, limit = 8 }: Props) {
  const data = rows.slice(0, limit);

  return (
    <Sheet title="Câmeras por volume">
      {data.length === 0 ? (
        <p className="text-ink-muted">Nenhuma câmera com contagem no período.</p>
      ) : (
        <ol className="space-y-4">
          {data.map((r) => {
            const moved = Math.abs(r.variation_pct) >= 0.05;
            return (
              <li key={r.camera_id} className="flex items-baseline justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-semibold leading-snug">{r.camera_name}</p>
                  <p className="text-sm text-ink-muted">
                    {r.city_name}, {categoryLabel(r.category).toLowerCase()}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-display text-2xl font-semibold leading-none tabular-nums">
                    {formatNumber(r.total)}
                  </p>
                  {moved && (
                    <p
                      className={cn(
                        "mt-1 text-sm tabular-nums",
                        r.variation_pct > 0 ? "text-positive" : "text-negative"
                      )}
                    >
                      {formatPct(r.variation_pct)}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Sheet>
  );
}
