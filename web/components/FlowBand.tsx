"use client";

import { formatNumber } from "@/lib/utils";

export interface FlowBandInterval {
  label: string;
  total: number;
}

interface Props {
  intervals: FlowBandInterval[];
  /** Índice do intervalo em destaque (compartilhado com a tabela). */
  activeIndex: number | null;
  onActiveChange: (index: number | null) => void;
  /** Unidade do intervalo para o texto: "hora" ou "dia". */
  unit: "hora" | "dia";
  height?: number;
}

const HALF = 50; // meia altura do desenho, em unidades do viewBox
const MIN_HALF = 1.2; // intervalo sem veículo ainda aparece como fio de pista

/**
 * Faixa de fluxo: uma pista vista de cima em que a largura, em cada intervalo,
 * é proporcional ao volume contado. O eixo tracejado é o amarelo de faixa.
 */
export default function FlowBand({
  intervals,
  activeIndex,
  onActiveChange,
  unit,
  height = 132,
}: Props) {
  const count = intervals.length;
  const peak = Math.max(1, ...intervals.map((i) => i.total));
  const peakIndex = intervals.findIndex((i) => i.total === peak);
  const shown = activeIndex ?? peakIndex;
  const shownInterval = intervals[shown];

  const summary = `Faixa de fluxo com ${count} intervalos; maior volume de ${formatNumber(
    peak
  )} veículos por ${unit} em ${intervals[peakIndex]?.label ?? "-"}.`;

  return (
    <figure className="m-0">
      <figcaption className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
        <span className="text-ink-muted">
          Largura da pista proporcional ao volume por {unit}
        </span>
        {shownInterval && (
          <span className="tabular-nums" aria-live="polite">
            <span className="text-ink-muted">
              {activeIndex === null ? "Pico em " : ""}
              {shownInterval.label}:
            </span>{" "}
            <strong className="font-semibold">
              {formatNumber(shownInterval.total)}
            </strong>{" "}
            veículos
          </span>
        )}
      </figcaption>

      <svg
        role="img"
        aria-label={summary}
        viewBox={`0 0 ${count} ${HALF * 2}`}
        preserveAspectRatio="none"
        width="100%"
        height={height}
        className="block rounded-sm bg-bg-elevated"
        onPointerLeave={() => onActiveChange(null)}
      >
        {intervals.map((interval, i) => {
          const half = MIN_HALF + (HALF - 6 - MIN_HALF) * (interval.total / peak);
          return (
            <rect
              key={i}
              x={i}
              y={HALF - half}
              width={1.02}
              height={half * 2}
              fill={i === activeIndex ? "rgb(var(--brand))" : "rgb(var(--ink))"}
            />
          );
        })}
        <line
          x1={0}
          x2={count}
          y1={HALF}
          y2={HALF}
          stroke="rgb(var(--lane))"
          strokeWidth={3}
          strokeDasharray="14 10"
          vectorEffect="non-scaling-stroke"
        />
        {intervals.map((_, i) => (
          <rect
            key={`hit-${i}`}
            x={i}
            y={0}
            width={1}
            height={HALF * 2}
            fill="transparent"
            onPointerEnter={() => onActiveChange(i)}
            onPointerDown={() => onActiveChange(i)}
          />
        ))}
      </svg>

      <div className="mt-1.5 flex justify-between text-xs text-ink-soft">
        <span>{intervals[0]?.label}</span>
        {count > 1 && <span>{intervals[count - 1]?.label}</span>}
      </div>
    </figure>
  );
}
