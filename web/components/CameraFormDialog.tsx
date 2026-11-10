"use client";

import RecordFormDialog, { DialogField } from "@/components/RecordFormDialog";
import SegmentedControl from "@/components/SegmentedControl";
import type { City, PointCategory } from "@/lib/types";
import { categoryLabel } from "@/lib/utils";

export type CameraFormState = {
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

const POINT_CATEGORIES: PointCategory[] = [
  "avenue",
  "crossing",
  "highway",
  "event_gate",
  "square",
  "parking",
  "other",
];

const ACTIVE_OPTIONS: Array<{ value: "on" | "off"; label: string }> = [
  { value: "on", label: "Ativa" },
  { value: "off", label: "Inativa" },
];

interface Props {
  form: CameraFormState;
  cities: City[];
  error: string | null;
  onChange: (form: CameraFormState) => void;
  onClose: () => void;
  onSubmit: () => void;
}

/** Formulário de cadastro e edição de câmera. O estado mora na página. */
export default function CameraFormDialog({
  form,
  cities,
  error,
  onChange,
  onClose,
  onSubmit,
}: Props) {
  return (
    <RecordFormDialog
      title={form.id ? "Editar câmera" : "Cadastrar câmera"}
      submitLabel={form.id ? "Salvar câmera" : "Cadastrar câmera"}
      onClose={onClose}
      onSubmit={onSubmit}
      error={error}
      wide
    >
      <div className="grid grid-cols-1 gap-x-3 gap-y-4 sm:grid-cols-2">
        <DialogField label="Nome">
          <input
            className="input"
            value={form.name}
            onChange={(e) => onChange({ ...form, name: e.target.value })}
            placeholder="Av. Paulista com Consolação"
          />
        </DialogField>
        <DialogField label="Cidade">
          <select
            className="input"
            value={form.city_id}
            onChange={(e) =>
              onChange({
                ...form,
                city_id: e.target.value ? Number(e.target.value) : "",
              })
            }
          >
            <option value="">Escolha a cidade</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </DialogField>

        <DialogField label="Latitude">
          <input
            className="input tabular-nums"
            inputMode="decimal"
            value={form.latitude}
            onChange={(e) => onChange({ ...form, latitude: e.target.value })}
            placeholder="-23.5629"
          />
        </DialogField>
        <DialogField label="Longitude">
          <input
            className="input tabular-nums"
            inputMode="decimal"
            value={form.longitude}
            onChange={(e) => onChange({ ...form, longitude: e.target.value })}
            placeholder="-46.6544"
          />
        </DialogField>

        <DialogField label="Bairro ou distrito (opcional)">
          <input
            className="input"
            value={form.district}
            onChange={(e) => onChange({ ...form, district: e.target.value })}
          />
        </DialogField>
        <DialogField label="Tipo de ponto">
          <select
            className="input"
            value={form.category}
            onChange={(e) =>
              onChange({ ...form, category: e.target.value as PointCategory })
            }
          >
            {POINT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {categoryLabel(c)}
              </option>
            ))}
          </select>
        </DialogField>

        <DialogField
          label="Fonte de vídeo (opcional)"
          hint="Endereço RTSP ou HTTPS da câmera. Também pode ser salvo depois, na tela Ao vivo."
          className="sm:col-span-2"
        >
          <input
            className="input"
            value={form.stream_url}
            onChange={(e) => onChange({ ...form, stream_url: e.target.value })}
            placeholder="rtsp:// ou https://"
            autoComplete="off"
            spellCheck={false}
          />
        </DialogField>

        <DialogField label="Observações (opcional)" className="sm:col-span-2">
          <textarea
            className="input min-h-[72px]"
            value={form.notes}
            onChange={(e) => onChange({ ...form, notes: e.target.value })}
          />
        </DialogField>

        <div className="flex flex-col items-start gap-1 sm:col-span-2">
          <span className="text-sm font-medium">Estado da câmera</span>
          <SegmentedControl
            label="Estado da câmera"
            options={ACTIVE_OPTIONS}
            value={form.active ? "on" : "off"}
            onChange={(v) => onChange({ ...form, active: v === "on" })}
          />
        </div>
      </div>
    </RecordFormDialog>
  );
}
