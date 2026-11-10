"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";

import PageHeader from "@/components/PageHeader";
import Sheet from "@/components/Sheet";
import {
  annotatedVideoUrl,
  getVideo,
  getVideoResult,
  heatmapUrl,
} from "@/lib/api";
import type { Video, VideoProcessResult } from "@/lib/types";
import { cn, formatNumber } from "@/lib/utils";
import { DETECTED_TYPE_LABEL } from "@/lib/vehicleClasses";
import { describeVideoStatus, formatVideoRecordedAt } from "@/lib/videoStatus";

const oneDecimal = (n: number) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function BackToUploadLink() {
  return (
    <Link href="/upload" className="btn-ghost -ml-2.5">
      <ArrowLeft size={16} aria-hidden />
      Enviar vídeo
    </Link>
  );
}

export default function VideoDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params?.id);

  const [video, setVideo] = useState<Video | null>(null);
  const [result, setResult] = useState<VideoProcessResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const [v, r] = await Promise.all([getVideo(id), getVideoResult(id)]);
      setVideo(v);
      setResult(r);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }

  useEffect(() => {
    if (!id) return;
    load();
    // Enquanto não estiver "done", faz polling leve.
    const t = setInterval(() => {
      if (video?.status !== "done") load();
    }, 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, video?.status]);

  if (!id || Number.isNaN(id)) {
    return (
      <div className="space-y-4">
        <BackToUploadLink />
        <PageHeader
          title="Vídeo não encontrado"
          description="O endereço não traz um número de vídeo válido. Abra o vídeo pela lista da tela Enviar vídeo."
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <BackToUploadLink />
        <p role="alert" className="alert-error">
          Não foi possível carregar o vídeo {id}: {error}. Recarregue a página
          ou abra o vídeo de novo pela tela Enviar vídeo.
        </p>
      </div>
    );
  }

  if (!video || !result) {
    return (
      <p role="status" className="flex items-center gap-2 text-ink-muted">
        <Loader2 size={16} className="animate-spin" aria-hidden />
        Carregando o vídeo…
      </p>
    );
  }

  const processing = video.status !== "done";
  const failed = video.status === "failed";
  const status = describeVideoStatus(video.status);
  const sortedTypes = Object.entries(result.by_type).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <BackToUploadLink />
        <PageHeader
          title={`Vídeo ${video.id}`}
          description={
            <>
              <span className="block font-semibold text-ink [overflow-wrap:anywhere]">
                {video.filename}
              </span>
              <span className="block">
                Câmera {video.camera_id}, gravado em{" "}
                <span className="tabular-nums">
                  {formatVideoRecordedAt(video.recorded_at)}
                </span>
              </span>
              <span className="block tabular-nums">
                {video.width}×{video.height} a {oneDecimal(video.fps)} quadros
                por segundo
              </span>
            </>
          }
          actions={
            <p className={cn("font-semibold", status.tone)}>
              <span className="sr-only">Estado: </span>
              {status.label}
            </p>
          }
        />
      </div>

      {processing &&
        (failed ? (
          <p role="alert" className="alert-error">
            O processamento deste vídeo falhou e não há contagem. Envie o
            arquivo de novo pela tela Enviar vídeo.
          </p>
        ) : (
          <p role="status" className="flex items-center gap-2 text-ink-muted">
            <Loader2 size={16} className="shrink-0 animate-spin" aria-hidden />
            {video.status === "pending"
              ? "O vídeo está na fila. A contagem aparece aqui quando o processamento terminar."
              : "Processando o vídeo. A contagem aparece aqui quando terminar."}
          </p>
        ))}

      <div className="grid grid-cols-1 gap-x-8 gap-y-6 lg:grid-cols-3">
        <Sheet title="Vídeo anotado" className="lg:col-span-2">
          {result.annotated_url ? (
            <video
              key={result.annotated_url}
              controls
              playsInline
              className="aspect-video w-full bg-black object-contain"
              src={annotatedVideoUrl(video.id)}
            />
          ) : (
            <div className="grid aspect-video place-items-center border border-dashed border-ink/50 px-4 text-center text-ink-muted">
              {failed
                ? "Sem vídeo anotado: o processamento falhou."
                : processing
                ? "O vídeo anotado aparece quando o processamento terminar."
                : "Este vídeo não tem versão anotada."}
            </div>
          )}
          <p className="mt-3 max-w-[75ch] text-sm text-ink-muted">
            Cada quadro traz a caixa de detecção, o tipo do veículo e o número
            do rastreio. A linha branca é a linha virtual de contagem.
          </p>
        </Sheet>

        <Sheet title="Contagem">
          <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-display text-5xl font-semibold leading-none tabular-nums">
              {formatNumber(result.total_vehicles)}
            </span>
            <span className="text-lg font-bold">
              {result.total_vehicles === 1 ? "veículo contado" : "veículos contados"}
            </span>
          </p>
          <p className="mt-2 text-sm text-ink-muted">
            em <span className="tabular-nums">{oneDecimal(result.duration_s)}</span>{" "}
            segundos de vídeo
          </p>

          {sortedTypes.length === 0 ? (
            <p className="mt-4 border-t border-bg-border pt-4 text-ink-muted">
              Nenhum veículo detectado.
            </p>
          ) : (
            <table className="sheet-table mt-4">
              <thead>
                <tr>
                  <th scope="col">Tipo</th>
                  <th scope="col" className="!text-right">Contagem</th>
                  <th scope="col" className="!text-right">Parte do total</th>
                </tr>
              </thead>
              <tbody>
                {sortedTypes.map(([type, count]) => {
                  const pct =
                    result.total_vehicles > 0
                      ? (count / result.total_vehicles) * 100
                      : 0;
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
        </Sheet>
      </div>

      {result.heatmap_url && (
        <Sheet title="Mapa de calor do vídeo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={heatmapUrl(video.id)}
            alt={`Mapa de calor do vídeo ${video.id}`}
            className="aspect-video w-full bg-black object-contain"
          />
          <p className="mt-3 max-w-[75ch] text-sm text-ink-muted">
            As regiões em vermelho concentraram mais tráfego durante o trecho
            analisado.
          </p>
        </Sheet>
      )}
    </div>
  );
}
