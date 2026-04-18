"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Camera,
  Flame,
  LayoutDashboard,
  MapPin,
  Radio,
  UploadCloud,
} from "lucide-react";

import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/comparison", label: "Comparativo", icon: Activity },
  { href: "/heatmap", label: "Mapa de calor", icon: Flame },
  { href: "/alerts", label: "Alertas", icon: AlertTriangle },
  { href: "/cameras", label: "Câmeras", icon: Camera },
  { href: "/upload", label: "Upload", icon: UploadCloud },
  { href: "/live", label: "Ao vivo", icon: Radio },
];

export default function Sidebar() {
  const path = usePathname();
  return (
    <aside className="border-r border-bg-border bg-bg-subtle/80 backdrop-blur">
      <div className="px-5 py-5 border-b border-bg-border flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-brand to-brand-700 grid place-items-center text-bg font-black">
          F
        </div>
        <div>
          <div className="font-semibold leading-tight">FluxVision</div>
          <div className="text-[11px] text-ink-muted leading-tight">
            Urban flow intelligence
          </div>
        </div>
      </div>

      <nav className="p-3 space-y-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? path === "/" : path?.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn("nav-link", active && "active")}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 mt-auto pt-6">
        <div className="card p-3 text-[11px] text-ink-muted leading-relaxed">
          <div className="flex items-center gap-1 text-ink mb-1">
            <MapPin size={12} className="text-brand" />
            <span className="font-semibold">Ambiente</span>
          </div>
          Dashboard conectado à API em{" "}
          <span className="font-mono text-ink">
            {process.env.NEXT_PUBLIC_API_BASE_URL || "localhost:8000"}
          </span>
        </div>
      </div>
    </aside>
  );
}
