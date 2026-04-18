import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";

export const metadata: Metadata = {
  title: "FluxVision — Inteligência de Fluxo Urbano",
  description:
    "Plataforma de IA para monitoramento de fluxo de veículos por vídeo, com dashboards, heatmaps e alertas de anomalia.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>
        <div className="min-h-screen grid grid-cols-[240px_1fr]">
          <Sidebar />
          <div className="flex flex-col">
            <Topbar />
            <main className="flex-1 p-6">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
