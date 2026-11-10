"use client";

import { Loader2, Play, Square } from "lucide-react";

interface Props {
  cameraName?: string;
  hasCamera: boolean;
  running: boolean;
  /** Endereço do MJPEG anotado; só é usado enquanto a transmissão roda. */
  streamSrc: string | null;
  /** Trocar a chave remonta o <img> e obriga o navegador a reabrir o MJPEG. */
  streamKey: string;
  fpsLabel: string | null;
  busy: boolean;
  onStart: () => void;
  onStop: () => void;
}

/**
 * Vidraça do vídeo ao vivo. A proporção 16:9 é fixa para a página não pular
 * quando o primeiro quadro chega; o estado parado ocupa a mesma área.
 */
export default function LiveStreamViewport({
  cameraName,
  hasCamera,
  running,
  streamSrc,
  streamKey,
  fpsLabel,
  busy,
  onStart,
  onStop,
}: Props) {
  const showStream = running && streamSrc !== null;

  return (
    <div>
      <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
        {showStream ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={streamKey}
              src={streamSrc}
              alt={
                cameraName
                  ? `Vídeo ao vivo da câmera ${cameraName}, com os veículos marcados`
                  : "Vídeo ao vivo com os veículos marcados"
              }
              className="absolute inset-0 h-full w-full object-contain"
            />
            <p className="absolute left-2 top-2 inline-flex items-center gap-1.5 rounded-sm bg-black/70 px-2 py-1 text-xs font-semibold text-white">
              <span
                className="h-2 w-2 rounded-full bg-white motion-safe:animate-pulse"
                aria-hidden
              />
              Ao vivo
            </p>
            {fpsLabel && (
              <p className="absolute right-2 top-2 rounded-sm bg-black/70 px-2 py-1 text-xs font-semibold tabular-nums text-white">
                {fpsLabel}
              </p>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center">
            <p className="max-w-[46ch] text-sm text-white">
              {hasCamera
                ? "Transmissão parada. Confira a fonte da câmera e inicie para ver o vídeo com os veículos marcados."
                : "Escolha uma câmera em Fonte da transmissão para iniciar."}
            </p>
            <button
              type="button"
              className="btn-primary"
              onClick={onStart}
              disabled={busy || !hasCamera}
            >
              {busy ? (
                <Loader2 size={16} className="animate-spin" aria-hidden />
              ) : (
                <Play size={16} aria-hidden />
              )}
              Iniciar transmissão
            </button>
          </div>
        )}
      </div>

      {running && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p className="max-w-[60ch] text-sm text-ink-muted">
            Se a imagem parar, recarregue a página para reconectar o vídeo.
          </p>
          <button
            type="button"
            className="btn-danger"
            onClick={onStop}
            disabled={busy}
          >
            {busy ? (
              <Loader2 size={16} className="animate-spin" aria-hidden />
            ) : (
              <Square size={16} aria-hidden />
            )}
            Parar transmissão
          </button>
        </div>
      )}
    </div>
  );
}
