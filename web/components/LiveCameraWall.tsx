"use client";

import { liveMjpegUrl } from "@/lib/api";
import type { Camera, LiveStatus } from "@/lib/types";
import { splitVehiclesAndPedestrians } from "@/lib/vehicleClasses";
import { cn, formatNumber } from "@/lib/utils";

interface Props {
  /** Transmissões em andamento, uma por câmera. */
  streams: LiveStatus[];
  cameras: Camera[];
  /** Abre a câmera sozinha, com a contagem detalhada. */
  onOpen: (cameraId: number) => void;
  /** Veículos e pedestres da transmissão sob cada vídeo. */
  showCounts?: boolean;
}

/**
 * Mural: o vídeo anotado de todas as transmissões lado a lado, cada um com o
 * nome da câmera e a própria contagem. Cada vídeo é uma conexão MJPEG aberta
 * com a API; o navegador mantém no máximo seis por servidor.
 */
export default function LiveCameraWall({
  streams,
  cameras,
  onOpen,
  showCounts = true,
}: Props) {
  if (streams.length === 0) {
    return (
      <p className="text-ink-muted">
        Nenhuma câmera transmitindo. Volte para "Uma câmera" e inicie uma
        transmissão.
      </p>
    );
  }

  return (
    <ul
      className={cn(
        "grid grid-cols-1 gap-x-6 gap-y-8",
        streams.length > 1 && "md:grid-cols-2",
        streams.length > 4 && "2xl:grid-cols-3"
      )}
    >
      {streams.map((s) => {
        const name =
          cameras.find((c) => c.id === s.camera_id)?.name ??
          `Câmera ${s.camera_id}`;
        const { vehicles, pedestrians } = splitVehiclesAndPedestrians(s.by_type);
        return (
          <li key={s.camera_id} className="min-w-0">
            <button
              type="button"
              onClick={() => onOpen(s.camera_id)}
              aria-label={`Abrir a câmera ${name} sozinha`}
              className="group relative block aspect-video w-full overflow-hidden rounded-lg bg-black"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={liveMjpegUrl(s.camera_id)}
                alt={`Vídeo ao vivo da câmera ${name} com as detecções marcadas`}
                className="absolute inset-0 h-full w-full object-contain"
              />
              <span className="absolute left-2 top-2 rounded-sm bg-black/70 px-2 py-1 text-sm font-semibold text-white">
                {name}
              </span>
              <span className="absolute bottom-2 right-2 rounded-sm bg-black/70 px-2 py-1 text-sm font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                Abrir sozinha
              </span>
            </button>
            {showCounts && (
            <p className="mt-2 flex flex-wrap items-baseline gap-x-5 gap-y-1">
              <span>
                <strong className="font-display text-2xl font-semibold tabular-nums">
                  {formatNumber(vehicles)}
                </strong>{" "}
                <span className="text-sm text-ink-muted">
                  {vehicles === 1 ? "veículo" : "veículos"}
                </span>
              </span>
              <span>
                <strong className="font-display text-2xl font-semibold tabular-nums">
                  {formatNumber(pedestrians)}
                </strong>{" "}
                <span className="text-sm text-ink-muted">
                  {pedestrians === 1 ? "pedestre" : "pedestres"}
                </span>
              </span>
            </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
