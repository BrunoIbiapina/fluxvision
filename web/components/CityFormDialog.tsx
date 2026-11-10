"use client";

import RecordFormDialog, { DialogField } from "@/components/RecordFormDialog";

export type CityFormState = { id?: number; name: string };

interface Props {
  form: CityFormState;
  error: string | null;
  onChange: (form: CityFormState) => void;
  onClose: () => void;
  onSubmit: () => void;
}

/** Formulário de cadastro e de troca de nome de cidade. */
export default function CityFormDialog({
  form,
  error,
  onChange,
  onClose,
  onSubmit,
}: Props) {
  return (
    <RecordFormDialog
      title={form.id ? "Renomear cidade" : "Cadastrar cidade"}
      submitLabel={form.id ? "Salvar cidade" : "Cadastrar cidade"}
      onClose={onClose}
      onSubmit={onSubmit}
      error={error}
    >
      <DialogField label="Nome da cidade">
        <input
          className="input"
          value={form.name}
          onChange={(e) => onChange({ ...form, name: e.target.value })}
          placeholder="São Paulo"
        />
      </DialogField>
    </RecordFormDialog>
  );
}
