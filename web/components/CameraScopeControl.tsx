"use client";

import SegmentedControl from "@/components/SegmentedControl";
import type { Camera } from "@/lib/types";

/** Uma câmera específica ou todas somadas. */
export type CameraScope = number | "all";

// Até esta quantidade as câmeras cabem lado a lado; acima disso, lista.
const MAX_CAMERAS_AS_SEGMENTS = 4;

interface Props {
  cameras: Camera[];
  value: CameraScope;
  onChange: (scope: CameraScope) => void;
}

/**
 * Escolhe de qual local são os números da tela. Câmeras de lugares diferentes
 * somadas não descrevem lugar nenhum, então "Todas" fica como última opção.
 */
export default function CameraScopeControl({ cameras, value, onChange }: Props) {
  if (cameras.length < 2) return null;

  if (cameras.length <= MAX_CAMERAS_AS_SEGMENTS) {
    return (
      <SegmentedControl<CameraScope>
        label="Local"
        options={[
          ...cameras.map((c) => ({ value: c.id as CameraScope, label: c.name })),
          { value: "all" as CameraScope, label: "Todas" },
        ]}
        value={value}
        onChange={onChange}
      />
    );
  }

  return (
    <label className="block w-full sm:w-64">
      <span className="sr-only">Local</span>
      <select
        className="input"
        value={String(value)}
        onChange={(e) =>
          onChange(e.target.value === "all" ? "all" : Number(e.target.value))
        }
      >
        {cameras.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
            {c.city_name ? `, ${c.city_name}` : ""}
          </option>
        ))}
        <option value="all">Todas as câmeras</option>
      </select>
    </label>
  );
}
