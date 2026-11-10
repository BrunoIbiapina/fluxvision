import type { VideoStatus } from "@/lib/types";

export interface VideoStatusDescription {
  /** Palavra mostrada na tela. */
  label: string;
  /** Classe de cor do estado; sempre acompanha a palavra, nunca a substitui. */
  tone: string;
}

const VIDEO_STATUS: Record<VideoStatus, VideoStatusDescription> = {
  pending: { label: "Na fila", tone: "text-warning" },
  processing: { label: "Processando", tone: "text-warning" },
  done: { label: "Concluído", tone: "text-positive" },
  failed: { label: "Falhou", tone: "text-negative" },
};

/** Estado do vídeo em português e a cor que o acompanha. */
export function describeVideoStatus(status: VideoStatus): VideoStatusDescription {
  return VIDEO_STATUS[status] ?? { label: String(status), tone: "text-ink-muted" };
}

/** Momento da gravação: "09 nov 2026, 14:30". */
export function formatVideoRecordedAt(iso: string): string {
  return new Date(iso)
    .toLocaleString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
    .replace(".", "");
}
