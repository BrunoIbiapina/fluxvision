import type { TimeseriesPoint } from "@/lib/types";

export type VehicleClassKey =
  | "cars"
  | "motorcycles"
  | "buses"
  | "trucks"
  | "others";

export interface VehicleClass {
  key: VehicleClassKey;
  label: string;
  /** Tom de tinta da série: uma rampa só, da mais escura para a mais clara. */
  tone: string;
}

/**
 * Classes de veículo na ordem da ficha de contagem. Pedestre fica de fora:
 * é contagem paralela e nunca soma em "veículos".
 */
export const VEHICLE_CLASSES: VehicleClass[] = [
  { key: "cars", label: "Carros", tone: "rgb(var(--ink))" },
  { key: "motorcycles", label: "Motos", tone: "rgb(var(--ink) / 0.72)" },
  { key: "buses", label: "Ônibus", tone: "rgb(var(--ink) / 0.54)" },
  { key: "trucks", label: "Caminhões", tone: "rgb(var(--ink) / 0.4)" },
  { key: "others", label: "Outros", tone: "rgb(var(--ink) / 0.28)" },
];

export type VehicleClassTotals = Record<VehicleClassKey, number> & {
  total: number;
  pedestrians: number;
};

export function sumVehicleClasses(points: TimeseriesPoint[]): VehicleClassTotals {
  const acc: VehicleClassTotals = {
    cars: 0,
    motorcycles: 0,
    buses: 0,
    trucks: 0,
    others: 0,
    total: 0,
    pedestrians: 0,
  };
  for (const p of points) {
    acc.cars += p.cars;
    acc.motorcycles += p.motorcycles;
    acc.buses += p.buses;
    acc.trucks += p.trucks;
    acc.others += p.others;
    acc.total += p.total;
    acc.pedestrians += p.pedestrians ?? 0;
  }
  return acc;
}

/**
 * Rótulo de cada tipo que o detector devolve em `by_type` (ao vivo e vídeo
 * processado). "person" é pedestre: aparece na lista, mas não é veículo.
 */
export const DETECTED_TYPE_LABEL: Record<string, string> = {
  car: "Carros",
  motorcycle: "Motos",
  bus: "Ônibus",
  truck: "Caminhões",
  bicycle: "Bicicletas",
  van: "Vans",
  person: "Pedestres",
  other: "Outros",
};

/** Separa `by_type` em veículos e pedestres: pedestre nunca soma em veículos. */
export function splitVehiclesAndPedestrians(
  byType: Record<string, number> | undefined | null
): { vehicles: number; pedestrians: number } {
  let vehicles = 0;
  let pedestrians = 0;
  for (const [type, count] of Object.entries(byType ?? {})) {
    if (type === "person") pedestrians += count;
    else vehicles += count;
  }
  return { vehicles, pedestrians };
}
