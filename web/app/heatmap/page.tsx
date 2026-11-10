"use client";

import { useEffect, useState } from "react";

import MapView from "@/components/MapView";
import PageHeader from "@/components/PageHeader";
import SegmentedControl from "@/components/SegmentedControl";
import Sheet from "@/components/Sheet";
import { getGeo } from "@/lib/api";
import type { GeoPoint } from "@/lib/types";
import { categoryLabel, formatNumber } from "@/lib/utils";

const PERIODS = [
  { value: 7, label: "7 dias" },
  { value: 30, label: "30 dias" },
  { value: 90, label: "90 dias" },
  { value: 365, label: "12 meses" },
];

export default function HeatmapPage() {
  const [points, setPoints] = useState<GeoPoint[]>([]);
  const [days, setDays] = useState(30);

  useEffect(() => {
    getGeo(days).then(setPoints).catch(() => {});
  }, [days]);

  const ranked = [...points].sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-10">
      <PageHeader
        title="Mapa de calor"
        description="Onde cada câmera está e quanto fluxo ela contou no período."
        actions={
          <SegmentedControl
            label="Período"
            options={PERIODS}
            value={days}
            onChange={setDays}
          />
        }
      />

      <MapView points={points} height={520} />

      <Sheet title="Pontos no mapa" note="Do maior para o menor fluxo">
        {ranked.length === 0 ? (
          <p className="py-8 text-ink-muted">
            Nenhuma câmera com contagem no período. Escolha um período maior,
            envie um vídeo ou inicie uma transmissão.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="sheet-table min-w-[520px]">
              <thead>
                <tr>
                  <th scope="col" >Câmera</th>
                  <th scope="col">Tipo</th>
                  <th scope="col" className="!text-right">Veículos</th>
                  <th scope="col" className="!text-right">Fluxo relativo</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((p) => (
                  <tr key={p.camera_id}>
                    <td >
                      <span className="font-semibold">{p.camera_name}</span>
                      <span className="block text-sm text-ink-muted">{p.city_name}</span>
                    </td>
                    <td className="text-ink-muted">{categoryLabel(p.category)}</td>
                    <td className="num font-semibold">{formatNumber(p.total)}</td>
                    <td className="num text-ink-muted">
                      {Math.round(p.intensity * 100)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Sheet>
    </div>
  );
}
