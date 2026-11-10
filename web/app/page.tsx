"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import CameraScopeControl, {
  type CameraScope,
} from "@/components/CameraScopeControl";
import ClassifiedCountSheet from "@/components/ClassifiedCountSheet";
import CountSummary from "@/components/CountSummary";
import DailyFlowChart from "@/components/DailyFlowChart";
import FiltersBar, { type PeriodFilter } from "@/components/FiltersBar";
import LocationRanking from "@/components/LocationRanking";
import MapView from "@/components/MapView";
import OverviewCameraDetails from "@/components/OverviewCameraDetails";
import OverviewLiveNow from "@/components/OverviewLiveNow";
import PageHeader from "@/components/PageHeader";
import Sheet from "@/components/Sheet";
import {
  getCameras,
  getCities,
  getDaily,
  getGeo,
  getHourly,
  getKpis,
  getRanking,
} from "@/lib/api";
import type {
  Camera,
  City,
  GeoPoint,
  Kpi,
  RankingRow,
  TimeseriesPoint,
} from "@/lib/types";
import { useRunningStreams } from "@/lib/useRunningStreams";
import { cn } from "@/lib/utils";

const LONGEST_PERIOD_DAYS = 365;

export default function DashboardPage() {
  const [cities, setCities] = useState<City[]>([]);
  const [kpi, setKpi] = useState<Kpi | null>(null);
  // Resumo de 12 meses, buscado só quando o período escolhido está vazio,
  // para dizer ao visitante onde está a captura mais recente.
  const [yearKpi, setYearKpi] = useState<Kpi | null>(null);
  const [hourly, setHourly] = useState<TimeseriesPoint[]>([]);
  const [daily, setDaily] = useState<TimeseriesPoint[]>([]);
  const [ranking, setRanking] = useState<RankingRow[]>([]);
  const [geo, setGeo] = useState<GeoPoint[]>([]);
  const [filters, setFilters] = useState<PeriodFilter>({ days: 30 });
  const [cameras, setCameras] = useState<Camera[]>([]);
  // null enquanto as câmeras não carregaram; depois, uma câmera ou "all".
  const [scope, setScope] = useState<CameraScope | null>(null);

  // A tela abre numa câmera só: locais diferentes somados não dizem nada.
  useEffect(() => {
    getCameras()
      .then((cs) => {
        setCameras(cs);
        setScope((current) => current ?? (cs.length > 0 ? cs[0].id : "all"));
      })
      .catch(() => setScope("all"));
  }, []);

  const cameraId = typeof scope === "number" ? scope : undefined;
  const scopedCameras = filters.cityId
    ? cameras.filter((c) => c.city_id === filters.cityId)
    : cameras;
  const selectedCamera = cameras.find((c) => c.id === cameraId);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (scope === null) return;
    let cancelled = false;

    async function loadAll() {
      setLoading(true);
      setErr(null);
      try {
        const [cs, k, h, d, r, g] = await Promise.all([
          getCities(),
          getKpis(filters.days, filters.cityId, cameraId),
          // A API limita a série horária a 60 dias; 14 mantém a faixa legível.
          getHourly(Math.min(14, filters.days), filters.cityId, cameraId),
          getDaily(filters.days, filters.cityId, cameraId),
          getRanking(filters.days, filters.cityId),
          getGeo(filters.days, filters.cityId),
        ]);
        if (cancelled) return;
        setCities(cs);
        setKpi(k);
        setHourly(h);
        setDaily(d);
        // Ranking e mapa só filtram por cidade na API; o recorte por câmera é feito aqui.
        setRanking(cameraId ? r.filter((row) => row.camera_id === cameraId) : r);
        setGeo(cameraId ? g.filter((point) => point.camera_id === cameraId) : g);

        if (k.total === 0 && filters.days < LONGEST_PERIOD_DAYS) {
          const year = await getKpis(LONGEST_PERIOD_DAYS, filters.cityId, cameraId);
          if (!cancelled) setYearKpi(year);
        } else {
          setYearKpi(null);
        }
      } catch (e: any) {
        if (!cancelled) {
          setErr(
            `Não foi possível carregar a contagem: ${
              e?.message ?? "a API não respondeu"
            }. Confira se a API está no ar e recarregue a página.`
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadAll();
    return () => {
      cancelled = true;
    };
  }, [filters.days, filters.cityId, scope, cameraId]);

  const runningStreams = useRunningStreams();
  const liveStreams = cameraId
    ? runningStreams.filter((st) => st.camera_id === cameraId)
    : runningStreams;
  // Vídeo ao lado do resumo só quando a tela é de um local e ele está no ar.
  const liveBeside = cameraId !== undefined && liveStreams.length === 1;
  const showRanking = ranking.length > 1;
  const byHour = filters.days <= 14 && hourly.some((p) => p.total > 0 || p.pedestrians > 0);
  const intervalsWithCount = (byHour ? hourly : daily).filter(
    (p) => p.total > 0 || p.pedestrians > 0
  ).length;
  // Com um dia só o gráfico diário é uma barra solta; a tabela já diz o mesmo.
  const showDailyChart = daily.filter((p) => p.total > 0).length >= 2;

  const firstLoad = (loading && kpi === null) || scope === null;
  const hasCities = cities.length > 0;
  const hasCount = (kpi?.total ?? 0) > 0 || daily.some((p) => p.pedestrians > 0);

  return (
    <div className="space-y-10">
      <PageHeader
        title="Visão geral"
        description={
          selectedCamera
            ? `Contagem da câmera ${selectedCamera.name}${
                selectedCamera.city_name ? `, ${selectedCamera.city_name}` : ""
              }.`
            : cameras.length > 1
            ? "Todas as câmeras somadas. Escolha um local para ver só a contagem dele."
            : undefined
        }
        actions={
          <div className="flex max-w-full flex-wrap items-start gap-x-4 gap-y-3">
            {scope !== null && (
              <CameraScopeControl
                cameras={scopedCameras}
                value={scope}
                onChange={setScope}
              />
            )}
            <FiltersBar
              cities={cities}
              value={filters}
              onChange={(next) => {
                // Trocar de cidade tira a câmera escolhida se ela for de outra.
                if (
                  next.cityId &&
                  selectedCamera &&
                  selectedCamera.city_id !== next.cityId
                ) {
                  setScope("all");
                }
                setFilters(next);
              }}
            />
          </div>
        }
      />

      {err && (
        <p role="alert" className="alert-error">
          {err}
        </p>
      )}

      {firstLoad && <LoadingSheet />}

      {!firstLoad && !hasCities && !err && (
        <section>
          <h2 className="font-display text-2xl font-semibold">Nenhuma cidade cadastrada</h2>
          <p className="mt-1 max-w-[65ch] text-ink-muted">
            Cadastre uma cidade e uma câmera. Depois envie um vídeo ou inicie
            uma transmissão: a contagem aparece aqui assim que o primeiro
            veículo cruzar a linha.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/cameras" className="btn-primary">
              Cadastrar câmera
            </Link>
          </div>
        </section>
      )}

      {!firstLoad && hasCities && (
        <div
          className={cn(
            "transition-opacity",
            loading && "opacity-60"
          )}
          aria-busy={loading}
        >
          <div className="grid grid-cols-1 gap-x-12 gap-y-14 xl:grid-cols-3">
            {/* Um local com transmissão no ar: o vídeo abre a tela, com a
                leitura da contagem ao lado. */}
            {liveBeside && (
              <div className="min-w-0 xl:col-span-2">
                <OverviewLiveNow
                  streams={liveStreams}
                  cameras={cameras}
                  showSessionCounts={false}
                />
              </div>
            )}

            <Sheet
              title={
                filters.days === 1
                  ? "Contagem de hoje"
                  : filters.days === 365
                  ? "Contagem dos últimos 12 meses"
                  : `Contagem dos últimos ${filters.days} dias`
              }
              className={cn(
                !liveBeside && (showRanking ? "xl:col-span-2" : "xl:col-span-3")
              )}
            >
              <CountSummary
                kpi={kpi}
                daily={daily}
                days={filters.days}
                stacked={liveBeside || showRanking}
                lastCapture={yearKpi}
                onShowLongestPeriod={() =>
                  setFilters((f) => ({ ...f, days: LONGEST_PERIOD_DAYS }))
                }
              />
            </Sheet>

            {!liveBeside && showRanking && <LocationRanking rows={ranking} />}

            {!liveBeside && liveStreams.length > 0 && (
              <div className="min-w-0 xl:col-span-3">
                <OverviewLiveNow streams={liveStreams} cameras={cameras} />
              </div>
            )}

            {/* Com um intervalo só, a tabela repetiria os números de cima. */}
            {intervalsWithCount >= 2 && (
              <Sheet
                title={byHour ? "Hora a hora" : "Dia a dia"}
                className="xl:col-span-3"
              >
                <ClassifiedCountSheet
                  hourly={hourly}
                  daily={daily}
                  preferHourly={byHour}
                />
              </Sheet>
            )}

            {showDailyChart && (
              <div className={cn("min-w-0", cameraId ? "xl:col-span-3" : "xl:col-span-2")}>
                <DailyFlowChart data={daily} height={320} />
              </div>
            )}
            {selectedCamera && (
              <div className="min-w-0 xl:col-span-3">
                <OverviewCameraDetails
                  camera={selectedCamera}
                  stream={liveStreams[0]}
                />
              </div>
            )}

            {/* Em "Todas" o mapa divide a linha com o gráfico; num local só,
                ocupa a largura e só entra se a câmera tiver coordenadas. */}
            {(!cameraId || geo.some((g) => g.latitude !== 0 || g.longitude !== 0)) && (
              <div
                className={cn(
                  "min-w-0",
                  (cameraId || !showDailyChart) && "xl:col-span-3"
                )}
              >
                <MapView points={geo} height={cameraId ? 300 : showDailyChart ? 320 : 360} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Esqueleto só do primeiro carregamento; trocas de filtro mantêm o dado anterior. */
function LoadingSheet() {
  return (
    <div aria-busy="true">
      <p className="sr-only">Carregando contagem</p>
      <div className="h-9 w-56 animate-pulse rounded-sm bg-bg-elevated" />
      <div className="mt-3 h-4 w-80 max-w-full animate-pulse rounded-sm bg-bg-elevated" />
      <div className="mt-6 h-32 animate-pulse rounded-sm bg-bg-elevated" />
    </div>
  );
}
