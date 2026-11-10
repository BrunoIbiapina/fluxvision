"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import FlowBand from "@/components/FlowBand";
import type { TimeseriesPoint } from "@/lib/types";
import { VEHICLE_CLASSES, sumVehicleClasses } from "@/lib/vehicleClasses";
import {
  type BucketGranularity,
  cn,
  formatBucketLabel,
  formatNumber,
} from "@/lib/utils";

interface Props {
  hourly: TimeseriesPoint[];
  daily: TimeseriesPoint[];
  /**
   * Usa a série horária. Só vale quando ela cobre o período inteiro (até 14
   * dias); num período maior a tabela por hora não fecharia com o total.
   */
  preferHourly: boolean;
  /** Quantas linhas a tabela mostra antes de apontar para a tela de séries. */
  maxRows?: number;
}

const MIN_BAND_INTERVALS = 6;

const hasCount = (p: TimeseriesPoint) => p.total > 0 || (p.pedestrians ?? 0) > 0;

/**
 * Contagem classificada: a faixa de fluxo em cima e, embaixo, a tabela com uma
 * linha por intervalo e uma coluna por classe. Passar o ponteiro num intervalo
 * destaca o mesmo intervalo na outra metade.
 */
export default function ClassifiedCountSheet({
  hourly,
  daily,
  preferHourly,
  maxRows = 12,
}: Props) {
  const [active, setActive] = useState<number | null>(null);

  const { series, granularity } = useMemo(() => {
    const useHourly = preferHourly && hourly.some(hasCount);
    const source = useHourly ? hourly : daily;
    const g: BucketGranularity = useHourly ? "hour" : "day";
    // Corta as pontas sem contagem para a faixa começar e terminar em dado.
    const first = source.findIndex(hasCount);
    if (first === -1) return { series: [] as TimeseriesPoint[], granularity: g };
    let last = source.length - 1;
    while (last > first && !hasCount(source[last])) last--;
    return { series: source.slice(first, last + 1), granularity: g };
  }, [hourly, daily, preferHourly]);

  if (series.length === 0) return null;

  const intervals = series.map((p) => ({
    label: formatBucketLabel(p.bucket, granularity),
    total: p.total,
  }));
  const totals = sumVehicleClasses(series);

  // Tabela: intervalos com contagem, do mais recente para o mais antigo.
  const rows = series
    .map((p, index) => ({ p, index }))
    .filter(({ p }) => hasCount(p))
    .reverse();
  const visibleRows = rows.slice(0, maxRows);

  return (
    <div>
      {/* Com um ou dois intervalos a pista vira um bloco e não informa nada. */}
      {intervals.length >= MIN_BAND_INTERVALS && (
        <div className="pb-6 pt-5">
          <FlowBand
            intervals={intervals}
            activeIndex={active}
            onActiveChange={setActive}
            unit={granularity === "hour" ? "hora" : "dia"}
          />
        </div>
      )}

      <div
        role="region"
        aria-label="Tabela de contagem classificada"
        tabIndex={0}
        className={cn(
          "overflow-x-auto",
          intervals.length >= MIN_BAND_INTERVALS && "mt-2"
        )}
      >
        <table className="sheet-table min-w-[640px]">
          <caption className="sr-only">
            Contagem classificada por {granularity === "hour" ? "hora" : "dia"}
          </caption>
          <thead>
            <tr>
              <th scope="col" >
                {granularity === "hour" ? "Hora" : "Dia"}
              </th>
              {VEHICLE_CLASSES.map((c) => (
                <th key={c.key} scope="col" className="!text-right">
                  {c.label}
                </th>
              ))}
              <th scope="col" className="!text-right !text-ink">
                Veículos
              </th>
              <th scope="col" className="!text-right">
                Pedestres
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map(({ p, index }) => (
              <tr
                key={p.bucket}
                onPointerEnter={() => setActive(index)}
                onPointerLeave={() => setActive(null)}
                className={cn(
                  "transition-colors",
                  active === index && "bg-lane/25"
                )}
              >
                <th
                  scope="row"
                  
                >
                  {formatBucketLabel(p.bucket, granularity)}
                </th>
                {VEHICLE_CLASSES.map((c) => (
                  <td key={c.key} className="num">
                    {formatNumber(p[c.key])}
                  </td>
                ))}
                <td className="num font-semibold">{formatNumber(p.total)}</td>
                <td className="num text-ink-muted">
                  {formatNumber(p.pedestrians ?? 0)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td >Total do período</td>
              {VEHICLE_CLASSES.map((c) => (
                <td key={c.key} className="num">
                  {formatNumber(totals[c.key])}
                </td>
              ))}
              <td className="num">{formatNumber(totals.total)}</td>
              <td className="num">{formatNumber(totals.pedestrians)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {rows.length > visibleRows.length && (
        <p className="pt-3 text-sm text-ink-muted">
          Mostrando os {visibleRows.length} intervalos mais recentes de{" "}
          {rows.length}.{" "}
          <Link href="/analytics" className="font-semibold text-brand underline">
            Ver séries completas
          </Link>
        </p>
      )}
    </div>
  );
}
