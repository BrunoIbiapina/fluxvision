"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";

import Sheet from "@/components/Sheet";
import type { Camera, City } from "@/lib/types";
import { categoryLabel, cn } from "@/lib/utils";

interface Props {
  city: City;
  cameras: Camera[];
  onAddCamera: () => void;
  onRenameCity: () => void;
  onRemoveCity: () => void;
  onEditCamera: (camera: Camera) => void;
  onRemoveCamera: (camera: Camera) => void;
}

/** Uma cidade e a tabela das câmeras cadastradas nela. */
export default function CityCamerasSheet({
  city,
  cameras,
  onAddCamera,
  onRenameCity,
  onRemoveCity,
  onEditCamera,
  onRemoveCamera,
}: Props) {
  return (
    <Sheet
      title={city.name}
      note={
        cameras.length === 0
          ? undefined
          : cameras.length === 1
          ? "1 câmera"
          : `${cameras.length} câmeras`
      }
      aside={
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn" onClick={onAddCamera}>
            <Plus size={16} aria-hidden />
            Cadastrar câmera
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={onRenameCity}
            aria-label={`Renomear a cidade ${city.name}`}
          >
            <Pencil size={16} aria-hidden />
            Renomear
          </button>
          <button
            type="button"
            className="btn-ghost text-negative hover:text-negative"
            onClick={onRemoveCity}
            aria-label={`Remover a cidade ${city.name}`}
          >
            <Trash2 size={16} aria-hidden />
            Remover cidade
          </button>
        </div>
      }
    >
      {cameras.length === 0 ? (
        <p className="py-2 text-ink-muted">
          Nenhuma câmera cadastrada nesta cidade.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="sheet-table min-w-[820px]">
            <thead>
              <tr>
                <th scope="col">Câmera</th>
                <th scope="col">Tipo de ponto</th>
                <th scope="col">Coordenadas</th>
                <th scope="col">Fonte de vídeo</th>
                <th scope="col">Estado</th>
                <th scope="col">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {cameras.map((cam) => (
                <tr key={cam.id}>
                  <td>
                    <span className="font-semibold">{cam.name}</span>
                    {cam.district && (
                      <span className="block text-sm text-ink-muted">
                        {cam.district}
                      </span>
                    )}
                  </td>
                  <td className="text-ink-muted">{categoryLabel(cam.category)}</td>
                  <td className="whitespace-nowrap tabular-nums text-ink-muted">
                    {cam.latitude.toFixed(4)}, {cam.longitude.toFixed(4)}
                  </td>
                  <td className="text-ink-muted">
                    {cam.stream_url ? (
                      <span
                        className="block max-w-[240px] truncate"
                        title={cam.stream_url}
                      >
                        {cam.stream_url}
                      </span>
                    ) : (
                      "Sem fonte salva"
                    )}
                  </td>
                  <td
                    className={cn(
                      "font-semibold",
                      cam.active ? "text-positive" : "text-ink-muted"
                    )}
                  >
                    {cam.active ? "Ativa" : "Inativa"}
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-5">
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => onEditCamera(cam)}
                        aria-label={`Editar a câmera ${cam.name}`}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="btn-ghost text-negative hover:text-negative"
                        onClick={() => onRemoveCamera(cam)}
                        aria-label={`Remover a câmera ${cam.name}`}
                      >
                        Remover
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Sheet>
  );
}
