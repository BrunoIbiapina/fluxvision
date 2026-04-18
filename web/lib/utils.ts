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
  return `${withSign ? sign : ""}${n.toFixed(1)}%`;
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
