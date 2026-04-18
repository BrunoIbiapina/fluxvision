"use client";

import {
  Building2,
  Camera as CameraIcon,
  MapPin,
  Pencil,
  Plus,
  Power,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  createCamera,
  createCity,
  deleteCamera,
  deleteCity,
  getCameras,
  getCities,
  updateCamera,
  updateCity,
  type CameraCreatePayload,
} from "@/lib/api";
import type { Camera, City, PointCategory } from "@/lib/types";
import { categoryLabel } from "@/lib/utils";

// ---------------- form state ----------------
type CameraFormState = {
  id?: number;
  name: string;
  city_id: number | "";
  latitude: string;
  longitude: string;
  district: string;
  category: PointCategory;
  notes: string;
  stream_url: string;
  active: boolean;
};

const EMPTY_CAMERA_FORM = (defaultCity?: number): CameraFormState => ({
  name: "",
  city_id: defaultCity ?? "",
  latitude: "",
  longitude: "",
  district: "",
  category: "avenue",
  notes: "",
  stream_url: "",
  active: true,
});

const CATEGORIES: PointCategory[] = [
  "avenue",
  "crossing",
  "highway",
  "event_gate",
  "square",
  "parking",
  "other",
];

export default function CamerasPage() {
  const [cities, setCities] = useState<City[]>([]);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // forms
  const [cityForm, setCityForm] = useState<{ id?: number; name: string } | null>(
    null
  );
  const [cameraForm, setCameraForm] = useState<CameraFormState | null>(null);

  async function reload() {
    setLoading(true);
    setErr(null);
    try {
      const [cs, cams] = await Promise.all([getCities(), getCameras()]);
      setCities(cs);
      setCameras(cams);
    } catch (e: any) {
      setErr(e?.message ?? "Falha ao carregar.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  const camerasByCity = useMemo(() => {
    const m = new Map<number, Camera[]>();
    for (const c of cameras) {
      const list = m.get(c.city_id) ?? [];
      list.push(c);
      m.set(c.city_id, list);
    }
    return m;
  }, [cameras]);

  // ---------------- city handlers ----------------
  async function submitCity() {
    if (!cityForm) return;
    const name = cityForm.name.trim();
    if (!name) {
      setErr("Nome da cidade é obrigatório.");
      return;
    }
    try {
      if (cityForm.id) {
        await updateCity(cityForm.id, name);
      } else {
        await createCity(name);
      }
      setCityForm(null);
      await reload();
    } catch (e: any) {
      setErr(e?.message ?? "Falha ao salvar cidade.");
    }
  }

  async function removeCity(city: City) {
    const hasCams = (camerasByCity.get(city.id)?.length ?? 0) > 0;
    const msg = hasCams
      ? `Remover "${city.name}"? Todas as ${camerasByCity.get(city.id)!.length} câmera(s) dessa cidade serão removidas também.`
      : `Remover "${city.name}"?`;
    if (!confirm(msg)) return;
    try {
      await deleteCity(city.id);
      await reload();
    } catch (e: any) {
      setErr(e?.message ?? "Falha ao remover cidade.");
    }
  }

  // ---------------- camera handlers ----------------
  async function submitCamera() {
    if (!cameraForm) return;
    const name = cameraForm.name.trim();
    const latitude = Number(cameraForm.latitude);
    const longitude = Number(cameraForm.longitude);
    const cityId =
      typeof cameraForm.city_id === "number" ? cameraForm.city_id : Number(cameraForm.city_id);

    if (!name) return setErr("Nome da câmera é obrigatório.");
    if (!cityId) return setErr("Selecione a cidade.");
    if (Number.isNaN(latitude) || Number.isNaN(longitude))
      return setErr("Latitude/longitude inválidas.");

    const payload: CameraCreatePayload = {
      name,
      city_id: cityId,
      latitude,
      longitude,
      district: cameraForm.district.trim() || null,
      category: cameraForm.category,
      notes: cameraForm.notes.trim() || null,
      stream_url: cameraForm.stream_url.trim() || null,
      active: cameraForm.active,
    };

    try {
      if (cameraForm.id) {
        await updateCamera(cameraForm.id, payload);
      } else {
        await createCamera(payload);
      }
      setCameraForm(null);
      await reload();
    } catch (e: any) {
      setErr(e?.message ?? "Falha ao salvar câmera.");
    }
  }

  async function removeCamera(cam: Camera) {
    if (!confirm(`Remover câmera "${cam.name}"?`)) return;
    try {
      await deleteCamera(cam.id);
      await reload();
    } catch (e: any) {
      setErr(e?.message ?? "Falha ao remover câmera.");
    }
  }

  function openNewCamera(cityId?: number) {
    setCameraForm(EMPTY_CAMERA_FORM(cityId ?? cities[0]?.id));
  }

  function openEditCamera(cam: Camera) {
    setCameraForm({
      id: cam.id,
      name: cam.name,
      city_id: cam.city_id,
      latitude: String(cam.latitude),
      longitude: String(cam.longitude),
      district: cam.district ?? "",
      category: cam.category,
      notes: cam.notes ?? "",
      stream_url: cam.stream_url ?? "",
      active: cam.active,
    });
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Câmeras & cidades</h1>
          <p className="text-sm text-ink-muted mt-1">
            Cadastre cidades e vincule câmeras georreferenciadas. Cada câmera
            passa a ser origem dos dados enviados em{" "}
            <span className="text-ink">/upload</span> e <span className="text-ink">/live</span>.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="btn-primary inline-flex items-center gap-1"
            onClick={() => setCityForm({ name: "" })}
          >
            <Plus size={14} /> Nova cidade
          </button>
          <button
            className="btn inline-flex items-center gap-1"
            onClick={() => openNewCamera()}
            disabled={cities.length === 0}
            title={
              cities.length === 0
                ? "Cadastre uma cidade antes de adicionar câmeras"
                : "Nova câmera"
            }
          >
            <Plus size={14} /> Nova câmera
          </button>
        </div>
      </header>

      {err && (
        <div className="card p-4 border-negative/40 bg-negative/10 text-negative text-sm flex items-start justify-between gap-3">
          <span>{err}</span>
          <button
            className="text-ink-muted hover:text-ink"
            onClick={() => setErr(null)}
            aria-label="fechar"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {loading && (
        <div className="card p-6 text-sm text-ink-muted">Carregando…</div>
      )}

      {!loading && cities.length === 0 && (
        <div className="card p-10 text-center">
          <Building2 size={28} className="mx-auto text-ink-muted" />
          <h2 className="mt-3 text-lg font-semibold">
            Nenhuma cidade cadastrada
          </h2>
          <p className="mt-1 text-sm text-ink-muted max-w-md mx-auto">
            Crie sua primeira cidade para começar a cadastrar câmeras. A cidade
            serve só como agrupador — os dados espaciais (lat/lng) ficam na câmera.
          </p>
          <button
            className="btn-primary mt-4 inline-flex items-center gap-1"
            onClick={() => setCityForm({ name: "" })}
          >
            <Plus size={14} /> Criar cidade
          </button>
        </div>
      )}

      {!loading &&
        cities.map((city) => {
          const cams = camerasByCity.get(city.id) ?? [];
          return (
            <section key={city.id} className="card p-5">
              <header className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Building2 size={16} className="text-brand" />
                    <h2 className="text-lg font-semibold">{city.name}</h2>
                    <span className="text-xs text-ink-muted">
                      · {cams.length} câmera{cams.length === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <button
                    className="btn-ghost inline-flex items-center gap-1"
                    onClick={() => openNewCamera(city.id)}
                  >
                    <Plus size={13} /> câmera
                  </button>
                  <button
                    className="btn-ghost inline-flex items-center gap-1"
                    onClick={() => setCityForm({ id: city.id, name: city.name })}
                    aria-label={`editar ${city.name}`}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    className="btn-ghost inline-flex items-center gap-1 text-negative hover:text-negative"
                    onClick={() => removeCity(city)}
                    aria-label={`remover ${city.name}`}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </header>

              {cams.length === 0 ? (
                <div className="text-sm text-ink-muted">
                  Sem câmeras ainda. Use{" "}
                  <button
                    className="text-brand hover:underline"
                    onClick={() => openNewCamera(city.id)}
                  >
                    + câmera
                  </button>{" "}
                  para adicionar a primeira.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {cams.map((cam) => (
                    <div key={cam.id} className="rounded-lg border border-bg-border p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm font-semibold min-w-0">
                          <CameraIcon size={14} className="text-brand shrink-0" />
                          <span className="truncate">{cam.name}</span>
                        </div>
                        <span
                          className={`chip ${
                            cam.active
                              ? "text-positive border-positive/40"
                              : "text-ink-muted"
                          }`}
                        >
                          <Power size={10} />
                          {cam.active ? "on" : "off"}
                        </span>
                      </div>

                      <div className="mt-2 text-xs text-ink-muted flex items-center gap-1">
                        <MapPin size={11} />
                        {cam.latitude.toFixed(4)}, {cam.longitude.toFixed(4)}
                      </div>
                      <div className="mt-1 text-xs text-ink-muted">
                        {categoryLabel(cam.category)}
                        {cam.district ? ` · ${cam.district}` : ""}
                      </div>

                      {cam.stream_url && (
                        <div className="mt-2 text-[11px] text-ink-muted font-mono truncate">
                          {cam.stream_url}
                        </div>
                      )}

                      <div className="mt-3 flex gap-1.5 justify-end">
                        <button
                          className="btn-ghost text-xs inline-flex items-center gap-1"
                          onClick={() => openEditCamera(cam)}
                        >
                          <Pencil size={11} /> editar
                        </button>
                        <button
                          className="btn-ghost text-xs inline-flex items-center gap-1 text-negative hover:text-negative"
                          onClick={() => removeCamera(cam)}
                        >
                          <Trash2 size={11} /> remover
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}

      {/* ---------------- city modal ---------------- */}
      {cityForm && (
        <Modal
          title={cityForm.id ? "Editar cidade" : "Nova cidade"}
          onClose={() => setCityForm(null)}
          onSubmit={submitCity}
          submitLabel={cityForm.id ? "Salvar" : "Criar"}
        >
          <Field label="Nome">
            <input
              className="input"
              autoFocus
              value={cityForm.name}
              onChange={(e) => setCityForm({ ...cityForm, name: e.target.value })}
              placeholder="ex: São Paulo"
            />
          </Field>
        </Modal>
      )}

      {/* ---------------- camera modal ---------------- */}
      {cameraForm && (
        <Modal
          title={cameraForm.id ? "Editar câmera" : "Nova câmera"}
          onClose={() => setCameraForm(null)}
          onSubmit={submitCamera}
          submitLabel={cameraForm.id ? "Salvar" : "Criar"}
          wide
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Nome">
              <input
                className="input"
                autoFocus
                value={cameraForm.name}
                onChange={(e) =>
                  setCameraForm({ ...cameraForm, name: e.target.value })
                }
                placeholder="ex: Av. Paulista × Consolação"
              />
            </Field>
            <Field label="Cidade">
              <select
                className="input"
                value={cameraForm.city_id}
                onChange={(e) =>
                  setCameraForm({
                    ...cameraForm,
                    city_id: e.target.value ? Number(e.target.value) : "",
                  })
                }
              >
                <option value="">— escolher —</option>
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Latitude">
              <input
                className="input font-mono"
                inputMode="decimal"
                value={cameraForm.latitude}
                onChange={(e) =>
                  setCameraForm({ ...cameraForm, latitude: e.target.value })
                }
                placeholder="-23.5629"
              />
            </Field>
            <Field label="Longitude">
              <input
                className="input font-mono"
                inputMode="decimal"
                value={cameraForm.longitude}
                onChange={(e) =>
                  setCameraForm({ ...cameraForm, longitude: e.target.value })
                }
                placeholder="-46.6544"
              />
            </Field>

            <Field label="Distrito / bairro">
              <input
                className="input"
                value={cameraForm.district}
                onChange={(e) =>
                  setCameraForm({ ...cameraForm, district: e.target.value })
                }
                placeholder="opcional"
              />
            </Field>
            <Field label="Categoria">
              <select
                className="input"
                value={cameraForm.category}
                onChange={(e) =>
                  setCameraForm({
                    ...cameraForm,
                    category: e.target.value as PointCategory,
                  })
                }
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {categoryLabel(c)}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="URL do stream (opcional)" className="sm:col-span-2">
              <input
                className="input font-mono"
                value={cameraForm.stream_url}
                onChange={(e) =>
                  setCameraForm({ ...cameraForm, stream_url: e.target.value })
                }
                placeholder="rtsp://... ou https://... — pode ficar vazio e ser preenchido na tela /live"
              />
            </Field>

            <Field label="Notas" className="sm:col-span-2">
              <textarea
                className="input min-h-[72px]"
                value={cameraForm.notes}
                onChange={(e) =>
                  setCameraForm({ ...cameraForm, notes: e.target.value })
                }
                placeholder="observações livres"
              />
            </Field>

            <label className="sm:col-span-2 inline-flex items-center gap-2 text-sm text-ink-muted">
              <input
                type="checkbox"
                checked={cameraForm.active}
                onChange={(e) =>
                  setCameraForm({ ...cameraForm, active: e.target.checked })
                }
              />
              câmera ativa
            </label>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ---------------- small UI helpers ----------------
function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 ${className ?? ""}`}>
      <span className="text-xs text-ink-muted">{label}</span>
      {children}
    </label>
  );
}

function Modal({
  title,
  children,
  onClose,
  onSubmit,
  submitLabel = "Salvar",
  wide = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  onSubmit: () => void;
  submitLabel?: string;
  wide?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-auto"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className={`card p-5 w-full ${wide ? "max-w-2xl" : "max-w-md"} space-y-4`}
      >
        <header className="flex items-center justify-between">
          <h3 className="text-base font-semibold">{title}</h3>
          <button
            type="button"
            className="text-ink-muted hover:text-ink"
            onClick={onClose}
            aria-label="fechar"
          >
            <X size={16} />
          </button>
        </header>
        <div>{children}</div>
        <footer className="flex justify-end gap-2 pt-2 border-t border-bg-border">
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary">
            {submitLabel}
          </button>
        </footer>
      </form>
    </div>
  );
}
