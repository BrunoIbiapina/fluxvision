import clsx, { ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("pt-BR").format(n);
}

export function formatPct(n: number, withSign = true): string {
  const sign = n > 0 ? "+" : "";
  return `${withSign ? sign : ""}${n.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

export function shortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function shortHour(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function categoryLabel(c: string): string {
  return (
    {
      avenue: "Avenida",
      crossing: "Cruzamento",
      highway: "Rodovia",
      event_gate: "Entrada de evento",
      square: "Praça",
      parking: "Estacionamento",
      other: "Outro",
    }[c] ?? c
  );
}

export type BucketGranularity = "hour" | "day";

/** Rótulo de um intervalo da série: "17 abr, 16h" ou "17 abr". */
export function formatBucketLabel(
  iso: string,
  granularity: BucketGranularity
): string {
  const d = new Date(iso);
  const day = d
    .toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
    .replace(".", "")
    .replace(" de ", " ");
  if (granularity === "day") return day;
  return `${day}, ${String(d.getHours()).padStart(2, "0")}h`;
}

/** "há 3 min", "há 5 h", "há 12 dias" a partir de um ISO. */
export function formatElapsed(iso: string, now = new Date()): string {
  const minutes = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.round(hours / 24);
  return `há ${days} dia${days === 1 ? "" : "s"}`;
}
