import type { Metadata } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";

// Barlow no texto e Barlow Condensed em títulos e números: a família vem da
// letra de placas e painéis rodoviários.
const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-barlow",
  display: "swap",
});
const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-barlow-condensed",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FluxVision: contagem de tráfego por vídeo",
  description:
    "Conta veículos e pedestres em vídeo de câmera de rua e entrega a contagem por hora, o mapa de calor e os alertas.",
};

// Aplica o tema salvo antes da primeira pintura, para a página não piscar.
const THEME_BOOT = `try{var t=localStorage.getItem("fluxvision-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="pt-BR"
      className={`${barlow.variable} ${barlowCondensed.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body className="font-sans">
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-lane focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-on-lane"
        >
          Ir para o conteúdo
        </a>
        <div className="min-h-screen lg:grid lg:grid-cols-[232px_minmax(0,1fr)]">
          <Sidebar />
          <div className="flex min-w-0 flex-col">
            <Topbar />
            <main id="conteudo" className="flex-1">
              <div className="mx-auto max-w-[1536px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
                {children}
              </div>
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
