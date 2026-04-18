"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { getCompare } from "@/lib/api";
import type { ComparePayload } from "@/lib/types";
import { formatNumber, formatPct } from "@/lib/utils";

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 19);
}

const PRESETS: Array<{
  label: string;
  build: () => { a: [Date, Date]; b: [Date, Date] };
}> = [
  {
    label: "Hoje vs. ontem",
    build: () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const yest = new Date(today);
      yest.setDate(yest.getDate() - 1);
      return {
        a: [today, new Date()],
        b: [yest, today],
      };
    },
  },
  {
    label: "Semana atual vs. anterior",
    build: () => {
      const end = new Date();
      const a0 = new Date(end);
      a0.setDate(end.getDate() - 7);
      const b0 = new Date(end);
      b0.setDate(end.getDate() - 14);
      return { a: [a0, end], b: [b0, a0] };
    },
  },
  {
    label: "Mês atual vs. anterior",
    build: () => {
      const end = new Date();
      const a0 = new Date(end);
      a0.setDate(1);
      const b0 = new Date(a0);
      b0.setMonth(b0.getMonth() - 1);
      return { a: [a0, end], b: [b0, a0] };
    },
  },
  {
    label: "Últimos 30 vs. 30 anteriores",
    build: () => {
      const end = new Date();
      const a0 = new Date(end);
      a0.setDate(end.getDate() - 30);
      const b0 = new Date(a0);
      b0.setDate(a0.getDate() - 30);
      return { a: [a0, end], b: [b0, a0] };
    },
  },
];

export default function ComparisonPage() {
  const [preset, setPreset] = useState(0);
  const [granularity, setGran] = useState<"hour" | "day" | "month">("day");
  const [data, setData] = useState<ComparePayload | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const { a, b } = PRESETS[preset].build();
    getCompare(isoDate(a[0]), isoDate(a[1]), isoDate(b[0]), isoDate(b[1]), granularity)
      .then(setData)
      .catch((e) => setErr(e.message));
  }, [preset, granularity]);

  const chart = mergeSeries(data);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Comparativo histórico</h1>
        <p className="text-sm text-ink-muted mt-1">
          Avalie variações entre períodos, turnos, semanas e meses para
          detectar tendências e anomalias estruturais.
        </p>
      </header>

      <div className="card p-3 flex flex-wrap items-center gap-2">
        {PRESETS.map((p, i) => (
          <button
            key={p.label}
            className={`px-3 py-1.5 text-xs rounded-md border ${
              preset === i
                ? "bg-brand/15 border-brand/40 text-brand"
                : "border-bg-border text-ink-muted hover:text-ink"
            }`}
            onClick={() => setPreset(i)}
          >
            {p.label}
          </button>
        ))}
        <div className="mx-2 h-6 w-px bg-bg-border" />
        {(["hour", "day", "month"] as const).map((g) => (
          <button
            key={g}
            className={`px-3 py-1.5 text-xs rounded-md border ${
              granularity === g
                ? "bg-brand/15 border-brand/40 text-brand"
                : "border-bg-border text-ink-muted hover:text-ink"
            }`}
            onClick={() => setGran(g)}
          >
            {g}
          </button>
        ))}
      </div>

      {err && (
        <div className="card p-4 border-negative/40 bg-negative/10 text-negative text-sm">
          {err}
        </div>
      )}

      {data && (
        <>
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card p-5">
              <div className="text-xs uppercase tracking-wider text-ink-muted">
                Período A
              </div>
              <div className="text-lg font-semibold mt-1">{data.label_a}</div>
              <div className="mt-3 text-3xl font-bold">
                {formatNumber(data.total_a)}
              </div>
              <div className="text-xs text-ink-muted">veículos contados</div>
            </div>
            <div className="card p-5">
              <div className="text-xs uppercase tracking-wider text-ink-muted">
                Período B (referência)
              </div>
              <div className="text-lg font-semibold mt-1">{data.label_b}</div>
              <div className="mt-3 text-3xl font-bold">
                {formatNumber(data.total_b)}
              </div>
              <div className="text-xs text-ink-muted">veículos contados</div>
            </div>
            <div
              className={`card p-5 ${
                data.variation_pct >= 0 ? "bg-positive/5" : "bg-negative/5"
              }`}
            >
              <div className="text-xs uppercase tracking-wider text-ink-muted">
                Variação A vs. B
              </div>
              <div
                className={`mt-3 text-4xl font-bold ${
                  data.variation_pct >= 0 ? "text-positive" : "text-negative"
                }`}
              >
                {formatPct(data.variation_pct)}
              </div>
              <div className="text-xs text-ink-muted mt-1">
                {data.variation_pct >= 0
                  ? "fluxo cresceu em relação ao período de referência"
                  : "fluxo caiu em relação ao período de referência"}
              </div>
            </div>
          </section>

          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold">
                  Série comparada — A vs. B
                </h3>
                <p className="text-xs text-ink-muted">
                  Barras lado a lado para cada bucket
                </p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={360}>
              <BarChart data={chart} margin={{ left: -10, right: 10 }}>
                <CartesianGrid stroke="#1e2a47" strokeDasharray="3 3" />
                <XAxis dataKey="bucket" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "#121a2e",
                    border: "1px solid #1e2a47",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "#94a3b8" }}
                  formatter={(v: number) => formatNumber(v)}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="a" fill="#38bdf8" name="Período A" />
                <Bar dataKey="b" fill="#64748b" name="Período B" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}

function mergeSeries(
  d: ComparePayload | null
): Array<{ bucket: string; a: number; b: number }> {
  if (!d) return [];
  const map = new Map<string, { a: number; b: number }>();
  const keyForA = (s: string) => s.slice(5); // tira ano para alinhar
  d.series_a.forEach((p) => {
    map.set(keyForA(p.bucket), { a: p.total, b: 0 });
  });
  d.series_b.forEach((p) => {
    const k = keyForA(p.bucket);
    const cur = map.get(k) ?? { a: 0, b: 0 };
    cur.b = p.total;
    map.set(k, cur);
  });
  return Array.from(map.entries())
    .sort((x, y) => x[0].localeCompare(y[0]))
    .map(([bucket, v]) => ({ bucket, ...v }));
}
