"use client";

import { Plus, X } from "lucide-react";
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
import CameraFormDialog, {
  type CameraFormState,
} from "@/components/CameraFormDialog";
import CityCamerasSheet from "@/components/CityCamerasSheet";
import CityFormDialog, { type CityFormState } from "@/components/CityFormDialog";
import PageHeader from "@/components/PageHeader";
import Sheet from "@/components/Sheet";
import type { Camera, City } from "@/lib/types";

// A API devolve a mensagem crua; a tela diz o que falhou e o que fazer.
function failure(what: string, e: any): string {
  return `Não foi possível ${what}: ${
    e?.message ?? "a API não respondeu"
  }. Tente de novo.`;
}

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

export default function CamerasPage() {
  const [cities, setCities] = useState<City[]>([]);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // forms
  const [cityForm, setCityForm] = useState<CityFormState | null>(null);
  const [cameraForm, setCameraForm] = useState<CameraFormState | null>(null);

  async function reload() {
    setLoading(true);
    setErr(null);
    try {
      const [cs, cams] = await Promise.all([getCities(), getCameras()]);
      setCities(cs);
      setCameras(cams);
    } catch (e: any) {
      setErr(
        `Não foi possível carregar as câmeras e cidades: ${
          e?.message ?? "a API não respondeu"
        }. Recarregue a página.`
      );
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
      setErr("Informe o nome da cidade para salvar.");
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
      setErr(failure("salvar a cidade", e));
    }
  }

  async function removeCity(city: City) {
    const hasCams = (camerasByCity.get(city.id)?.length ?? 0) > 0;
    const msg = hasCams
      ? `Remover a cidade "${city.name}"? As câmeras cadastradas nela (${camerasByCity.get(city.id)!.length}) também serão removidas.`
      : `Remover a cidade "${city.name}"?`;
    if (!confirm(msg)) return;
    try {
      await deleteCity(city.id);
      await reload();
    } catch (e: any) {
      setErr(failure("remover a cidade", e));
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

    if (!name) return setErr("Informe o nome da câmera para salvar.");
    if (!cityId) return setErr("Escolha a cidade da câmera para salvar.");
    if (Number.isNaN(latitude) || Number.isNaN(longitude))
      return setErr(
        "Latitude ou longitude inválida. Use graus decimais com ponto, como -23.5629."
      );

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
      setErr(failure("salvar a câmera", e));
    }
  }

  async function removeCamera(cam: Camera) {
    if (!confirm(`Remover a câmera "${cam.name}"?`)) return;
    try {
      await deleteCamera(cam.id);
      await reload();
    } catch (e: any) {
      setErr(failure("remover a câmera", e));
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

  // Com um diálogo aberto, o erro aparece dentro dele: atrás do fundo
  // escurecido a pessoa não veria por que o formulário não salvou.
  const dialogOpen = cityForm !== null || cameraForm !== null;

  return (
    <div className="space-y-10">
      <PageHeader
        title="Câmeras"
        description="Cada câmera pertence a uma cidade e é a origem das contagens."
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary"
              onClick={() => setCityForm({ name: "" })}
            >
              <Plus size={16} aria-hidden />
              Cadastrar cidade
            </button>
          </div>
        }
      />

      {err && !dialogOpen && (
        <div
          role="alert"
          className="alert-error flex items-start justify-between gap-3 !py-1 !pr-1"
        >
          <p className="py-2.5 text-sm font-medium">{err}</p>
          <button
            type="button"
            className="btn-ghost h-11 w-11 shrink-0 px-0"
            onClick={() => setErr(null)}
            aria-label="Fechar aviso de erro"
          >
            <X size={18} aria-hidden />
          </button>
        </div>
      )}

      {/* Recarregar depois de salvar mantém a lista na tela; o aviso de
          carregamento só aparece enquanto ainda não há o que mostrar. */}
      {loading && cities.length === 0 && (
        <p className="text-ink-muted">Carregando câmeras e cidades…</p>
      )}

      {!loading && cities.length === 0 && (
        <Sheet title="Nenhuma cidade cadastrada">
          <p className="max-w-[60ch] text-ink-muted">
            A cidade agrupa as câmeras. A posição no mapa, em latitude e
            longitude, fica em cada câmera. Cadastre a primeira cidade para
            liberar o cadastro de câmeras.
          </p>
          <button
            type="button"
            className="btn-primary mt-4"
            onClick={() => setCityForm({ name: "" })}
          >
            <Plus size={16} aria-hidden />
            Cadastrar cidade
          </button>
        </Sheet>
      )}

      {cities.map((city) => (
        <CityCamerasSheet
          key={city.id}
          city={city}
          cameras={camerasByCity.get(city.id) ?? []}
          onAddCamera={() => openNewCamera(city.id)}
          onRenameCity={() => setCityForm({ id: city.id, name: city.name })}
          onRemoveCity={() => removeCity(city)}
          onEditCamera={openEditCamera}
          onRemoveCamera={removeCamera}
        />
      ))}

      {cityForm && (
        <CityFormDialog
          form={cityForm}
          error={err}
          onChange={setCityForm}
          onClose={() => setCityForm(null)}
          onSubmit={submitCity}
        />
      )}

      {cameraForm && (
        <CameraFormDialog
          form={cameraForm}
          cities={cities}
          error={err}
          onChange={setCameraForm}
          onClose={() => setCameraForm(null)}
          onSubmit={submitCamera}
        />
      )}
    </div>
  );
}
