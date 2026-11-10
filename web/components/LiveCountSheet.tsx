import Sheet from "@/components/Sheet";
import type { LiveStatus } from "@/lib/types";
import { formatNumber } from "@/lib/utils";
import {
  DETECTED_TYPE_LABEL,
  splitVehiclesAndPedestrians,
} from "@/lib/vehicleClasses";

/** "12,4 fps", com vírgula decimal. */
export function formatLiveFps(fps: number): string {
  return `${fps.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} fps`;
}

/** Tempo no ar a partir de segundos: "42 s", "3 min 05 s", "2 h 14 min". */
export function formatLiveUptime(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  if (total < 60) return `${total} s`;
  const minutes = Math.floor(total / 60);
  if (minutes < 60) {
    return `${minutes} min ${String(total % 60).padStart(2, "0")} s`;
  }
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} min`;
}

interface Props {
  status: LiveStatus | null;
  /** Nome da câmera em exibição, para o título dizer de quem é a contagem. */
  cameraName?: string;
  /** Pares [tipo, quantidade], já do maior para o menor. */
  sortedTypes: Array<[string, number]>;
}

/** Contagem da transmissão aberta na vidraça: total, ritmo e tipos. */
export default function LiveCountSheet({ status, sortedTypes, cameraName }: Props) {
  const { vehicles, pedestrians } = splitVehiclesAndPedestrians(status?.by_type);
  const total = vehicles + pedestrians;

  return (
    <Sheet title={cameraName ? `Contagem de ${cameraName}` : "Contagem desta transmissão"}>
      <p className="flex flex-wrap items-end gap-x-8 gap-y-3">
        {[
          { value: vehicles, one: "veículo", many: "veículos" },
          { value: pedestrians, one: "pedestre", many: "pedestres" },
        ].map((n) => (
          <span key={n.many}>
            <span className="block font-display text-5xl font-semibold leading-none tabular-nums">
              {formatNumber(n.value)}
            </span>
            <span className="mt-1 block text-sm text-ink-muted">
              {n.value === 1 ? n.one : n.many}
            </span>
          </span>
        ))}
      </p>

      <dl className="mt-6 grid grid-cols-3 gap-x-4">
        <div>
          <dt className="text-sm text-ink-muted">Taxa</dt>
          <dd className="text-[15px] font-semibold tabular-nums">
            {status?.fps_real ? formatLiveFps(status.fps_real) : "Sem leitura"}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-ink-muted">Quadros</dt>
          <dd className="text-[15px] font-semibold tabular-nums">
            {formatNumber(status?.frames_processed ?? 0)}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-ink-muted">Tempo no ar</dt>
          <dd className="text-[15px] font-semibold tabular-nums">
            {status?.uptime_s ? formatLiveUptime(status.uptime_s) : "Sem leitura"}
          </dd>
        </div>
      </dl>

      <div className="mt-6">
        {sortedTypes.length === 0 ? (
          <p className="text-sm text-ink-muted">
            Nenhum veículo cruzou a linha de contagem ainda.
          </p>
        ) : (
          <table className="sheet-table">
            <thead>
              <tr>
                <th scope="col">Tipo</th>
                <th scope="col" className="!text-right">Contagem</th>
                <th scope="col" className="!text-right">Parte do total</th>
              </tr>
            </thead>
            <tbody>
              {sortedTypes.map(([type, count]) => {
                const pct = total > 0 ? (count / total) * 100 : 0;
                return (
                  <tr key={type}>
                    <td>{DETECTED_TYPE_LABEL[type] ?? type}</td>
                    <td className="num font-semibold">{formatNumber(count)}</td>
                    <td className="num text-ink-muted">{pct.toFixed(0)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {status && (
        <dl className="mt-6 space-y-3">
          <div>
            <dt className="text-sm text-ink-muted">Fonte informada</dt>
            <dd className="break-all text-[15px]">{status.source}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-muted">Transmissão identificada</dt>
            <dd className="text-[15px] [overflow-wrap:anywhere]">{status.resolved_source.replace(/^youtube:/, "")}</dd>
          </div>
        </dl>
      )}
    </Sheet>
  );
}
