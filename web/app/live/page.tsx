"use client";

import {
  Bike,
  Building2,
  Bus,
  Car,
  Loader2,
  MapPin,
  Package,
  Play,
  PlayCircle,
  Radio,
  Save,
  Square,
  Truck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  getCameras,
  getCities,
  getLiveStatus,
  listLive,
  liveMjpegUrl,
  startLive,
  stopLive,
  updateCamera,
} from "@/lib/api";
import type { Camera, City, LiveStatus } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

const TYPE_META: Record<string, { label: string; icon: LucideIcon }> = {
  car: { label: "Carros", icon: Car },
  motorcycle: { label: "Motos", icon: Bike },
  bus: { label: "Ônibus", icon: Bus },
  truck: { label: "Caminhões", icon: Truck },
  bicycle: { label: "Bicicletas", icon: Bike },
  van: { label: "Vans", icon: Package },
  other: { label: "Outros", icon: Package },
};

const DEFAULT_SOURCE_HINT =
  "https://www.youtube.com/watch?v=... | rtsp://... | http://.../stream.m3u8 | 0 (webcam)";

export default function LivePage() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [cameraId, setCameraId] = useState<number | null>(null);
  const [source, setSource] = useState("");
  const [status, setStatus] = useState<LiveStatus | null>(null);
  const [active, setActive] = useState<LiveStatus[]>([]);
  const [busy, setBusy] = useState(false);
  const [startingAll, setStartingAll] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [imgBust, setImgBust] = useState(0); // força o browser a reabrir o MJPEG

  // Carrega câmeras e cidades uma vez
  useEffect(() => {
    Promise.all([getCameras(), getCities()])
      .then(([cs, ct]) => {
        setCameras(cs);
        setCities(ct);
        if (cs.length && cameraId === null) {
          setCameraId(cs[0].id);
          if (cs[0].stream_url) setSource(cs[0].stream_url);
        }
      })
      .catch((e) => setMsg(`Erro carregando câmeras: ${e.message ?? e}`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Polling global da lista de streams ativos — alimenta o painel "Ativas agora".
  useEffect(() => {
    let alive = true;
    async function tick() {
      try {
        const all = await listLive();
        if (alive) setActive(all);
      } catch {
        /* silêncio — não é crítico se uma iteração falhar */
      }
    }
    tick();
    const t = setInterval(tick, 2000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  // Polling de status enquanto há câmera selecionada
  useEffect(() => {
    if (cameraId === null) return;
    let isActive = true;
    async function tick() {
      try {
        const s = await getLiveStatus(cameraId!);
        if (isActive) setStatus(s);
      } catch {
        if (isActive) setStatus(null); // provavelmente 404 — stream não iniciado
      }
    }
    tick();
    const t = setInterval(tick, 1000);
    return () => {
      isActive = false;
      clearInterval(t);
    };
  }, [cameraId]);

  // Quando seleciona outra câmera, pré-preenche URL (se a câmera tiver uma salva).
  useEffect(() => {
    const cam = cameras.find((c) => c.id === cameraId);
    if (cam?.stream_url) setSource(cam.stream_url);
  }, [cameraId, cameras]);

  async function handleStart() {
    if (cameraId === null) return;
    if (!source.trim()) {
      setMsg("Informe uma fonte (URL ou device id).");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const s = await startLive(cameraId, source.trim());
      setStatus(s);
      setImgBust((n) => n + 1);
      setMsg("Stream iniciado — aguarde alguns segundos pelos primeiros frames.");
    } catch (e: any) {
      setMsg(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleStop() {
    if (cameraId === null) return;
    setBusy(true);
    setMsg(null);
    try {
      const s = await stopLive(cameraId);
      setStatus(s);
      setMsg("Stream encerrado.");
    } catch (e: any) {
      setMsg(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveUrl() {
    if (cameraId === null || !source.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const updated = await updateCamera(cameraId, { stream_url: source.trim() });
      setCameras((cs) => cs.map((c) => (c.id === updated.id ? updated : c)));
      setMsg("URL salva como padrão desta câmera.");
    } catch (e: any) {
      setMsg(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  // Inicia uma stream pra cada câmera que tem stream_url salvo e ainda
  // não tem worker rodando. Usa Promise.allSettled para não abortar as
  // outras se uma falhar (URL expirada, fonte indisponível, etc).
  async function handleStartAll() {
    const activeIds = new Set(active.filter((s) => s.running).map((s) => s.camera_id));
    const targets = cameras.filter(
      (c) => c.stream_url && c.stream_url.trim() && !activeIds.has(c.id)
    );
    if (targets.length === 0) {
      setMsg(
        "Nenhuma câmera pronta pra iniciar — salve uma URL padrão em cada câmera primeiro."
      );
      return;
    }
    setStartingAll(true);
    setMsg(null);
    const results = await Promise.allSettled(
      targets.map((c) => startLive(c.id, c.stream_url!.trim()))
    );
    const ok = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.length - ok;
    setMsg(
      failed === 0
        ? `${ok} stream(s) iniciado(s).`
        : `${ok} iniciado(s), ${failed} falhou(ram). Veja o log do servidor.`
    );
    setStartingAll(false);
    try {
      setActive(await listLive());
    } catch {
      /* sem estresse */
    }
  }

  // Memoized: lookup de cidade por camera_id (para exibir "CAM-01 · São Paulo")
  const cityByCameraId = useMemo(() => {
    const cityMap = new Map(cities.map((c) => [c.id, c]));
    const out = new Map<number, City>();
    cameras.forEach((cam) => {
      const city = cityMap.get(cam.city_id);
      if (city) out.set(cam.id, city);
    });
    return out;
  }, [cameras, cities]);

  const selectedCamera = cameras.find((c) => c.id === cameraId);
  const selectedCity = cameraId !== null ? cityByCameraId.get(cameraId) : undefined;

  async function handleStopFromList(camId: number) {
    try {
      await stopLive(camId);
      setActive((prev) =>
        prev.map((s) =>
          s.camera_id === camId ? { ...s, running: false } : s
        )
      );
    } catch (e: any) {
      setMsg(e?.message ?? String(e));
    }
  }

  const running = !!status?.running;
  const sortedTypes = useMemo(
    () => Object.entries(status?.by_type ?? {}).sort((a, b) => b[1] - a[1]),
    [status?.by_type]
  );

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-center gap-2 text-brand text-xs uppercase tracking-wider">
          <Radio size={14} />
          Nível 3 — overlay ao vivo
        </div>
        <h1 className="text-2xl font-bold mt-1">Monitoramento ao vivo</h1>
        <p className="text-sm text-ink-muted mt-1">
          Conecta a uma câmera (RTSP) ou live stream (YouTube/HLS), roda YOLOv8
          + tracking sobre o vídeo em tempo real e transmite os frames anotados
          aqui pelo navegador.
        </p>
      </header>

      {cameras.length === 0 ? (
        <div className="card p-8 text-center text-sm text-ink-muted">
          Nenhuma câmera cadastrada.{" "}
          <Link href="/cameras" className="text-brand hover:underline">
            Cadastre uma em /cameras
          </Link>{" "}
          para começar.
        </div>
      ) : (
        <section className="card p-5">
          <div className="grid grid-cols-1 md:grid-cols-[260px_1fr_auto] gap-3 items-end">
            <div>
              <label className="block text-xs uppercase tracking-wider text-ink-muted mb-1">
                Câmera
              </label>
              <select
                className="w-full bg-bg-elevated border border-bg-border rounded-md px-2 py-1.5 text-sm text-ink outline-none"
                value={cameraId ?? ""}
                onChange={(e) => setCameraId(Number(e.target.value))}
              >
                {cameras.map((c) => {
                  const city = cityByCameraId.get(c.id);
                  const tag = city ? city.name : "sem cidade";
                  return (
                    <option key={c.id} value={c.id}>
                      {c.name} · {tag}
                    </option>
                  );
                })}
              </select>
              {selectedCamera && (
                <div className="mt-1 text-xs text-ink-muted flex flex-wrap items-center gap-x-2">
                  <span className="inline-flex items-center gap-1">
                    <Building2 size={12} />
                    {selectedCity?.name ?? "—"}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={12} />
                    {selectedCamera.latitude.toFixed(4)},{" "}
                    {selectedCamera.longitude.toFixed(4)}
                  </span>
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-ink-muted mb-1">
                Fonte
              </label>
              <input
                type="text"
                className="w-full bg-bg-elevated border border-bg-border rounded-md px-2 py-1.5 text-sm text-ink outline-none font-mono"
                placeholder={DEFAULT_SOURCE_HINT}
                value={source}
                onChange={(e) => setSource(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              {!running ? (
                <button
                  onClick={handleStart}
                  disabled={busy || cameraId === null}
                  className="inline-flex items-center gap-1.5 bg-brand hover:bg-brand-700 text-bg font-semibold rounded-md px-3 py-1.5 text-sm disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Play size={14} />
                  )}
                  Iniciar
                </button>
              ) : (
                <button
                  onClick={handleStop}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 bg-negative/20 border border-negative/40 text-negative hover:bg-negative/30 rounded-md px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Square size={14} />
                  )}
                  Parar
                </button>
              )}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={handleSaveUrl}
              disabled={busy || cameraId === null || !source.trim()}
              title="Grava a URL atual como fonte padrão desta câmera"
              className="inline-flex items-center gap-1.5 bg-bg-elevated border border-bg-border hover:border-brand text-ink-muted hover:text-ink rounded-md px-3 py-1.5 text-xs disabled:opacity-50"
            >
              <Save size={13} />
              Salvar URL nesta câmera
            </button>
            <button
              onClick={handleStartAll}
              disabled={startingAll}
              title="Inicia uma stream para cada câmera que tem URL padrão salva"
              className="inline-flex items-center gap-1.5 bg-bg-elevated border border-bg-border hover:border-brand text-ink-muted hover:text-ink rounded-md px-3 py-1.5 text-xs disabled:opacity-50"
            >
              {startingAll ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <PlayCircle size={13} />
              )}
              Iniciar todas as câmeras com URL salva
            </button>
          </div>

          {msg && (
            <div className="mt-3 text-xs text-ink-muted">{msg}</div>
          )}
          {status?.using_fallback_detector && (
            <div className="mt-3 text-xs text-warning">
              Atenção: detector simulado ativo (ultralytics não está instalado no
              backend). Os boxes serão aleatórios.
            </div>
          )}
          {status?.error && (
            <div className="mt-3 text-xs text-negative">
              Erro no worker: {status.error}
            </div>
          )}
        </section>
      )}

      {cameras.length > 0 && (
        <>
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">Stream anotado</h3>
                {running && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-positive">
                    <span className="h-2 w-2 rounded-full bg-positive animate-pulse" />
                    AO VIVO
                  </span>
                )}
              </div>
              {cameraId !== null && running ? (
                <img
                  key={`${cameraId}-${imgBust}`}
                  src={`${liveMjpegUrl(cameraId)}?t=${imgBust}`}
                  alt="Stream ao vivo"
                  className="w-full rounded-lg bg-black"
                />
              ) : (
                <div className="aspect-video rounded-lg border border-dashed border-bg-border grid place-items-center text-sm text-ink-muted">
                  {cameraId === null
                    ? "Selecione uma câmera acima."
                    : "Stream não iniciado. Informe uma fonte e clique em Iniciar."}
                </div>
              )}
              <p className="text-xs text-ink-muted mt-2">
                O player é um MJPEG direto do backend — reabra a página se a
                conexão cair.
              </p>
            </div>

            <div className="space-y-4">
              <div className="card p-5">
                <div className="text-xs uppercase tracking-wider text-ink-muted">
                  Contados ao vivo
                </div>
                <div className="text-4xl font-bold mt-1">
                  {formatNumber(status?.total_counted ?? 0)}
                </div>
                <div className="text-xs text-ink-muted mt-1">
                  {status?.fps_real ? `${status.fps_real.toFixed(1)} fps` : "—"} ·{" "}
                  {status?.frames_processed ?? 0} frames ·{" "}
                  {status?.uptime_s ? `${Math.round(status.uptime_s)}s uptime` : "—"}
                </div>
              </div>

              <div className="card p-5">
                <h3 className="text-sm font-semibold mb-3">Por tipo</h3>
                <ul className="space-y-2">
                  {sortedTypes.length === 0 && (
                    <li className="text-xs text-ink-muted">
                      Nenhum veículo cruzou a linha ainda.
                    </li>
                  )}
                  {sortedTypes.map(([type, count]) => {
                    const meta = TYPE_META[type] ?? { label: type, icon: Package };
                    const Icon = meta.icon;
                    const total = status?.total_counted ?? 0;
                    const pct = total > 0 ? (count / total) * 100 : 0;
                    return (
                      <li key={type} className="text-sm">
                        <div className="flex items-center gap-2">
                          <Icon size={14} />
                          <span className="flex-1">{meta.label}</span>
                          <span className="font-semibold">
                            {formatNumber(count)}
                          </span>
                          <span className="text-xs text-ink-muted w-10 text-right">
                            {pct.toFixed(0)}%
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 bg-bg-elevated rounded-full overflow-hidden">
                          <div
                            className="h-full bg-brand"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {status && (
                <div className="card p-4 text-xs text-ink-muted space-y-1">
                  <div>
                    <span className="uppercase tracking-wider">Fonte:</span>{" "}
                    <span className="text-ink break-all">{status.source}</span>
                  </div>
                  <div>
                    <span className="uppercase tracking-wider">Resolvido:</span>{" "}
                    <span className="text-ink break-all">
                      {status.resolved_source}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Ativas agora</h3>
              <span className="text-xs text-ink-muted">
                {active.filter((s) => s.running).length} rodando
              </span>
            </div>
            {active.filter((s) => s.running).length === 0 ? (
              <p className="text-xs text-ink-muted">
                Nenhuma stream ativa. Inicie uma câmera acima ou use "Iniciar todas".
              </p>
            ) : (
              <ul className="divide-y divide-bg-border">
                {active
                  .filter((s) => s.running)
                  .map((s) => {
                    const cam = cameras.find((c) => c.id === s.camera_id);
                    const city = cityByCameraId.get(s.camera_id);
                    return (
                      <li
                        key={s.camera_id}
                        className="py-2 flex items-center gap-3 text-sm"
                      >
                        <span className="h-2 w-2 rounded-full bg-positive animate-pulse shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">
                            {cam?.name ?? `cam ${s.camera_id}`}
                            {city && (
                              <span className="text-ink-muted font-normal">
                                {" · "}
                                {city.name}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-ink-muted truncate">
                            {s.fps_real.toFixed(1)} fps ·{" "}
                            {formatNumber(s.total_counted)} veículos ·{" "}
                            {Math.round(s.uptime_s)}s
                          </div>
                        </div>
                        <button
                          onClick={() => setCameraId(s.camera_id)}
                          className="text-xs text-ink-muted hover:text-ink underline-offset-2 hover:underline"
                        >
                          abrir
                        </button>
                        <button
                          onClick={() => handleStopFromList(s.camera_id)}
                          className="text-xs text-negative hover:underline underline-offset-2"
                        >
                          parar
                        </button>
                      </li>
                    );
                  })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
