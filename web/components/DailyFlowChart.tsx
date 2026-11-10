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

import Sheet from "@/components/Sheet";
import {
  CHART_AXIS,
  CHART_CURSOR,
  CHART_FONT_SIZE,
  CHART_GRID,
  CHART_TOOLTIP_LABEL_STYLE,
  CHART_TOOLTIP_STYLE,
} from "@/lib/chartTheme";
import type { TimeseriesPoint } from "@/lib/types";
import { VEHICLE_CLASSES } from "@/lib/vehicleClasses";
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
  title = "Fluxo diário por classe",
  subtitle = "Veículos por dia, empilhados por classe",
}: Props) {
  const prepared = data
    .filter((p) => p.total > 0)
    .map((p) => ({ ...p, label: shortDate(p.bucket).replace(".", "").replace(" de ", " ") }));

  return (
    <Sheet title={title} note={subtitle}>
      {prepared.length === 0 ? (
        <p className="py-6 text-ink-muted">Sem contagem diária no período.</p>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={prepared} margin={{ left: -8, right: 8, top: 4 }} maxBarSize={56}>
            <CartesianGrid stroke={CHART_GRID} vertical={false} />
            <XAxis dataKey="label" stroke={CHART_AXIS} fontSize={CHART_FONT_SIZE} tickLine={false} />
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
              wrapperStyle={{ fontSize: 13, color: "rgb(var(--ink-muted))" }}
              formatter={(value) => (
                <span style={{ color: "rgb(var(--ink-muted))" }}>{value}</span>
              )}
            />
            {VEHICLE_CLASSES.map((c) => (
              <Bar
                key={c.key}
                dataKey={c.key}
                stackId="v"
                fill={c.tone}
                name={c.label}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </Sheet>
  );
}
