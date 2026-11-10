"use client";

import Link from "next/link";

import type { Kpi, TimeseriesPoint } from "@/lib/types";
import { VEHICLE_CLASSES, sumVehicleClasses } from "@/lib/vehicleClasses";
import { cn, formatNumber, formatPct } from "@/lib/utils";

interface Props {
  kpi: Kpi | null;
  /** Série diária do período: dela saem os totais por classe e os pedestres. */
  daily: TimeseriesPoint[];
  days: number;
  /** Coluna estreita (ao lado do vídeo): tudo empilhado. */
  stacked?: boolean;
  /** Resumo de 12 meses, presente só quando o período escolhido está vazio. */
  lastCapture: Kpi | null;
  onShowLongestPeriod: () => void;
}

const fmtMoment = (iso: string) =>
  new Date(iso)
    .toLocaleString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
    .replace(".", "")
    .replace(/ de /g, " ");

const periodLabel = (days: number) =>
  days === 1 ? "hoje" : days === 365 ? "nos últimos 12 meses" : `nos últimos ${days} dias`;

/**
 * Leitura da contagem do período: os dois números (veículos e pedestres), uma
 * frase com a janela real de dados e a divisão por classe. Cada dado aparece
 * uma vez só.
 */
export default function CountSummary({
  kpi,
  daily,
  days,
  stacked = false,
  lastCapture,
  onShowLongestPeriod,
}: Props) {
  const totals = sumVehicleClasses(daily);
  const vehicles = kpi?.total ?? 0;
  const pedestrians = totals.pedestrians;

  if (vehicles === 0 && pedestrians === 0) {
    const hasOlder = (lastCapture?.total ?? 0) > 0 && lastCapture?.data_end;
    return (
      <div>
        <p className="text-xl font-semibold">Sem contagem {periodLabel(days)}</p>
        <p className="mt-1 max-w-[65ch] text-ink-muted">
          {hasOlder
            ? `A captura mais recente terminou em ${fmtMoment(
                lastCapture!.data_end!
              )} e somou ${formatNumber(lastCapture!.total)} veículos.`
            : "Nada cruzou a linha de contagem ainda. Envie um vídeo ou inicie uma câmera ao vivo."}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          {hasOlder && (
            <button type="button" className="btn-primary" onClick={onShowLongestPeriod}>
              Ver 12 meses
            </button>
          )}
          <Link href="/upload" className={hasOlder ? "btn" : "btn-primary"}>
            Enviar vídeo
          </Link>
          <Link href="/live" className="btn">
            Iniciar câmera ao vivo
          </Link>
        </div>
      </div>
    );
  }

  const variation = kpi?.variation_pct_vs_previous ?? 0;
  const hours = kpi?.hours_with_data ?? 0;

  // Frases de contexto: só entram as que têm dado de verdade.
  const context: string[] = [];
  if (kpi?.data_start && kpi?.data_end) {
    context.push(
      kpi.data_start === kpi.data_end
        ? `Captura de ${fmtMoment(kpi.data_start)}.`
        : `Captura de ${fmtMoment(kpi.data_start)} a ${fmtMoment(kpi.data_end)}.`
    );
  }
  if (hours >= 2) {
    context.push(
      `Média de ${formatNumber(Math.round(kpi?.avg_per_hour ?? 0))} veículos por hora em ${formatNumber(hours)} h de captura.`
    );
  }
  if (kpi?.peak_hour && kpi.peak_value) {
    context.push(
      `Pico às ${kpi.peak_hour}, com ${formatNumber(kpi.peak_value)} veículos.`
    );
  }

  const share = (n: number) =>
    vehicles > 0
      ? `${((n / vehicles) * 100).toLocaleString("pt-BR", {
          maximumFractionDigits: 0,
        })}%`
      : "";

  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-x-16 gap-y-8",
        !stacked && "lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]"
      )}
    >
      <div>
        <p className="flex flex-wrap items-end gap-x-10 gap-y-4">
          {[
            { value: vehicles, one: "veículo", many: "veículos" },
            { value: pedestrians, one: "pedestre", many: "pedestres" },
          ].map((n) => (
            <span key={n.many}>
              <span className="block font-display text-7xl font-bold leading-[0.9] tabular-nums">
                {formatNumber(n.value)}
              </span>
              <span className="mt-2 block text-lg font-medium">
                {n.value === 1 ? n.one : n.many}
              </span>
            </span>
          ))}
        </p>

        {Math.abs(variation) >= 0.05 && (
          <p
            className={cn(
              "mt-4 font-medium tabular-nums",
              variation > 0 ? "text-positive" : "text-negative"
            )}
          >
            {formatPct(variation)} em veículos sobre o período anterior
          </p>
        )}

        {context.length > 0 && (
          <p className="mt-4 max-w-[60ch] text-ink-muted">{context.join(" ")}</p>
        )}
      </div>

      {vehicles > 0 && (
        <table className="sheet-table self-start">
          <caption className="sr-only">Veículos por classe no período</caption>
          <thead>
            <tr>
              <th scope="col">Veículos por classe</th>
              <th scope="col" className="!text-right">
                <span className="sr-only">Quantidade</span>
              </th>
              <th scope="col" className="!text-right">
                <span className="sr-only">Participação</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {VEHICLE_CLASSES.map((c) => (
              <tr key={c.key} className={cn(totals[c.key] === 0 && "text-ink-soft")}>
                <td>{c.label}</td>
                <td className="num font-semibold">{formatNumber(totals[c.key])}</td>
                <td className="num w-16 text-ink-muted">
                  {totals[c.key] > 0 ? share(totals[c.key]) : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
