"use client";

import { Activity, Building2, Car, Gauge, TrendingUp, Zap } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import AlertsPanel from "@/components/AlertsPanel";
import DailyFlowChart from "@/components/DailyFlowChart";
import FiltersBar from "@/components/FiltersBar";
import HourlyFlowChart from "@/components/HourlyFlowChart";
import KpiCard from "@/components/KpiCard";
import LocationRanking from "@/components/LocationRanking";
import MapView from "@/components/MapView";
import VehicleTypeBreakdown from "@/components/VehicleTypeBreakdown";
import {
  getAlerts,
  getCities,
  getDaily,
  getGeo,
  getHourly,
  getKpis,
  getRanking,
} from "@/lib/api";
import type {
  Alert,
  City,
  GeoPoint,
  Kpi,
  RankingRow,
  TimeseriesPoint,
} from "@/lib/types";

export default function DashboardPage() {
  const [cities, setCities] = useState<City[]>([]);
  const [kpi, setKpi] = useState<Kpi | null>(null);
  const [hourly, setHourly] = useState<TimeseriesPoint[]>([]);
  const [daily, setDaily] = useState<TimeseriesPoint[]>([]);
  const [ranking, setRanking] = useState<RankingRow[]>([]);
  const [geo, setGeo] = useState<GeoPoint[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [filters, setFilters] = useState<{ days: number; cityId?: number }>({
    days: 30,
  });
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadAll() {
    setLoading(true);
    setErr(null);
    try {
      const [cs, k, h, d, r, g, a] = await Promise.all([
        getCities(),
        getKpis(filters.days, filters.cityId),
        getHourly(Math.min(14, filters.days), filters.cityId),
        getDaily(Math.min(60, filters.days), filters.cityId),
        getRanking(filters.days, filters.cityId),
        getGeo(filters.days, filters.cityId),
        getAlerts(true),
      ]);
      setCities(cs);
      setKpi(k);
      setHourly(h);
      setDaily(d);
      setRanking(r);
      setGeo(g);
      setAlerts(a);
    } catch (e: any) {
      setErr(e?.message ?? "Falha ao carregar dados.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.days, filters.cityId]);

  const hasCities = cities.length > 0;
  const hasData = (kpi?.total ?? 0) > 0 || ranking.length > 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
          <p className="text-ink-muted text-sm mt-1">
            Visão consolidada do fluxo urbano. Dados vêm dos vídeos enviados e
            das câmeras ao vivo cadastradas.
          </p>
          <CaptureWindow kpi={kpi} />
        </div>
        <FiltersBar cities={cities} onChange={setFilters} />
      </header>

      {err && (
        <div className="card p-4 border-negative/40 bg-negative/10 text-negative text-sm">
          {err}
        </div>
      )}

      {/* Empty state global — nenhuma cidade cadastrada */}
      {!loading && !hasCities && (
        <div className="card p-10 text-center">
          <Building2 size={28} className="mx-auto text-ink-muted" />
          <h2 className="mt-3 text-lg font-semibold">
            Nenhuma cidade cadastrada ainda
          </h2>
          <p className="mt-1 text-sm text-ink-muted max-w-md mx-auto">
            Comece cadastrando uma cidade e uma câmera em{" "}
            <Link href="/cameras" className="text-brand hover:underline">
              /cameras
            </Link>
            . Depois envie um vídeo em{" "}
            <Link href="/upload" className="text-brand hover:underline">
              /upload
            </Link>{" "}
            ou inicie uma stream em{" "}
            <Link href="/live" className="text-brand hover:underline">
              /live
            </Link>{" "}
            — o dashboard se preenche sozinho.
          </p>
        </div>
      )}

      {hasCities && (
        <>
          {/* KPIs */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Fluxo total (período)"
              value={kpi?.total ?? 0}
              variationPct={kpi?.variation_pct_vs_previous}
              icon={<Car size={16} />}
              accent="brand"
              subValue={`vs. período anterior (${filters.days} dias)`}
            />
            <KpiCard
              label="Média por hora"
              value={kpi?.avg_per_hour ?? 0}
              icon={<Gauge size={16} />}
              accent="positive"
              subValue="veículos / hora"
            />
            <KpiCard
              label="Horário de pico"
              value={kpi?.peak_hour ?? "—"}
              icon={<TrendingUp size={16} />}
              accent="warning"
              subValue={
                kpi?.peak_value ? `pico médio: ${kpi.peak_value}` : "sem dados"
              }
            />
            <KpiCard
              label="Alertas ativos"
              value={kpi?.active_alerts ?? 0}
              icon={<Zap size={16} />}
              accent={kpi?.active_alerts ? "negative" : "positive"}
              subValue={
                kpi?.active_alerts
                  ? "requerem atenção"
                  : "tudo dentro do normal"
              }
            />
          </section>

          {!loading && !hasData && (
            <div className="card p-6 text-sm text-ink-muted">
              Nenhuma métrica ainda para o período. Envie um vídeo em{" "}
              <Link href="/upload" className="text-brand hover:underline">
                /upload
              </Link>{" "}
              ou inicie uma câmera em{" "}
              <Link href="/live" className="text-brand hover:underline">
                /live
              </Link>
              .
            </div>
          )}

          {/* Linha 2: gráfico horário + alertas */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <HourlyFlowChart data={hourly} />
            </div>
            <AlertsPanel alerts={alerts} compact />
          </section>

          {/* Linha 3: mapa + ranking */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <MapView points={geo} />
            </div>
            <LocationRanking rows={ranking} />
          </section>

          {/* Linha 4: diário + mix de veículos */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <DailyFlowChart data={daily} />
            </div>
            <VehicleTypeBreakdown data={daily} />
          </section>
        </>
      )}

      <footer className="text-center text-xs text-ink-soft pt-2 pb-6 flex items-center justify-center gap-2">
        <Building2 size={12} /> {cities.length} cidade
        {cities.length === 1 ? "" : "s"} ·{" "}
        <Activity size={12} /> {kpi?.unique_cameras ?? 0} câmeras ·{" "}
        FluxVision v0.1.0
        {loading && <span className="text-brand">· carregando…</span>}
      </footer>
    </div>
  );
}

/**
 * Faixa informativa logo abaixo do título: indica a janela real de
 * dados capturados (primeiro bucket com contagem até o último). Sem
 * isso o usuário vê "média/hora" e "pico" sem saber que o recorte é,
 * na prática, a sessão de captura que ele iniciou há pouco.
 */
function CaptureWindow({ kpi }: { kpi: Kpi | null }) {
  if (!kpi || !kpi.data_start || !kpi.data_end) {
    return (
      <p className="text-xs text-ink-muted mt-2 flex items-center gap-1.5">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-ink-muted" />
        Aguardando primeira captura — inicie uma câmera em /live ou envie um
        vídeo em /upload.
      </p>
    );
  }
  const start = new Date(kpi.data_start);
  const end = new Date(kpi.data_end);
  // Duração em horas, usando horas distintas com dado pra não superestimar
  // janelas com buracos (captura fragmentada).
  const hours = kpi.hours_with_data || 1;
  const fmt = (d: Date) =>
    d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  return (
    <p className="text-xs text-ink-muted mt-2 flex items-center gap-1.5 flex-wrap">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-positive animate-pulse" />
      Dados de <span className="text-ink">{fmt(start)}</span> até{" "}
      <span className="text-ink">{fmt(end)}</span>
      <span className="text-ink-soft">
        · {hours}h distinta{hours === 1 ? "" : "s"} com contagem
      </span>
    </p>
  );
}
