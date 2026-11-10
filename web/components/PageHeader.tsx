import type { ReactNode } from "react";

interface Props {
  title: string;
  description?: ReactNode;
  /** Controles da página (período, filtros, ação principal). */
  actions?: ReactNode;
}

/** Cabeçalho único das telas: título, uma linha de contexto e os controles. */
export default function PageHeader({ title, description, actions }: Props) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0">
        <h1 className="font-display text-4xl font-bold leading-none">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-[70ch] text-ink-muted">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="max-w-full">{actions}</div>}
    </header>
  );
}
