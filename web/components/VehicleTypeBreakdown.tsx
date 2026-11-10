"use client";

import Sheet from "@/components/Sheet";
import type { TimeseriesPoint } from "@/lib/types";
import { VEHICLE_CLASSES, sumVehicleClasses } from "@/lib/vehicleClasses";
import { formatNumber } from "@/lib/utils";

interface Props {
  data: TimeseriesPoint[];
}

/**
 * Composição do tráfego por classe, em tabela. O quadradinho de cada linha é a
 * legenda do gráfico diário empilhado. Pedestre aparece à parte.
 */
export default function VehicleTypeBreakdown({ data }: Props) {
  const totals = sumVehicleClasses(data);
  const vehicles = VEHICLE_CLASSES.reduce((s, c) => s + totals[c.key], 0);
  const share = (n: number) =>
    vehicles > 0 ? `${((n / vehicles) * 100).toFixed(1).replace(".", ",")}%` : "0%";

  return (
    <Sheet
      title="Composição por classe"
    >
      {vehicles === 0 ? (
        <p className="py-8 text-ink-muted">
          Sem veículos contados no período.
        </p>
      ) : (
        <>
          <table className="sheet-table">
            <thead>
              <tr>
                <th scope="col" >Classe</th>
                <th scope="col" className="!text-right">Veículos</th>
                <th scope="col" className="!text-right">Participação</th>
              </tr>
            </thead>
            <tbody>
              {VEHICLE_CLASSES.map((c) => (
                <tr key={c.key}>
                  <td >
                    <span
                      className="mr-2 inline-block h-3 w-3 rounded-sm align-[-1px]"
                      style={{ background: c.tone }}
                      aria-hidden
                    />
                    {c.label}
                  </td>
                  <td className="num">{formatNumber(totals[c.key])}</td>
                  <td className="num text-ink-muted">
                    {share(totals[c.key])}
                  </td>
                </tr>
              ))}
            </tbody>
            {totals.pedestrians > 0 && (
              <tfoot>
                <tr>
                  <td >Pedestres, à parte</td>
                  <td className="num">{formatNumber(totals.pedestrians)}</td>
                  <td className="sm:pr-5" />
                </tr>
              </tfoot>
            )}
          </table>
        </>
      )}
    </Sheet>
  );
}
