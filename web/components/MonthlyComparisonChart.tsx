"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import Sheet from "@/components/Sheet";
import {
  CHART_AXIS,
  CHART_BRAND,
  CHART_FONT_SIZE,
  CHART_GRID,
  CHART_INK,
  CHART_TOOLTIP_LABEL_STYLE,
  CHART_TOOLTIP_STYLE,
} from "@/lib/chartTheme";
import type { TimeseriesPoint } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

interface Props {
  data: TimeseriesPoint[];
  height?: number;
}

/**
 * Transforma a série mensal em comparativo por ano.
 * Ex: "2025-03" e "2024-03" viram 2 séries distintas ("2025" x "2024")
 * no eixo X = mês.
 */
export default function MonthlyComparisonChart({ data, height = 320 }: Props) {
  const byYear: Record<string, Record<string, number>> = {};
  for (const p of data) {
    const [year, month] = p.bucket.split("-");
    if (!byYear[year]) byYear[year] = {};
    byYear[year][month] = p.total;
  }

  const MONTHS = [
    "Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez",
  ];
  const merged = MONTHS.map((m, i) => {
    const mm = String(i + 1).padStart(2, "0");
    const row: Record<string, any> = { month: m };
    for (const year of Object.keys(byYear)) {
      row[year] = byYear[year][mm] ?? 0;
    }
    return row;
  });

  const years = Object.keys(byYear).sort();
  // Ano mais recente em tinta cheia; os anteriores em verde e em tracejado.
  const strokes = [
    { stroke: CHART_INK, dash: undefined },
    { stroke: CHART_BRAND, dash: undefined },
    { stroke: CHART_INK, dash: "6 4" },
    { stroke: CHART_BRAND, dash: "6 4" },
  ];
  const newestFirst = [...years].reverse();

  return (
    <Sheet
      title="Comparativo mensal por ano"
      note="Veículos por mês, uma linha por ano"
    >
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={merged} margin={{ left: -10, right: 10 }}>
          <CartesianGrid stroke={CHART_GRID} vertical={false} />
          <XAxis dataKey="month" stroke={CHART_AXIS} fontSize={CHART_FONT_SIZE} tickLine={false} />
          <YAxis stroke={CHART_AXIS} fontSize={CHART_FONT_SIZE} allowDecimals={false} tickLine={false} axisLine={false} tickFormatter={(v: number) => formatNumber(v)} />
          <Tooltip
            contentStyle={CHART_TOOLTIP_STYLE}
            labelStyle={CHART_TOOLTIP_LABEL_STYLE}
            formatter={(v: number) => formatNumber(v)}
          />
          <Legend iconType="plainline" wrapperStyle={{ fontSize: 13 }} formatter={(value) => (<span style={{ color: "rgb(var(--ink-muted))" }}>{value}</span>)} />
          {years.map((y, i) => (
            <Line
              key={y}
              type="monotone"
              dataKey={y}
              stroke={strokes[newestFirst.indexOf(y) % strokes.length].stroke}
              strokeDasharray={strokes[newestFirst.indexOf(y) % strokes.length].dash}
              isAnimationActive={false}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
              name={y}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </Sheet>
  );
}
