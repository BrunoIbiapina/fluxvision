"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import AlertsBell from "@/components/AlertsBell";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
  "http://localhost:8000";

/**
 * Faixa de topo: data, estado real da API e troca de tema. Só entra aqui o que
 * tem função de verdade por trás.
 */
export default function Topbar() {
  // A data é calculada no cliente para respeitar o fuso de quem está vendo.
  const [today, setToday] = useState("");
  useEffect(() => {
    setToday(
      new Date().toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    );
  }, []);

  return (
    <header>
      <div className="mx-auto flex min-h-12 max-w-[1536px] items-center justify-end sm:justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <p className="hidden min-w-0 truncate text-sm text-ink-muted first-letter:uppercase sm:block">
          {today}
        </p>
        <div className="flex shrink-0 items-center gap-1 sm:gap-3">
          <ApiHealth />
          <AlertsBell />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

type Health = "ok" | "slow" | "down" | "loading";

const HEALTH_LABEL: Record<Health, string> = {
  ok: "API conectada",
  slow: "API lenta",
  down: "API fora do ar",
  loading: "Verificando API",
};

const HEALTH_DOT: Record<Health, string> = {
  ok: "bg-positive",
  slow: "bg-warning",
  down: "bg-critical",
  loading: "bg-ink-soft",
};

/** Consulta /health a cada 10 s; acima de 800 ms conta como lenta. */
function ApiHealth() {
  const [state, setState] = useState<Health>("loading");

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      const started = performance.now();
      try {
        const res = await fetch(`${API_BASE}/health`, { cache: "no-store" });
        if (cancelled) return;
        const took = performance.now() - started;
        setState(!res.ok ? "down" : took > 800 ? "slow" : "ok");
      } catch {
        if (!cancelled) setState("down");
      }
    }

    tick();
    const t = setInterval(tick, 10_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  return (
    <p
      role="status"
      className="mr-1 flex items-center gap-2 text-sm text-ink-muted"
      title={API_BASE}
    >
      <span
        className={`h-2 w-2 rounded-full ${HEALTH_DOT[state]}`}
        aria-hidden="true"
      />
      {HEALTH_LABEL[state]}
    </p>
  );
}

/** Alterna claro/escuro e grava a escolha; sem escolha, segue o sistema. */
function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    const saved = document.documentElement.dataset.theme;
    if (saved === "dark" || saved === "light") {
      setDark(saved === "dark");
      return;
    }
    setDark(window.matchMedia("(prefers-color-scheme: dark)").matches);
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    const value = next ? "dark" : "light";
    document.documentElement.dataset.theme = value;
    try {
      localStorage.setItem("fluxvision-theme", value);
    } catch {
      // Sem armazenamento (aba privada): o tema vale só até recarregar.
    }
  }

  const label = dark ? "Usar tema claro" : "Usar tema escuro";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="inline-flex h-11 w-11 items-center justify-center rounded-md text-ink-muted hover:bg-bg-elevated hover:text-ink"
    >
      {dark ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}
    </button>
  );
}
