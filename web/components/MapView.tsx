"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";

import type { GeoPoint } from "@/lib/types";
import { categoryLabel, formatNumber } from "@/lib/utils";

const MapContainer = dynamic(() => import("react-leaflet").then((m) => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then((m) => m.TileLayer), { ssr: false });
const CircleMarker = dynamic(() => import("react-leaflet").then((m) => m.CircleMarker), { ssr: false });
const Popup = dynamic(() => import("react-leaflet").then((m) => m.Popup), { ssr: false });

interface Props {
  points: GeoPoint[];
  height?: number;
}

// ---------------- basemaps ----------------
type BasemapId = "dark" | "streets" | "satellite";

interface BasemapDef {
  id: BasemapId;
  label: string;
  url: string;
  attribution: string;
  subdomains?: string[];
  maxZoom: number;
}

const BASEMAPS: BasemapDef[] = [
  {
    id: "dark",
    label: "Noturno",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OpenStreetMap &copy; CARTO",
    subdomains: ["a", "b", "c", "d"],
    maxZoom: 19,
  },
  {
    id: "streets",
    label: "Ruas",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap contributors",
    subdomains: ["a", "b", "c"],
    maxZoom: 19,
  },
  {
    id: "satellite",
    label: "Satélite",
    url:
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution:
      "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics",
    maxZoom: 19,
  },
];

function radius(intensity: number): number {
  return 8 + intensity * 24;
}

function color(intensity: number): string {
  if (intensity > 0.75) return "#ef4444";
  if (intensity > 0.5)  return "#fbbf24";
  if (intensity > 0.25) return "#38bdf8";
  return "#34d399";
}

// Calcula bounding box dos pontos (lat min, lng min, lat max, lng max)
function bbox(points: GeoPoint[]) {
  let latMin = +Infinity,
    latMax = -Infinity,
    lngMin = +Infinity,
    lngMax = -Infinity;
  for (const p of points) {
    if (p.latitude < latMin) latMin = p.latitude;
    if (p.latitude > latMax) latMax = p.latitude;
    if (p.longitude < lngMin) lngMin = p.longitude;
    if (p.longitude > lngMax) lngMax = p.longitude;
  }
  return { latMin, latMax, lngMin, lngMax };
}

// Dado o bbox escolhe um zoom razoável (heurística simples pra tiles 256px).
function zoomForSpread(latSpread: number, lngSpread: number): number {
  const spread = Math.max(latSpread, lngSpread);
  if (spread < 0.005) return 15; // menos de ~500m
  if (spread < 0.02) return 13;
  if (spread < 0.1) return 11;
  if (spread < 0.5) return 9;
  if (spread < 2) return 7;
  if (spread < 10) return 5;
  return 4;
}

export default function MapView({ points, height = 420 }: Props) {
  // Carrega o CSS do Leaflet só no client (evita FOUC)
  const [ready, setReady] = useState(false);
  useEffect(() => {
    (async () => {
      // @ts-ignore
      await import("leaflet/dist/leaflet.css");
      setReady(true);
    })();
  }, []);

  // Basemap ativo — começa no "Ruas" porque é o que mostra nome de avenida
  const [basemapId, setBasemapId] = useState<BasemapId>("streets");
  const basemap = BASEMAPS.find((b) => b.id === basemapId) ?? BASEMAPS[0];

  // Calcula centro + zoom inicial sempre que os pontos mudam.
  // Usamos um key no MapContainer pra ele remontar no zoom correto
  // (evita problemas de tiles não carregarem após setView animado).
  const { center, zoom, mapKey } = useMemo(() => {
    if (!points.length) {
      return {
        center: [-15.78, -47.93] as [number, number], // Brasília fallback
        zoom: 4,
        mapKey: "empty",
      };
    }
    if (points.length === 1) {
      const p = points[0];
      return {
        center: [p.latitude, p.longitude] as [number, number],
        zoom: 14, // nível de rua, sem extrapolar tiles
        mapKey: `${p.camera_id}:${p.latitude.toFixed(4)},${p.longitude.toFixed(4)}`,
      };
    }
    const b = bbox(points);
    const center: [number, number] = [
      (b.latMin + b.latMax) / 2,
      (b.lngMin + b.lngMax) / 2,
    ];
    const z = zoomForSpread(b.latMax - b.latMin, b.lngMax - b.lngMin);
    const ids = points.map((p) => p.camera_id).join(",");
    return { center, zoom: z, mapKey: `multi:${ids}` };
  }, [points]);

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-semibold">Mapa de calor geográfico</h3>
          <p className="text-xs text-ink-muted">
            Intensidade proporcional ao fluxo acumulado no período
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* seletor de basemap */}
          <div className="flex gap-1">
            {BASEMAPS.map((b) => (
              <button
                key={b.id}
                onClick={() => setBasemapId(b.id)}
                className={`px-2.5 py-1 text-[11px] rounded-md border transition-colors ${
                  basemapId === b.id
                    ? "bg-brand/15 border-brand/40 text-brand"
                    : "border-bg-border text-ink-muted hover:text-ink"
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>
          <div className="hidden md:flex items-center gap-2 text-xs text-ink-muted">
            <Legend color="#34d399" label="baixo" />
            <Legend color="#38bdf8" label="médio" />
            <Legend color="#fbbf24" label="alto" />
            <Legend color="#ef4444" label="crítico" />
          </div>
        </div>
      </div>

      <div style={{ height }} className="rounded-lg overflow-hidden border border-bg-border">
        {ready && (
          <MapContainer
            key={mapKey}
            center={center}
            zoom={zoom}
            scrollWheelZoom={true}
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer
              key={basemap.id}
              attribution={basemap.attribution}
              url={basemap.url}
              subdomains={basemap.subdomains}
              maxZoom={basemap.maxZoom}
            />
            {points.map((p) => (
              <CircleMarker
                key={p.camera_id}
                center={[p.latitude, p.longitude]}
                radius={radius(p.intensity)}
                pathOptions={{
                  color: color(p.intensity),
                  fillColor: color(p.intensity),
                  fillOpacity: 0.4,
                  weight: 1.5,
                }}
              >
                <Popup>
                  <div style={{ minWidth: 180 }}>
                    <div style={{ fontWeight: 600 }}>{p.camera_name}</div>
                    <div style={{ fontSize: 11, opacity: 0.7 }}>
                      {p.city_name} · {categoryLabel(p.category)}
                    </div>
                    <div style={{ fontSize: 11, opacity: 0.7, fontFamily: "monospace" }}>
                      {p.latitude.toFixed(6)}, {p.longitude.toFixed(6)}
                    </div>
                    <div style={{ marginTop: 6, fontSize: 13 }}>
                      <b>{formatNumber(p.total)}</b> veículos no período
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        )}
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}
