"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import LiveCameraWall from "@/components/LiveCameraWall";
import Sheet from "@/components/Sheet";
import type { Camera, LiveStatus } from "@/lib/types";

interface Props {
  /** Transmissões a mostrar (já filtradas pelo local escolhido). */
  streams: LiveStatus[];
  cameras: Camera[];
  /**
   * Mostra a contagem da transmissão sob o vídeo. Fica desligada quando o
   * resumo do período está ao lado, para não haver dois totais diferentes.
   */
  showSessionCounts?: boolean;
}

/**
 * Transmissões em andamento na visão geral: o vídeo anotado de cada câmera com
 * a contagem do momento.
 */
export default function OverviewLiveNow({
  streams,
  cameras,
  showSessionCounts = true,
}: Props) {
  const router = useRouter();
  if (streams.length === 0) return null;

  return (
    <Sheet
      title={
        streams.length === 1
          ? "Ao vivo agora"
          : `${streams.length} câmeras ao vivo agora`
      }
      aside={
        <Link href="/live" className="text-sm font-semibold text-brand underline">
          Abrir Ao vivo
        </Link>
      }
    >
      <LiveCameraWall
        streams={streams}
        cameras={cameras}
        showCounts={showSessionCounts}
        onOpen={() => router.push("/live")}
      />
    </Sheet>
  );
}
