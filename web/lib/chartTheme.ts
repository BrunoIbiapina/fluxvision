import type { CSSProperties } from "react";

/** Cores e estilos dos gráficos Recharts, lidos dos tokens do tema. */
export const CHART_AXIS = "rgb(var(--ink-soft))";
export const CHART_GRID = "rgb(var(--bg-border))";
export const CHART_INK = "rgb(var(--ink))";
export const CHART_BRAND = "rgb(var(--brand))";
export const CHART_FONT_SIZE = 12;

export const CHART_TOOLTIP_STYLE: CSSProperties = {
  background: "rgb(var(--bg-card))",
  border: "1px solid rgb(var(--ink) / 0.7)",
  borderRadius: 4,
  fontSize: 13,
  color: "rgb(var(--ink))",
};

export const CHART_TOOLTIP_LABEL_STYLE: CSSProperties = {
  color: "rgb(var(--ink-muted))",
  fontWeight: 600,
};

export const CHART_CURSOR = { fill: "rgb(var(--lane) / 0.25)" };
