"use client";

import { useEffect, useState } from "react";

import { listLive } from "@/lib/api";
import type { LiveStatus } from "@/lib/types";

/** Transmissões em andamento, consultadas a cada `refreshMs`. */
export function useRunningStreams(refreshMs = 5_000): LiveStatus[] {
  const [streams, setStreams] = useState<LiveStatus[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      try {
        const all = await listLive();
        if (!cancelled) setStreams(all.filter((s) => s.running));
      } catch {
        // API fora do ar: o topo já mostra o estado; aqui a lista só esvazia.
        if (!cancelled) setStreams([]);
      }
    }
    tick();
    const t = setInterval(tick, refreshMs);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [refreshMs]);

  return streams;
}
