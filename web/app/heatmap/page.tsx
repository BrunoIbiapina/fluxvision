"use client";

import { useEffect, useState } from "react";

import MapView from "@/components/MapView";
import { getGeo } from "@/lib/api";
import type { GeoPoint } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

export default function HeatmapPage() {
  const [points, setPoints] = useState<GeoPoint[]>([]);
  const [days, setDays] = useState(30);

  useEffect(() => {
    getGeo(days).then(setPoints).catch(() => {});
  }, [days]);

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Mapa de calor</h1>
          <p className="text-sm text-ink-muted mt-1">
            Geointeligência do fluxo: identifique onde a intensidade é maior
            e quais áreas merecem atenção da segurança.
          </p>
        </div>
        <div className="flex gap-1">
          {[7, 30, 90, 365].map((d) => (
            <button
              key={d}
              className={`px-3 py-1.5 text-xs rounded-md border ${
                days === d
                  ? "bg-brand/15 border-brand/40 text-brand"
                  : "border-bg-border text-ink-muted hover:text-ink"
              }`}
              onClick={() => setDays(d)}
            >
              {d} dias
            </button>
          ))}
        </div>
      </header>

      <MapView points={points} height={520} />

      {points.length === 0 ? (
        <div className="card p-6 text-sm text-ink-muted text-center">
          Nenhum ponto com dados no período. Envie vídeos ou inicie streams
          para que o mapa ganhe vida.
        </div>
      ) : (
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {points.slice(0, 3).map((p) => (
            <div key={p.camera_id} className="card p-5">
              <div className="flex items-center justify-between text-xs text-ink-muted">
                <span>{p.city_name}</span>
                <span>intensidade {Math.round(p.intensity * 100)}%</span>
              </div>
              <div className="mt-2 text-base font-semibold">{p.camera_name}</div>
              <div className="mt-3 text-3xl font-bold">
                {formatNumber(p.total)}
              </div>
              <div className="text-xs text-ink-muted">
                veículos no período
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
