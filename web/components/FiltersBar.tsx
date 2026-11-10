"use client";

import SegmentedControl from "@/components/SegmentedControl";
import type { City } from "@/lib/types";

export interface PeriodFilter {
  days: number;
  cityId?: number;
}

interface Props {
  cities: City[];
  value: PeriodFilter;
  onChange: (f: PeriodFilter) => void;
}

const DAY_PRESETS = [
  { label: "Hoje", value: 1 },
  { label: "7 dias", value: 7 },
  { label: "30 dias", value: 30 },
  { label: "90 dias", value: 90 },
  { label: "12 meses", value: 365 },
];

/** Período e cidade. O estado mora na página, que é quem busca os dados. */
export default function FiltersBar({ cities, value, onChange }: Props) {
  return (
    <div className="flex max-w-full flex-wrap items-end gap-x-4 gap-y-3">
      <div className="max-w-full">
        <SegmentedControl
          label="Período"
          options={DAY_PRESETS}
          value={value.days}
          onChange={(days) => onChange({ ...value, days })}
        />
        <p className="mt-1 text-sm text-ink-muted">
          {formatAbsoluteWindow(value.days)}
        </p>
      </div>

      {cities.length > 1 && (
        <label className="block w-full sm:w-56">
          <span className="sr-only">Cidade</span>
          <select
            className="input"
            value={value.cityId ?? ""}
            onChange={(e) =>
              onChange({
                ...value,
                cityId: e.target.value ? Number(e.target.value) : undefined,
              })
            }
          >
            <option value="">Todas as cidades</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-ink-soft">Cidade</span>
        </label>
      )}
    </div>
  );
}

/** Janela absoluta do período: "11 out – 09 nov". */
function formatAbsoluteWindow(days: number): string {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - Math.max(1, days - 1));
  const fmt = (d: Date) =>
    d
      .toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
        year: days > 300 ? "numeric" : undefined,
      })
      .replace(/\./g, "")
      .replace(/ de /g, " ");
  if (days === 1) return fmt(end);
  return `${fmt(start)} – ${fmt(end)}`;
}
