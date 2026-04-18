"use client";

import { Bell, Search } from "lucide-react";

export default function Topbar() {
  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <header className="h-14 border-b border-bg-border bg-bg-subtle/60 backdrop-blur px-6 flex items-center justify-between">
      <div>
        <div className="text-[11px] uppercase tracking-wider text-ink-muted">
          {today}
        </div>
        <div className="text-sm font-medium">Comando de Inteligência Urbana</div>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden md:flex items-center gap-2 card px-3 py-1.5 text-sm text-ink-muted">
          <Search size={14} />
          <input
            placeholder="Buscar local, câmera ou evento…"
            className="bg-transparent outline-none w-64 placeholder:text-ink-soft"
          />
        </div>
        <button className="card p-2 relative hover:bg-bg-elevated">
          <Bell size={16} />
          <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-critical" />
        </button>
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-brand to-positive grid place-items-center text-[11px] font-bold text-bg">
          BI
        </div>
      </div>
    </header>
  );
}
