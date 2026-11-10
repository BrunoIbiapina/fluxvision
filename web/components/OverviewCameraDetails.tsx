"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { formatLiveFps, formatLiveUptime } from "@/components/LiveCountSheet";
import Sheet from "@/components/Sheet";
import { getAlerts } from "@/lib/api";
import {
  type AlertGroup,
  formatAlertMoment,
  groupAlertsByKind,
  mergeAlertGroupsByTitle,
} from "@/lib/alertGroups";
import type { Camera, LiveStatus } from "@/lib/types";
import { splitVehiclesAndPedestrians } from "@/lib/vehicleClasses";
import { categoryLabel, formatNumber } from "@/lib/utils";

const ALERT_SAMPLE_LIMIT = 500;

interface Props {
  camera: Camera;
  /** Transmissão em curso desta câmera, se houver. */
  stream: LiveStatus | undefined;
}

/**
 * O que a visão geral sabe de um local além da contagem do período: os alertas
 * abertos dele por tipo, a transmissão em curso e a ficha da câmera.
 */
export default function OverviewCameraDetails({ camera, stream }: Props) {
  const [groups, setGroups] = useState<AlertGroup[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setGroups(null);
    getAlerts(true, ALERT_SAMPLE_LIMIT)
      .then((all) => {
        if (cancelled) return;
        setGroups(
          mergeAlertGroupsByTitle(
            groupAlertsByKind(all.filter((a) => a.camera_id === camera.id))
          )
        );
      })
      .catch(() => !cancelled && setGroups([]));
    return () => {
      cancelled = true;
    };
  }, [camera.id]);

  const openAlerts = (groups ?? []).reduce((sum, g) => sum + g.count, 0);
  const session = splitVehiclesAndPedestrians(stream?.by_type);
  const located = !(camera.latitude === 0 && camera.longitude === 0);

  return (
    <div className="grid grid-cols-1 gap-x-12 gap-y-12 md:grid-cols-2 xl:grid-cols-3">
      <Sheet
        title={
          groups === null
            ? "Alertas deste local"
            : openAlerts === 0
            ? "Nenhum alerta aberto neste local"
            : `${formatNumber(openAlerts)} alertas abertos neste local`
        }
        aside={
          <Link href="/alerts" className="text-sm font-semibold text-brand underline">
            Abrir Alertas
          </Link>
        }
      >
        {groups !== null && groups.length === 0 ? (
          <p className="text-ink-muted">
            Pedestre na pista, veículo parado e variação fora do padrão aparecem
            aqui.
          </p>
        ) : (
          <table className="sheet-table">
            <tbody>
              {(groups ?? []).map((g) => (
                <tr key={g.title}>
                  <td>
                    <span className="font-medium">{g.title}</span>
                    <span className="block text-sm text-ink-muted">
                      Último em {formatAlertMoment(g.latest)}
                    </span>
                  </td>
                  <td className="num align-top font-semibold">
                    {formatNumber(g.count)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Sheet>

      <Sheet title={stream ? "Transmissão em curso" : "Câmera parada"}>
        {stream ? (
          <FactRows
            rows={[
              ["No ar há", formatLiveUptime(stream.uptime_s)],
              ["Veículos nesta transmissão", formatNumber(session.vehicles)],
              ["Pedestres nesta transmissão", formatNumber(session.pedestrians)],
              ["Ritmo de processamento", formatLiveFps(stream.fps_real)],
              ["Quadros analisados", formatNumber(stream.frames_processed)],
            ]}
          />
        ) : (
          <>
            <p className="text-ink-muted">
              Esta câmera não está transmitindo. A contagem do período continua
              disponível acima.
            </p>
            <Link href="/live" className="btn mt-4">
              Iniciar em Ao vivo
            </Link>
          </>
        )}
      </Sheet>

      <Sheet
        title="Local"
        aside={
          <Link href="/cameras" className="text-sm font-semibold text-brand underline">
            Editar em Câmeras
          </Link>
        }
      >
        <FactRows
          rows={[
            ["Tipo de ponto", categoryLabel(camera.category)],
            ["Cidade", camera.city_name ?? "Não informada"],
            ["Bairro", camera.district || "Não informado"],
            [
              "Coordenadas",
              located
                ? `${camera.latitude.toFixed(4)}, ${camera.longitude.toFixed(4)}`
                : "Não informadas",
            ],
            ["Fonte salva", camera.stream_url || "Nenhuma"],
          ]}
        />
      </Sheet>
    </div>
  );
}

/** Linhas de rótulo e valor, no mesmo desenho das tabelas da tela. */
function FactRows({ rows }: { rows: [string, string][] }) {
  return (
    <table className="sheet-table">
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label}>
            <th scope="row" className="w-1/2 align-top !font-normal !text-ink-muted">
              {label}
            </th>
            <td className="text-right font-medium tabular-nums [overflow-wrap:anywhere]">
              {value}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
