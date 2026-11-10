"use client";

import { Loader2, Play } from "lucide-react";

import { formatLiveFps, formatLiveUptime } from "@/components/LiveCountSheet";
import Sheet from "@/components/Sheet";
import type { Camera, City, LiveStatus } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

interface Props {
  /** Só as transmissões em andamento. */
  streams: LiveStatus[];
  cameras: Camera[];
  cityByCameraId: Map<number, City>;
  /** Câmera aberta na vidraça. */
  openCameraId: number | null;
  startingAll: boolean;
  onStartAll: () => void;
  onOpen: (cameraId: number) => void;
  onStop: (cameraId: number) => void;
}

/** Todas as transmissões em andamento, com atalho para abrir ou parar cada uma. */
export default function LiveActiveStreamsSheet({
  streams,
  cameras,
  cityByCameraId,
  openCameraId,
  startingAll,
  onStartAll,
  onOpen,
  onStop,
}: Props) {
  // Com uma câmera só, o painel acima já mostra tudo o que esta lista traria.
  if (cameras.length < 2 && streams.length < 2) return null;

  return (
    <Sheet
      title={
        streams.length === 0
          ? "Nenhuma transmissão em andamento"
          : streams.length === 1
          ? "1 transmissão em andamento"
          : `${formatNumber(streams.length)} transmissões em andamento`
      }
      aside={
        <button
          type="button"
          className="btn"
          onClick={onStartAll}
          disabled={startingAll}
          title="Inicia uma transmissão para cada câmera que tem fonte salva e está parada"
        >
          {startingAll ? (
            <Loader2 size={16} className="animate-spin" aria-hidden />
          ) : (
            <Play size={16} aria-hidden />
          )}
          Iniciar todas as câmeras
        </button>
      }
    >
      {streams.length === 0 ? (
        <p className="text-ink-muted">
          Inicie a câmera escolhida acima ou todas as que têm fonte salva.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="sheet-table min-w-[640px]">
            <thead>
              <tr>
                <th scope="col">Câmera</th>
                <th scope="col" className="!text-right">Taxa</th>
                <th scope="col" className="!text-right">Contagem</th>
                <th scope="col" className="!text-right">Tempo no ar</th>
                <th scope="col">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {streams.map((s) => {
                const cam = cameras.find((c) => c.id === s.camera_id);
                const city = cityByCameraId.get(s.camera_id);
                const name = cam?.name ?? `Câmera ${s.camera_id}`;
                return (
                  <tr key={s.camera_id}>
                    <td>
                      <span className="font-semibold">{name}</span>
                      {city && (
                        <span className="block text-sm text-ink-muted">
                          {city.name}
                        </span>
                      )}
                    </td>
                    <td className="num text-ink-muted">
                      {formatLiveFps(s.fps_real)}
                    </td>
                    <td className="num font-semibold">
                      {formatNumber(s.total_counted)}
                    </td>
                    <td className="num text-ink-muted">
                      {formatLiveUptime(s.uptime_s)}
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-5">
                        {s.camera_id === openCameraId ? (
                          <span className="text-sm text-ink-muted">Em exibição</span>
                        ) : (
                          <button
                            type="button"
                            className="btn"
                            onClick={() => onOpen(s.camera_id)}
                            aria-label={`Abrir a transmissão de ${name}`}
                          >
                            Abrir
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn-danger"
                          onClick={() => onStop(s.camera_id)}
                          aria-label={`Parar a transmissão de ${name}`}
                        >
                          Parar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Sheet>
  );
}
