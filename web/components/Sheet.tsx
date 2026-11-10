import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface Props {
  title: string;
  /** Só quando acrescenta informação que o título não dá. */
  note?: ReactNode;
  /** Controle ou link à direita do título. */
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Seção da ficha: o título e o conteúdo alinhado à borda da coluna.
 * Sem caixa, sem fio e sem respiro lateral próprio; o espaço separa.
 */
export default function Sheet({ title, note, aside, children, className }: Props) {
  return (
    <section className={cn("min-w-0", className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pb-3">
        <div className="min-w-0">
          <h2 className="font-display text-2xl font-semibold leading-tight">
            {title}
          </h2>
          {note && <p className="mt-0.5 text-sm text-ink-muted">{note}</p>}
        </div>
        {aside && <div className="max-w-full">{aside}</div>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}
