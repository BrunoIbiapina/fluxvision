"use client";

import { useState } from "react";

import FlowBand from "@/components/FlowBand";
import Sheet from "@/components/Sheet";
import type { TimeseriesPoint } from "@/lib/types";
import { formatBucketLabel, formatNumber } from "@/lib/utils";

interface Props {
  data: TimeseriesPoint[];
  height?: number;
}

// Abaixo disso a faixa vira poucos blocos e não mostra variação nenhuma.
const MIN_BAND_INTERVALS = 6;

/** Fluxo por hora: faixa de fluxo, ou lista quando há poucas horas. */
export default function HourlyFlowChart({ data, height = 200 }: Props) {
  const [active, setActive] = useState<number | null>(null);

  // Corta as horas vazias das pontas para a faixa cobrir só a captura.
  const first = data.findIndex((p) => p.total > 0);
  let last = data.length - 1;
  while (last > first && data[last].total === 0) last--;
  const series = first === -1 ? [] : data.slice(first, last + 1);

  const intervals = series.map((p) => ({
    label: formatBucketLabel(p.bucket, "hour"),
    total: p.total,
  }));

  return (
    <Sheet title="Fluxo por hora">
      {intervals.length === 0 ? (
        <p className="text-ink-muted">
          Sem contagem horária no período. A série horária cobre no máximo os
          últimos 14 dias.
        </p>
      ) : intervals.length < MIN_BAND_INTERVALS ? (
        <table className="sheet-table max-w-md">
          <thead>
            <tr>
              <th scope="col">Hora</th>
              <th scope="col" className="!text-right">Veículos</th>
            </tr>
          </thead>
          <tbody>
            {intervals.map((i) => (
              <tr key={i.label}>
                <td>{i.label}</td>
                <td className="num font-semibold">{formatNumber(i.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <FlowBand
          intervals={intervals}
          activeIndex={active}
          onActiveChange={setActive}
          unit="hora"
          height={height}
        />
      )}
    </Sheet>
  );
}
