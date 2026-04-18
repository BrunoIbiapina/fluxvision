"use client";

import { Building2, Calendar, Filter } from "lucide-react";
import { useState } from "react";

import type { City } from "@/lib/types";

interface Props {
  cities: City[];
  onChange?: (f: { days: number; cityId?: number }) => void;
}

const DAY_PRESETS = [
  { label: "Hoje", days: 1 },
  { label: "7 dias", days: 7 },
  { label: "30 dias", days: 30 },
  { label: "90 dias", days: 90 },
  { label: "12 meses", days: 365 },
];

export default function FiltersBar({ cities, onChange }: Props) {
  const [days, setDays] = useState(30);
  const [cityId, setCityId] = useState<number | undefined>(undefined);

  function emit(nextDays = days, nextCity = cityId) {
    onChange?.({ days: nextDays, cityId: nextCity });
  }

  return (
    <div className="card p-3 flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1 text-xs text-ink-muted">
        <Filter size={13} /> Período
      </div>
      <div className="flex flex-wrap gap-1">
        {DAY_PRESETS.map((p) => (
          <button
            key={p.label}
            className={`px-3 py-1.5 text-xs rounded-md border ${
              days === p.days
                ? "bg-brand/15 border-brand/40 text-brand"
                : "border-bg-border text-ink-muted hover:text-ink"
            }`}
            onClick={() => {
              setDays(p.days);
              emit(p.days, cityId);
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="mx-2 h-6 w-px bg-bg-border" />

      <div className="flex items-center gap-1 text-xs text-ink-muted">
        <Building2 size={13} /> Cidade
      </div>
      <select
        className="bg-bg-elevated border border-bg-border rounded-md px-2 py-1.5 text-xs text-ink outline-none"
        value={cityId ?? ""}
        onChange={(e) => {
          const v = e.target.value ? Number(e.target.value) : undefined;
          setCityId(v);
          emit(days, v);
        }}
      >
        <option value="">Todas as cidades</option>
        {cities.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
            {c.camera_count ? ` · ${c.camera_count} câm.` : ""}
          </option>
        ))}
      </select>

      <div className="ml-auto flex items-center gap-1 text-xs text-ink-muted">
        <Calendar size={13} /> referência: últimos {days} dia{days > 1 ? "s" : ""}
      </div>
    </div>
  );
}
