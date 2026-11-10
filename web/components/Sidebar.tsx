"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

const NAV_GROUPS = [
  {
    title: "Leitura",
    items: [
      { href: "/", label: "Visão geral" },
      { href: "/analytics", label: "Séries" },
      { href: "/comparison", label: "Comparativo" },
      { href: "/heatmap", label: "Mapa de calor" },
      { href: "/alerts", label: "Alertas" },
    ],
  },
  {
    title: "Captura",
    items: [
      { href: "/cameras", label: "Câmeras" },
      { href: "/upload", label: "Enviar vídeo" },
      { href: "/live", label: "Ao vivo" },
    ],
  },
];

/**
 * Trilho em verde de placa. No desktop fica fixo à esquerda; abaixo de 1024 px
 * vira uma barra no topo com o botão que abre a navegação.
 */
export default function Sidebar() {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  // Trocar de rota fecha o menu do celular.
  useEffect(() => {
    setOpen(false);
  }, [path]);

  return (
    <aside className="bg-rail text-rail-ink lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto">
      <div className="flex items-center justify-between px-4 lg:block lg:px-5 lg:pb-5 lg:pt-6">
        <Link href="/" className="flex min-h-14 items-center gap-2.5 lg:min-h-0">
          <FluxMark />
          <span className="font-display text-2xl font-bold leading-none">
            FluxVision
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="navegacao-principal"
          className="inline-flex h-11 items-center gap-2 rounded-md px-3 text-sm font-semibold hover:bg-rail-ink/10 lg:hidden"
        >
          {open ? <X size={18} aria-hidden /> : <Menu size={18} aria-hidden />}
          {open ? "Fechar" : "Menu"}
        </button>
      </div>

      <nav
        id="navegacao-principal"
        aria-label="Principal"
        className={cn(
          "border-t border-rail-rule px-3 pb-4 lg:block lg:border-t-0 lg:pb-6",
          open ? "block" : "hidden"
        )}
      >
        {NAV_GROUPS.map((group) => (
          <div key={group.title} className="mt-4 first:mt-3 lg:first:mt-0">
            <div className="px-3 pb-1 text-xs font-semibold text-rail-muted">
              {group.title}
            </div>
            <ul>
              {group.items.map(({ href, label }) => {
                const active =
                  href === "/" ? path === "/" : path?.startsWith(href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex min-h-11 items-center rounded-md px-3 text-[15px] font-semibold transition-colors lg:min-h-10",
                        active
                          ? "bg-rail-ink text-rail"
                          : "text-rail-ink hover:bg-rail-ink/10"
                      )}
                    >
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}

/** Marca: um trecho de pista visto de cima, com o eixo tracejado. */
function FluxMark() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
      <rect x="1" y="5" width="24" height="16" rx="2" fill="rgb(var(--rail-ink))" />
      <rect x="4" y="12" width="5" height="2" fill="rgb(var(--lane))" />
      <rect x="11" y="12" width="5" height="2" fill="rgb(var(--lane))" />
      <rect x="18" y="12" width="4" height="2" fill="rgb(var(--lane))" />
    </svg>
  );
}
