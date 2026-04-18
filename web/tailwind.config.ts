import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Paleta FluxVision — dark-first, inteligência urbana
        bg: {
          DEFAULT: "#0a0e1a",
          subtle: "#0f1524",
          card: "#121a2e",
          elevated: "#17203a",
          border: "#1e2a47",
        },
        brand: {
          DEFAULT: "#38bdf8", // cyan
          600: "#0ea5e9",
          700: "#0284c7",
          muted: "#164e63",
        },
        positive: "#34d399",
        warning: "#fbbf24",
        negative: "#f87171",
        critical: "#ef4444",
        ink: {
          DEFAULT: "#e2e8f0",
          muted: "#94a3b8",
          soft: "#64748b",
        },
      },
      boxShadow: {
        card: "0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px rgba(0,0,0,0.35)",
        glow: "0 0 0 1px rgba(56,189,248,0.2), 0 8px 32px rgba(56,189,248,0.18)",
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "Inter", "Segoe UI", "Roboto"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
