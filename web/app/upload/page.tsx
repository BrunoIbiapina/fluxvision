"use client";

import { CheckCircle2, FileVideo, Loader2, UploadCloud } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { getCameras, getVideos, heatmapUrl, uploadVideo } from "@/lib/api";
import type { Camera, Video } from "@/lib/types";

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
      setMsg("Selecione uma câmera antes.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await uploadVideo(selected, file);
      setMsg(
        "Upload concluído. O vídeo está na fila de processamento — os gráficos se atualizarão automaticamente."
      );
      await reload();
    } catch (e: any) {
      setMsg(`Falha: ${e?.message ?? e}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Upload de vídeo</h1>
        <p className="text-sm text-ink-muted mt-1">
          Envie vídeos offline (MP4/MOV/AVI) para o pipeline. A IA detecta e
          rastreia veículos, contabiliza o fluxo e gera heatmap.
        </p>
      </header>

      {cameras.length === 0 ? (
        <div className="card p-10 text-center">
          <UploadCloud size={28} className="mx-auto text-ink-muted" />
          <h2 className="mt-3 text-lg font-semibold">
            Nenhuma câmera cadastrada
          </h2>
          <p className="mt-1 text-sm text-ink-muted max-w-md mx-auto">
            Cadastre uma cidade e uma câmera em{" "}
            <Link href="/cameras" className="text-brand hover:underline">
              /cameras
            </Link>{" "}
            antes de enviar vídeos. A câmera é a origem dos dados que alimentam
            o dashboard.
          </p>
        </div>
      ) : (
        <div className="card p-5">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <label className="text-xs uppercase tracking-wider text-ink-muted">
              Câmera de origem
            </label>
            <select
              className="bg-bg-elevated border border-bg-border rounded-md px-2 py-1.5 text-sm text-ink outline-none"
              value={selected ?? ""}
              onChange={(e) => setSelected(Number(e.target.value))}
            >
              {cameras.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.city_name ? ` — ${c.city_name}` : ""} (id {c.id})
                </option>
              ))}
            </select>
          </div>

          <label
            className="block border-2 border-dashed border-bg-border rounded-xl p-10 text-center cursor-pointer hover:border-brand/50 transition-colors"
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
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            <UploadCloud
              size={36}
              className={`mx-auto mb-3 ${busy ? "text-brand" : "text-ink-muted"}`}
            />
            <div className="font-medium">
              {busy ? "Enviando…" : "Arraste um vídeo aqui ou clique para selecionar"}
            </div>
            <div className="text-xs text-ink-muted mt-1">
              Formatos: .mp4, .mov, .avi — até 200MB
            </div>
          </label>

          {msg && (
            <div className="mt-4 text-sm flex items-center gap-2 text-ink-muted">
              {busy ? (
                <Loader2 size={14} className="animate-spin text-brand" />
              ) : (
                <CheckCircle2 size={14} className="text-positive" />
              )}
              {msg}
            </div>
          )}
        </div>
      )}

      <div className="card p-5">
        <h3 className="text-sm font-semibold mb-3">Últimos vídeos processados</h3>
        <ul className="divide-y divide-bg-border">
          {videos.map((v) => (
            <li key={v.id} className="py-3 flex items-center gap-3">
              <FileVideo size={16} className="text-ink-muted" />
              <div className="flex-1 min-w-0">
                <Link
                  href={`/videos/${v.id}`}
                  className="text-sm truncate block hover:text-brand"
                >
                  {v.filename}
                </Link>
                <div className="text-xs text-ink-muted">
                  cam {v.camera_id} · {new Date(v.recorded_at).toLocaleString("pt-BR")}
                </div>
              </div>
              <span
                className={`chip ${
                  v.status === "done"
                    ? "text-positive border-positive/40"
                    : v.status === "failed"
                    ? "text-negative border-negative/40"
                    : "text-warning border-warning/40"
                }`}
              >
                {v.status}
              </span>
              <Link
                href={`/videos/${v.id}`}
                className="text-brand text-xs underline underline-offset-2"
              >
                ver detalhe
              </Link>
              {v.heatmap_path && (
                <a
                  href={heatmapUrl(v.id)}
                  target="_blank"
                  className="text-brand text-xs underline underline-offset-2"
                  rel="noreferrer"
                >
                  heatmap
                </a>
              )}
            </li>
          ))}
          {videos.length === 0 && (
            <li className="py-6 text-center text-sm text-ink-muted">
              Nenhum vídeo enviado ainda.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
