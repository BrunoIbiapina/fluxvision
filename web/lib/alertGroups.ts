import type { Alert, AlertLevel } from "@/lib/types";

export const ALERT_LEVEL_ORDER: AlertLevel[] = ["critical", "warning", "info"];

export const ALERT_LEVEL_LABEL: Record<AlertLevel, string> = {
  critical: "Crítico",
  warning: "Atenção",
  info: "Informativo",
};

export const ALERT_LEVEL_COLOR: Record<AlertLevel, string> = {
  critical: "text-critical",
  warning: "text-warning",
  info: "text-ink-muted",
};

/** A API grava created_at em UTC sem sufixo de fuso. */
export function alertDate(iso: string): Date {
  return new Date(/[zZ]|[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`);
}

/** "18 abr 2026, 18:30" no fuso de quem está vendo. */
export function formatAlertMoment(iso: string): string {
  return alertDate(iso)
    .toLocaleString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
    .replace(".", "")
    .replace(/ de /g, " ");
}

export interface AlertGroup {
  level: AlertLevel;
  title: string;
  count: number;
  /** created_at do alerta mais recente do grupo. */
  latest: string;
}

/** Agrupa por nível e título; críticos primeiro, depois os mais numerosos. */
export function groupAlertsByKind(alerts: Alert[]): AlertGroup[] {
  const byKey = new Map<string, AlertGroup>();
  for (const a of alerts) {
    const key = `${a.level}|${a.title}`;
    const g = byKey.get(key);
    if (!g) {
      byKey.set(key, { level: a.level, title: a.title, count: 1, latest: a.created_at });
    } else {
      g.count += 1;
      if (alertDate(a.created_at) > alertDate(g.latest)) g.latest = a.created_at;
    }
  }
  return [...byKey.values()].sort(
    (a, b) =>
      ALERT_LEVEL_ORDER.indexOf(a.level) - ALERT_LEVEL_ORDER.indexOf(b.level) ||
      b.count - a.count
  );
}

const STOPPED_SUBJECT: Record<string, string> = {
  person: "Pedestre parado na via",
  car: "Carro parado na via",
  motorcycle: "Moto parada na via",
  bus: "Ônibus parado na via",
  truck: "Caminhão parado na via",
  bicycle: "Bicicleta parada na via",
};

/**
 * Título de alerta para a tela. A API manda "Veículo parado — person", com a
 * classe do detector em inglês; aqui vira "Pedestre parado na via".
 */
export function formatAlertTitle(title: string): string {
  const stopped = title.match(/^Veículo parado\s+[—-]\s+(\w+)$/);
  if (stopped) return STOPPED_SUBJECT[stopped[1]] ?? "Veículo parado na via";
  return title;
}

/** Junta grupos de mesmo título (níveis diferentes) e ordena pelos mais numerosos. */
export function mergeAlertGroupsByTitle(groups: AlertGroup[]): AlertGroup[] {
  const byTitle = new Map<string, AlertGroup>();
  for (const g of groups) {
    const title = formatAlertTitle(g.title);
    const merged = byTitle.get(title);
    if (!merged) {
      byTitle.set(title, { ...g, title });
    } else {
      merged.count += g.count;
      if (alertDate(g.latest) > alertDate(merged.latest)) merged.latest = g.latest;
    }
  }
  return [...byTitle.values()].sort((a, b) => b.count - a.count);
}
