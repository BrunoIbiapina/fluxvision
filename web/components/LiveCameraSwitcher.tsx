"use client";

import SegmentedControl from "@/components/SegmentedControl";
import type { Camera, City } from "@/lib/types";

// Até esta quantidade as câmeras cabem lado a lado num seletor; acima disso, lista.
const MAX_CAMERAS_AS_SEGMENTS = 4;

interface Props {
  cameras: Camera[];
  runningIds: Set<number>;
  cityByCameraId: Map<number, City>;
  cameraId: number | null;
  onChange: (cameraId: number) => void;
}

/**
 * Troca de câmera sempre à vista: com várias transmissões, é por aqui que se
 * escolhe qual vídeo e qual contagem aparecem abaixo.
 */
export default function LiveCameraSwitcher({
  cameras,
  runningIds,
  cityByCameraId,
  cameraId,
  onChange,
}: Props) {
  return (
    <div>
      <p id="live-camera-label" className="mb-1.5 text-sm font-medium">
        Câmera em exibição
      </p>
      {cameras.length <= MAX_CAMERAS_AS_SEGMENTS ? (
        <SegmentedControl
          label="Câmera em exibição"
          options={cameras.map((c) => ({
            value: c.id,
            label: runningIds.has(c.id) ? `${c.name}, ao vivo` : c.name,
          }))}
          value={cameraId ?? cameras[0].id}
          onChange={onChange}
        />
      ) : (
        <select
          aria-labelledby="live-camera-label"
          className="input sm:w-80"
          value={cameraId ?? ""}
          onChange={(e) => onChange(Number(e.target.value))}
        >
          {cameras.map((c) => {
            const city = cityByCameraId.get(c.id);
            return (
              <option key={c.id} value={c.id}>
                {c.name}, {city ? city.name : "sem cidade"}
                {runningIds.has(c.id) ? " (ao vivo)" : ""}
              </option>
            );
          })}
        </select>
      )}
    </div>
  );
}
