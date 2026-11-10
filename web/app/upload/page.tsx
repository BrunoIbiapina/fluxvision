"use client";

import { CircleCheck, Loader2, Upload } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import PageHeader from "@/components/PageHeader";
import Sheet from "@/components/Sheet";
import { getCameras, getVideos, heatmapUrl, uploadVideo } from "@/lib/api";
import type { Camera, Video } from "@/lib/types";
import { cn } from "@/lib/utils";
import { describeVideoStatus, formatVideoRecordedAt } from "@/lib/videoStatus";

const UPLOAD_DONE_MESSAGE =
  "Vídeo enviado. Ele entrou na fila de processamento e os gráficos se atualizam sozinhos quando a contagem terminar.";

export default function UploadPage() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  async function reload() {
    const [c, v] = await Promise.all([getCameras(), getVideos(20)]);
    setCameras(c);
    setVideos(v);
    if (!selected && c.length) setSelected(c[0].id);
  }

  useEffect(() => {
    reload().catch(() => {});
    const id = setInterval(() => reload().catch(() => {}), 5000);
    return () => clearInterval(id);
  }, []);

  async function handleFile(file: File) {
    if (!selected) {
      setMsg("Escolha a câmera de origem antes de enviar o vídeo.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await uploadVideo(selected, file);
      setMsg(UPLOAD_DONE_MESSAGE);
      await reload();
    } catch (e: any) {
      setMsg(
        `Não foi possível enviar o vídeo: ${
          e?.message ?? "a API não respondeu"
        }. Tente de novo.`
      );
    } finally {
      setBusy(false);
    }
  }

  const uploadSucceeded = msg === UPLOAD_DONE_MESSAGE;
  const cameraName = (id: number) =>
    cameras.find((c) => c.id === id)?.name ?? `Câmera ${id}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Enviar vídeo"
        description="Envie uma gravação em MP4, MOV ou AVI. O sistema detecta e rastreia os veículos, conta o fluxo e gera o mapa de calor."
      />

      {cameras.length === 0 ? (
        <Sheet title="Nenhuma câmera cadastrada">
          <p className="max-w-[65ch] text-ink-muted">
            Todo vídeo precisa de uma câmera de origem, que diz de onde vem a
            contagem. Cadastre uma cidade e uma câmera antes de enviar.
          </p>
          <Link href="/cameras" className="btn-primary mt-4">
            Abrir Câmeras
          </Link>
        </Sheet>
      ) : (
        <Sheet title="Novo vídeo">
          <div className="sm:w-80">
            <label
              htmlFor="upload-camera"
              className="mb-1 block text-sm font-semibold"
            >
              Câmera de origem
            </label>
            <select
              id="upload-camera"
              className="input"
              value={selected ?? ""}
              onChange={(e) => setSelected(Number(e.target.value))}
            >
              {cameras.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.city_name ? `, ${c.city_name}` : ""}
                </option>
              ))}
            </select>
          </div>

          <label
            className="mt-4 flex min-h-40 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-ink/50 px-4 py-8 text-center transition-colors hover:bg-bg-elevated focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ink"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) handleFile(f);
            }}
          >
            <input
              ref={inputRef}
              type="file"
              accept="video/*"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            {busy ? (
              <Loader2 size={20} className="animate-spin text-ink-muted" aria-hidden />
            ) : (
              <Upload size={20} className="text-ink-muted" aria-hidden />
            )}
            <span className="mt-1 font-semibold">
              {busy
                ? "Enviando o vídeo…"
                : "Arraste um vídeo para cá ou clique para escolher o arquivo"}
            </span>
            <span className="text-sm text-ink-muted">
              MP4, MOV ou AVI, até 200 MB
            </span>
          </label>

          {msg &&
            (uploadSucceeded ? (
              <p role="status" className="mt-4 flex items-start gap-2">
                <CircleCheck size={18} className="mt-0.5 shrink-0 text-positive" aria-hidden />
                {msg}
              </p>
            ) : (
              <p role="alert" className="alert-error mt-4">
                {msg}
              </p>
            ))}
        </Sheet>
      )}

      <Sheet title="Vídeos enviados">
        {videos.length === 0 ? (
          <p className="py-6 text-ink-muted">
            Nenhum vídeo enviado ainda. O primeiro aparece aqui assim que o
            envio terminar.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="sheet-table min-w-[640px]">
              <thead>
                <tr>
                  <th scope="col">Arquivo</th>
                  <th scope="col">Câmera</th>
                  <th scope="col">Gravado em</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Mapa de calor</th>
                </tr>
              </thead>
              <tbody>
                {videos.map((v) => {
                  const status = describeVideoStatus(v.status);
                  return (
                    <tr key={v.id}>
                      <td className="max-w-[20rem]">
                        <Link
                          href={`/videos/${v.id}`}
                          title={v.filename}
                          className="flex min-h-11 items-center font-semibold text-brand underline sm:min-h-0"
                        >
                          <span className="truncate">{v.filename}</span>
                        </Link>
                      </td>
                      <td className="text-ink-muted">{cameraName(v.camera_id)}</td>
                      <td className="whitespace-nowrap tabular-nums text-ink-muted">
                        {formatVideoRecordedAt(v.recorded_at)}
                      </td>
                      <td className={cn("whitespace-nowrap font-semibold", status.tone)}>
                        {status.label}
                      </td>
                      <td>
                        {v.heatmap_path ? (
                          <a
                            href={heatmapUrl(v.id)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex min-h-11 items-center text-brand underline sm:min-h-0"
                          >
                            Abrir imagem
                          </a>
                        ) : (
                          <span className="text-ink-soft">Não gerado</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Sheet>
    </div>
  );
}
