"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Bike,
  Bus,
  Car,
  Loader2,
  Package,
  Truck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  annotatedVideoUrl,
  getVideo,
  getVideoResult,
  heatmapUrl,
} from "@/lib/api";
import type { Video, VideoProcessResult } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

const TYPE_META: Record<string, { label: string; icon: LucideIcon }> = {
  car: { label: "Carros", icon: Car },
  motorcycle: { label: "Motos", icon: Bike },
  bus: { label: "Ônibus", icon: Bus },
  truck: { label: "Caminhões", icon: Truck },
  bicycle: { label: "Bicicletas", icon: Bike },
  van: { label: "Vans", icon: Package },
  other: { label: "Outros", icon: Package },
};

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
    return <div className="text-sm text-ink-muted">ID de vídeo inválido.</div>;
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Link
          href="/upload"
          className="inline-flex items-center gap-1 text-sm text-brand"
        >
          <ArrowLeft size={14} /> voltar
        </Link>
        <div className="card p-5 text-sm text-negative">{error}</div>
      </div>
    );
  }

  if (!video || !result) {
    return (
      <div className="flex items-center gap-2 text-sm text-ink-muted">
        <Loader2 size={14} className="animate-spin" /> carregando vídeo…
      </div>
    );
  }

  const processing = video.status !== "done";
  const sortedTypes = Object.entries(result.by_type).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6">
      <Link
        href="/upload"
        className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink"
      >
        <ArrowLeft size={14} /> todos os vídeos
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold truncate max-w-[70ch]">
            {video.filename}
          </h1>
          <p className="text-sm text-ink-muted mt-1">
            Câmera {video.camera_id} ·{" "}
            {new Date(video.recorded_at).toLocaleString("pt-BR")} ·{" "}
            {video.width}×{video.height} @ {video.fps.toFixed(1)} fps
          </p>
        </div>
        <span
          className={`chip ${
            video.status === "done"
              ? "text-positive border-positive/40"
              : video.status === "failed"
              ? "text-negative border-negative/40"
              : "text-warning border-warning/40"
          }`}
        >
          {video.status}
        </span>
      </header>

      {processing && (
        <div className="card p-4 flex items-center gap-2 text-sm text-ink-muted">
          <Loader2 size={14} className="animate-spin text-brand" />
          Processando vídeo… os resultados aparecem quando terminar.
        </div>
      )}

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card p-4">
          <h3 className="text-sm font-semibold mb-3">
            Vídeo anotado pela IA
          </h3>
          {result.annotated_url ? (
            <video
              key={result.annotated_url}
              controls
              playsInline
              className="w-full rounded-lg bg-black"
              src={annotatedVideoUrl(video.id)}
            />
          ) : (
            <div className="aspect-video rounded-lg border border-dashed border-bg-border grid place-items-center text-sm text-ink-muted">
              {processing
                ? "Aguardando fim do processamento…"
                : "Vídeo anotado indisponível para este item."}
            </div>
          )}
          <p className="text-xs text-ink-muted mt-2">
            Bounding boxes, rótulo do tipo e ID do track desenhados em cada
            frame. A linha branca é a linha virtual de contagem.
          </p>
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <div className="text-xs uppercase tracking-wider text-ink-muted">
              Veículos contados
            </div>
            <div className="text-4xl font-bold mt-1">
              {formatNumber(result.total_vehicles)}
            </div>
            <div className="text-xs text-ink-muted mt-1">
              em {result.duration_s.toFixed(1)}s de vídeo
            </div>
          </div>

          <div className="card p-5">
            <h3 className="text-sm font-semibold mb-3">Por tipo de veículo</h3>
            <ul className="space-y-2">
              {sortedTypes.length === 0 && (
                <li className="text-xs text-ink-muted">
                  Nenhum veículo detectado.
                </li>
              )}
              {sortedTypes.map(([type, count]) => {
                const meta = TYPE_META[type] ?? {
                  label: type,
                  icon: Package,
                };
                const Icon = meta.icon;
                const pct =
                  result.total_vehicles > 0
                    ? (count / result.total_vehicles) * 100
                    : 0;
                return (
                  <li key={type} className="text-sm">
                    <div className="flex items-center gap-2">
                      <Icon size={14} />
                      <span className="flex-1">{meta.label}</span>
                      <span className="font-semibold">{formatNumber(count)}</span>
                      <span className="text-xs text-ink-muted w-10 text-right">
                        {pct.toFixed(0)}%
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 bg-bg-elevated rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </section>

      {result.heatmap_url && (
        <section className="card p-4">
          <h3 className="text-sm font-semibold mb-3">
            Mapa de calor do vídeo
          </h3>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={heatmapUrl(video.id)}
            alt="Heatmap"
            className="w-full rounded-lg border border-bg-border"
          />
          <p className="text-xs text-ink-muted mt-2">
            Regiões em vermelho concentraram mais tráfego durante o período
            analisado.
          </p>
        </section>
      )}
    </div>
  );
}
