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

import PageHeader from "@/components/PageHeader";
import SegmentedControl from "@/components/SegmentedControl";
import Sheet from "@/components/Sheet";
import { getCompare } from "@/lib/api";
import {
  CHART_AXIS,
  CHART_CURSOR,
  CHART_FONT_SIZE,
  CHART_GRID,
  CHART_TOOLTIP_LABEL_STYLE,
  CHART_TOOLTIP_STYLE,
} from "@/lib/chartTheme";
import type { ComparePayload } from "@/lib/types";
import { cn, formatNumber, formatPct } from "@/lib/utils";

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 19);
}

const PRESETS: Array<{
  label: string;
  build: () => { a: [Date, Date]; b: [Date, Date] };
}> = [
  {
    label: "Hoje e ontem",
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
    label: "Esta semana e a anterior",
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
    label: "Este mês e o anterior",
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
    label: "30 dias e os 30 anteriores",
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

const GRANULARITIES: Array<{ value: "hour" | "day" | "month"; label: string }> = [
  { value: "hour", label: "Por hora" },
  { value: "day", label: "Por dia" },
  { value: "month", label: "Por mês" },
];

export default function ComparisonPage() {
  const [preset, setPreset] = useState(0);
  const [granularity, setGran] = useState<"hour" | "day" | "month">("day");
  const [data, setData] = useState<ComparePayload | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const { a, b } = PRESETS[preset].build();
    getCompare(isoDate(a[0]), isoDate(a[1]), isoDate(b[0]), isoDate(b[1]), granularity)
      .then((d) => {
        setData(d);
        setErr(null);
      })
      .catch((e) =>
        setErr(
          `Não foi possível comparar os períodos: ${
            e?.message ?? "a API não respondeu"
          }. Escolha outro período ou recarregue a página.`
        )
      );
  }, [preset, granularity]);

  const chart = mergeSeries(data);

  const grew = (data?.variation_pct ?? 0) >= 0;
  // Sem contagem na referência não existe base para calcular variação.
  const noBase = (data?.total_b ?? 0) === 0;

  return (
    <div className="space-y-10">
      <PageHeader
        title="Comparativo"
        description="Dois períodos lado a lado: o período A contra o período B, que serve de referência."
      />

      <div className="flex max-w-full flex-wrap gap-x-4 gap-y-3">
        <SegmentedControl
          label="Períodos comparados"
          options={PRESETS.map((p, i) => ({ value: i, label: p.label }))}
          value={preset}
          onChange={setPreset}
        />
        <SegmentedControl
          label="Agrupamento"
          options={GRANULARITIES}
          value={granularity}
          onChange={setGran}
        />
      </div>

      {err && (
        <p role="alert" className="alert-error">
          {err}
        </p>
      )}

      {data && (
        <>
          <section>
            <dl className="grid grid-cols-1 gap-x-12 gap-y-6 md:grid-cols-3">
              {[
                { label: "Período A", range: data.label_a, total: data.total_a },
                { label: "Período B, referência", range: data.label_b, total: data.total_b },
              ].map((side) => (
                <div
                  key={side.label}

                >
                  <dt className="text-sm text-ink-muted">{side.label}</dt>
                  <dd className="mt-1 font-display text-5xl font-bold leading-none tabular-nums">
                    {formatNumber(side.total)}
                  </dd>
                  <dd className="mt-1 text-sm text-ink-muted">
                    veículos, {side.range}
                  </dd>
                </div>
              ))}
              <div>
                <dt className="text-sm text-ink-muted">Variação de A sobre B</dt>
                <dd
                  className={cn(
                    "mt-1 font-display text-5xl font-bold leading-none tabular-nums",
                    noBase ? "text-ink-muted" : grew ? "text-positive" : "text-negative"
                  )}
                >
                  {noBase ? "Sem base" : formatPct(data.variation_pct)}
                </dd>
                <dd className="mt-1 text-sm text-ink-muted">
                  {data.total_a === 0 && data.total_b === 0
                    ? "Nenhum dos dois períodos tem contagem"
                    : noBase
                    ? "O período B não tem contagem para comparar"
                    : grew
                    ? "O fluxo cresceu em relação à referência"
                    : "O fluxo caiu em relação à referência"}
                </dd>
              </div>
            </dl>
          </section>

          <Sheet title="Série comparada">
            {chart.every((c) => c.a === 0 && c.b === 0) ? (
              <p className="py-6 text-ink-muted">
                Sem contagem nos dois períodos. A captura mais antiga pode estar
                fora das janelas comparadas.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={360}>
                <BarChart data={chart} margin={{ left: -8, right: 8, top: 4 }} maxBarSize={40}>
                  <CartesianGrid stroke={CHART_GRID} vertical={false} />
                  <XAxis dataKey="bucket" stroke={CHART_AXIS} fontSize={CHART_FONT_SIZE} tickLine={false} />
                  <YAxis
                    stroke={CHART_AXIS}
                    fontSize={CHART_FONT_SIZE}
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => formatNumber(v)}
                  />
                  <Tooltip
                    cursor={CHART_CURSOR}
                    contentStyle={CHART_TOOLTIP_STYLE}
                    labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                    itemStyle={{ color: "rgb(var(--ink))" }}
                    formatter={(v: number) => formatNumber(v)}
                  />
                  <Legend
                    iconType="square"
                    wrapperStyle={{ fontSize: 13 }}
                    formatter={(value) => (
                      <span style={{ color: "rgb(var(--ink-muted))" }}>{value}</span>
                    )}
                  />
                  <Bar dataKey="a" fill="rgb(var(--ink))" name="Período A" isAnimationActive={false} />
                  <Bar dataKey="b" fill="rgb(var(--ink) / 0.35)" name="Período B" isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Sheet>
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
