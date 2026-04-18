"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { TimeseriesPoint } from "@/lib/types";
import { formatNumber, shortHour } from "@/lib/utils";

interface Props {
  data: TimeseriesPoint[];
  height?: number;
}

export default function HourlyFlowChart({ data, height = 280 }: Props) {
  const prepared = data.map((p) => ({
    ...p,
    label: shortHour(p.bucket),
  }));

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold">Fluxo por hora</h3>
          <p className="text-xs text-ink-muted">
            Agregado das últimas horas de captação
          </p>
        </div>
        <span className="chip">últimas {data.length} horas</span>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={prepared} margin={{ left: -10, right: 10, top: 5 }}>
          <defs>
            <linearGradient id="flux-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.6} />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#1e2a47" strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            stroke="#64748b"
            fontSize={11}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              background: "#121a2e",
              border: "1px solid #1e2a47",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "#94a3b8" }}
            formatter={(v: number) => [formatNumber(v), "veículos"]}
          />
          <Area
            type="monotone"
            dataKey="total"
            stroke="#38bdf8"
            strokeWidth={2}
            fill="url(#flux-gradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
