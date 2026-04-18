"use client";

import { TrendingDown, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";

import { cn, formatNumber, formatPct } from "@/lib/utils";

interface Props {
  label: string;
  value: number | string;
  subValue?: string;
  variationPct?: number;
  icon?: ReactNode;
  accent?: "brand" | "positive" | "warning" | "negative";
}

const ACCENT: Record<NonNullable<Props["accent"]>, string> = {
  brand: "from-brand/20 to-transparent text-brand",
  positive: "from-positive/20 to-transparent text-positive",
  warning: "from-warning/20 to-transparent text-warning",
  negative: "from-negative/20 to-transparent text-negative",
};

export default function KpiCard({
  label,
  value,
  subValue,
  variationPct,
  icon,
  accent = "brand",
}: Props) {
  const isPositive = (variationPct ?? 0) >= 0;
  return (
    <div className="card p-5 relative overflow-hidden">
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-br opacity-70 pointer-events-none",
          ACCENT[accent]
        )}
      />
      <div className="relative z-10">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wider text-ink-muted">
            {label}
          </span>
          {icon && <span className="opacity-80">{icon}</span>}
        </div>

        <div className="mt-3 text-3xl font-bold tracking-tight">
          {typeof value === "number" ? formatNumber(value) : value}
        </div>

        <div className="mt-2 flex items-center gap-2 text-xs">
          {subValue && <span className="text-ink-muted">{subValue}</span>}
          {typeof variationPct === "number" && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium",
                isPositive
                  ? "bg-positive/10 text-positive"
                  : "bg-negative/10 text-negative"
              )}
            >
              {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {formatPct(variationPct)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
