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
  const colors = ["#38bdf8", "#34d399", "#fbbf24", "#f472b6"];

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold">Comparativo mensal por ano</h3>
          <p className="text-xs text-ink-muted">
            Tendência ano a ano, útil para medir sazonalidade
          </p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={merged} margin={{ left: -10, right: 10 }}>
          <CartesianGrid stroke="#1e2a47" strokeDasharray="3 3" />
          <XAxis dataKey="month" stroke="#64748b" fontSize={11} />
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
          {years.map((y, i) => (
            <Line
              key={y}
              type="monotone"
              dataKey={y}
              stroke={colors[i % colors.length]}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
              name={y}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
