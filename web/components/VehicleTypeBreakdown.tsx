"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import type { TimeseriesPoint } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

interface Props {
  data: TimeseriesPoint[];
}

export default function VehicleTypeBreakdown({ data }: Props) {
  const agg = data.reduce(
    (a, p) => ({
      cars: a.cars + p.cars,
      motorcycles: a.motorcycles + p.motorcycles,
      buses: a.buses + p.buses,
      trucks: a.trucks + p.trucks,
      others: a.others + p.others,
      pedestrians: a.pedestrians + (p.pedestrians ?? 0),
    }),
    { cars: 0, motorcycles: 0, buses: 0, trucks: 0, others: 0, pedestrians: 0 }
  );

  const rows = [
    { name: "Carros",    value: agg.cars,        color: "#38bdf8" },
    { name: "Motos",     value: agg.motorcycles, color: "#34d399" },
    { name: "Ônibus",    value: agg.buses,       color: "#fbbf24" },
    { name: "Caminhões", value: agg.trucks,      color: "#f87171" },
    { name: "Outros",    value: agg.others,      color: "#64748b" },
  ];

  // Pedestre fica fora do pie porque não é veículo — inflar o gráfico
  // com pedestres mudaria a semântica de "mix de tráfego".
  const total = rows.reduce((s, r) => s + r.value, 0);

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold">Mix de veículos</h3>
          <p className="text-xs text-ink-muted">Composição por tipo</p>
        </div>
      </div>

      <div className="grid grid-cols-5 items-center gap-3">
        <div className="col-span-2 h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip
                contentStyle={{
                  background: "#121a2e",
                  border: "1px solid #1e2a47",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v: number) => formatNumber(v)}
              />
              <Pie
                data={rows}
                dataKey="value"
                nameKey="name"
                innerRadius={50}
                outerRadius={75}
                paddingAngle={2}
              >
                {rows.map((r) => (
                  <Cell key={r.name} fill={r.color} stroke="#121a2e" />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>

        <ul className="col-span-3 space-y-2 text-sm">
          {rows.map((r) => (
            <li key={r.name} className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: r.color }}
                />
                {r.name}
              </span>
              <span className="text-ink-muted tabular-nums">
                {formatNumber(r.value)}{" "}
                <span className="text-ink-soft text-xs">
                  ({total > 0 ? ((r.value / total) * 100).toFixed(1) : 0}%)
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {agg.pedestrians > 0 && (
        <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-ink-muted">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: "#a78bfa" }}
            />
            Pedestres (contagem separada)
          </span>
          <span className="font-medium tabular-nums">
            {formatNumber(agg.pedestrians)}
          </span>
        </div>
      )}
    </div>
  );
}
