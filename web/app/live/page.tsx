"use client";

import { Save } from "lucide-react";
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
import LiveCameraSwitcher from "@/components/LiveCameraSwitcher";
import LiveCameraWall from "@/components/LiveCameraWall";
import LiveActiveStreamsSheet from "@/components/LiveActiveStreamsSheet";
import LiveCountSheet, { formatLiveFps } from "@/components/LiveCountSheet";
import LiveStreamViewport from "@/components/LiveStreamViewport";
import PageHeader from "@/components/PageHeader";
import SegmentedControl from "@/components/SegmentedControl";
import Sheet from "@/components/Sheet";
import type { Camera, City, LiveStatus } from "@/lib/types";

const SOURCE_PLACEHOLDER = "rtsp://, https:// ou 0";

// A API devolve a mensagem crua; a tela diz o que falhou e o que fazer.
function failure(what: string, e: any, next: string): string {
  return `Não foi possível ${what}: ${e?.message ?? String(e)}. ${next}`;
}

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
  const [view, setView] = useState<"single" | "wall">("single");
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
      .catch((e) =>
        setMsg(failure("carregar as câmeras", e, "Recarregue a página."))
      );
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
      setMsg(
        "Informe a fonte antes de iniciar: um endereço de vídeo ou o número do dispositivo."
      );
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const s = await startLive(cameraId, source.trim());
      setStatus(s);
      setImgBust((n) => n + 1);
      setMsg(
        "Transmissão iniciada. Os primeiros quadros levam alguns segundos para aparecer."
      );
    } catch (e: any) {
      setMsg(failure("iniciar a transmissão", e, "Confira a fonte e tente de novo."));
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
      setMsg("Transmissão encerrada.");
    } catch (e: any) {
      setMsg(failure("parar a transmissão", e, "Tente de novo."));
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
      setMsg("Fonte salva como padrão desta câmera.");
    } catch (e: any) {
      setMsg(failure("salvar a fonte", e, "Tente de novo."));
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
        "Nenhuma câmera para iniciar: as que têm fonte salva já estão transmitindo, ou nenhuma tem fonte salva."
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
        ? ok === 1
          ? "1 transmissão iniciada."
          : `${ok} transmissões iniciadas.`
        : `Iniciadas: ${ok}. Não iniciaram: ${failed}. Confira a fonte dessas câmeras e o registro do servidor.`
    );
    setStartingAll(false);
    try {
      setActive(await listLive());
    } catch {
      /* sem estresse */
    }
  }

  // Memoized: lookup de cidade por camera_id (para exibir a cidade ao lado do nome)
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

  async function handleStopFromList(camId: number) {
    try {
      await stopLive(camId);
      setActive((prev) =>
        prev.map((s) =>
          s.camera_id === camId ? { ...s, running: false } : s
        )
      );
    } catch (e: any) {
      setMsg(failure("parar a transmissão", e, "Tente de novo."));
    }
  }

  const running = !!status?.running;
  const sortedTypes = useMemo(
    () => Object.entries(status?.by_type ?? {}).sort((a, b) => b[1] - a[1]),
    [status?.by_type]
  );

  const runningStreams = active.filter((s) => s.running);
  // O mural só faz sentido com mais de uma transmissão no ar.
  const wallOpen = view === "wall" && runningStreams.length > 1;
  const runningIds = new Set(runningStreams.map((s) => s.camera_id));

  return (
    <div className="space-y-10">
      <PageHeader
        title="Ao vivo"
        description="Vídeo da câmera com as detecções marcadas e a contagem em tempo real."
      />

      {cameras.length === 0 ? (
        <Sheet title="Nenhuma câmera cadastrada">
          <p className="max-w-[60ch] text-ink-muted">
            A transmissão ao vivo precisa de uma câmera para registrar as
            contagens. Cadastre a primeira na tela Câmeras.
          </p>
          <Link href="/cameras" className="btn-primary mt-4">
            Câmeras
          </Link>
        </Sheet>
      ) : (
        <>
          {runningStreams.length > 1 && (
            <SegmentedControl
              label="Exibição"
              options={[
                { value: "single", label: "Uma câmera" },
                { value: "wall", label: "Todas as câmeras" },
              ]}
              value={view}
              onChange={setView}
            />
          )}

          {wallOpen ? (
            <LiveCameraWall
              streams={runningStreams}
              cameras={cameras}
              onOpen={(id) => {
                setCameraId(id);
                setView("single");
              }}
            />
          ) : (
            <>
              <LiveCameraSwitcher
                cameras={cameras}
                runningIds={runningIds}
                cityByCameraId={cityByCameraId}
                cameraId={cameraId}
                onChange={setCameraId}
              />

          <Sheet
            title={
              selectedCamera
                ? `Fonte de ${selectedCamera.name}`
                : "Fonte da transmissão"
            }
          >
            <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
              <div>
                <label
                  htmlFor="live-source"
                  className="mb-1 block text-sm font-medium"
                >
                  Fonte do vídeo
                </label>
                <input
                  id="live-source"
                  type="text"
                  className="input"
                  placeholder={SOURCE_PLACEHOLDER}
                  autoComplete="off"
                  spellCheck={false}
                  aria-describedby="live-source-hint"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                />
              </div>
              <button
                type="button"
                className="btn"
                onClick={handleSaveUrl}
                disabled={busy || cameraId === null || !source.trim()}
                title="Grava a fonte atual como padrão desta câmera"
              >
                <Save size={16} aria-hidden />
                Salvar fonte na câmera
              </button>
            </div>
            <p id="live-source-hint" className="mt-2 text-sm text-ink-muted">
              Aceita endereço RTSP, link do YouTube, lista HLS (.m3u8) ou o
              número do dispositivo, como 0 para a webcam.
            </p>

            {msg && (
              <p role="status" className="mt-4 text-sm font-medium">
                {msg}
              </p>
            )}
            {status?.using_fallback_detector && (
              <p className="mt-4 text-sm text-warning">
                Atenção: detector simulado em uso, porque o pacote ultralytics
                não está instalado no servidor. As caixas de detecção desta
                transmissão são aleatórias.
              </p>
            )}
            {status?.error && (
              <p role="alert" className="alert-error mt-4 text-sm">
                O processamento do vídeo relatou um erro: {status.error}.
                Confira a fonte e inicie de novo.
              </p>
            )}
          </Sheet>

          <div className="grid grid-cols-1 gap-x-8 gap-y-10 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <LiveStreamViewport
                cameraName={selectedCamera?.name}
                hasCamera={cameraId !== null}
                running={running}
                streamSrc={
                  cameraId !== null
                    ? `${liveMjpegUrl(cameraId)}?t=${imgBust}`
                    : null
                }
                streamKey={`${cameraId}-${imgBust}`}
                fpsLabel={status?.fps_real ? formatLiveFps(status.fps_real) : null}
                busy={busy}
                onStart={handleStart}
                onStop={handleStop}
              />
            </div>
            <LiveCountSheet
              status={status}
              sortedTypes={sortedTypes}
              cameraName={selectedCamera?.name}
            />
          </div>

            </>
          )}

          <LiveActiveStreamsSheet
            streams={runningStreams}
            cameras={cameras}
            cityByCameraId={cityByCameraId}
            openCameraId={cameraId}
            startingAll={startingAll}
            onStartAll={handleStartAll}
            onOpen={setCameraId}
            onStop={handleStopFromList}
          />
        </>
      )}
    </div>
  );
}
