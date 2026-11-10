"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";

import SegmentedControl from "@/components/SegmentedControl";
import Sheet from "@/components/Sheet";
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

// Rampa sequencial de um matiz só: quanto mais fluxo, mais escuro o verde.
const INTENSITY_STEPS = [
  { min: 0.75, color: "#063D28", label: "muito alto" },
  { min: 0.5, color: "#0B6B45", label: "alto" },
  { min: 0.25, color: "#3F9C73", label: "médio" },
  { min: 0, color: "#8CC9AC", label: "baixo" },
];

function color(intensity: number): string {
  return (INTENSITY_STEPS.find((s) => intensity > s.min) ?? INTENSITY_STEPS[3]).color;
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

export default function MapView({ points: allPoints, height = 420 }: Props) {
  // Câmera cadastrada sem coordenadas vem como 0, 0 e jogaria o mapa no oceano.
  const points = useMemo(
    () => allPoints.filter((p) => !(p.latitude === 0 && p.longitude === 0)),
    [allPoints]
  );
  const unlocated = allPoints.filter((p) => p.latitude === 0 && p.longitude === 0);
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
  // No tema escuro o mapa claro vira um bloco branco no meio da página.
  useEffect(() => {
    const theme = document.documentElement.dataset.theme;
    const dark =
      theme === "dark" ||
      (theme !== "light" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (dark) setBasemapId("dark");
  }, []);
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
    <Sheet
      title="Mapa das câmeras"
      aside={
        <SegmentedControl
          label="Mapa de base"
          options={BASEMAPS.map((b) => ({ value: b.id, label: b.label }))}
          value={basemapId}
          onChange={setBasemapId}
        />
      }
    >
      <div style={{ height }} className="isolate overflow-hidden rounded-lg">
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
                  fillOpacity: 0.55,
                  weight: 1.5,
                }}
              >
                <Popup>
                  <div style={{ minWidth: 180 }}>
                    <div style={{ fontWeight: 600 }}>{p.camera_name}</div>
                    <div style={{ fontSize: 11, opacity: 0.7 }}>
                      {p.city_name}, {categoryLabel(p.category).toLowerCase()}
                    </div>
                    <div style={{ fontSize: 11, opacity: 0.7 }}>
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
      {unlocated.length > 0 && (
        <p className="pt-3 text-sm text-ink-muted">
          Fora do mapa por falta de coordenadas:{" "}
          {unlocated.map((p) => p.camera_name).join(", ")}. Informe latitude e
          longitude na tela Câmeras.
        </p>
      )}
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-3 text-sm text-ink-muted">
        <span>Fluxo relativo:</span>
        {[...INTENSITY_STEPS].reverse().map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5">
            <span
              className="h-3 w-3 rounded-full ring-1 ring-bg-border"
              style={{ background: s.color }}
              aria-hidden
            />
            {s.label}
          </span>
        ))}
      </p>
    </Sheet>
  );
}
