"use client";

interface Option<T extends string | number> {
  value: T;
  label: string;
}

interface Props<T extends string | number> {
  /** Nome do grupo para leitores de tela, ex.: "Período". */
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
}

/** Um contêiner com segmentos; o selecionado fica em amarelo de faixa. */
export default function SegmentedControl<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: Props<T>) {
  return (
    <div role="group" aria-label={label} className="segmented">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          className="segment"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
