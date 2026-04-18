"use client";

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

import type { TimeseriesPoint } from "@/lib/types";
import { formatNumber, shortDate } from "@/lib/utils";

interface Props {
  data: TimeseriesPoint[];
  height?: number;
  title?: string;
  subtitle?: string;
}

export default function DailyFlowChart({
  data,
  height = 300,
  title = "Fluxo diário por tipo de veículo",
  subtitle = "Empilhado — últimos dias",
}: Props) {
  const prepared = data.map((p) => ({ ...p, label: shortDate(p.bucket) }));

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-xs text-ink-muted">{subtitle}</p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={prepared} margin={{ left: -10, right: 10 }}>
          <CartesianGrid stroke="#1e2a47" strokeDasharray="3 3" />
          <XAxis dataKey="label" stroke="#64748b" fontSize={11} />
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
          <Bar dataKey="cars" stackId="v" fill="#38bdf8" name="Carros" />
          <Bar dataKey="motorcycles" stackId="v" fill="#34d399" name="Motos" />
          <Bar dataKey="buses" stackId="v" fill="#fbbf24" name="Ônibus" />
          <Bar dataKey="trucks" stackId="v" fill="#f87171" name="Caminhões" />
          <Bar dataKey="others" stackId="v" fill="#64748b" name="Outros" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
