import type { Config } from "tailwindcss";

// Cada cor aponta para uma variável CSS definida em app/globals.css, com os
// canais RGB separados para os modificadores de opacidade (`bg-brand/15`)
// continuarem funcionando. O tema claro e o escuro trocam só as variáveis.
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Papel técnico e folhas
        bg: {
          DEFAULT: token("bg"),
          subtle: token("bg-subtle"),
          card: token("bg-card"),
          elevated: token("bg-elevated"),
          border: token("bg-border"),
        },
        // Verde de placa de indicação
        brand: {
          DEFAULT: token("brand"),
          600: token("brand-600"),
          700: token("brand-700"),
          muted: token("brand-muted"),
        },
        "on-brand": token("on-brand"),
        // Amarelo de faixa: seleção e eixo da faixa de fluxo
        lane: token("lane"),
        "on-lane": token("on-lane"),
        // Trilho lateral
        rail: {
          DEFAULT: token("rail"),
          ink: token("rail-ink"),
          muted: token("rail-muted"),
          rule: token("rail-rule"),
        },
        positive: token("positive"),
        warning: token("warning"),
        negative: token("negative"),
        critical: token("critical"),
        ink: {
          DEFAULT: token("ink"),
          muted: token("ink-muted"),
          soft: token("ink-soft"),
        },
      },
      borderRadius: {
        // Cantos quase retos, como folha e chapa.
        sm: "2px",
        DEFAULT: "2px",
        md: "3px",
        lg: "4px",
        xl: "4px",
        "2xl": "6px",
      },
      boxShadow: {
        card: "none",
        overlay: "0 12px 32px -8px rgb(var(--shadow) / 0.28)",
      },
      fontFamily: {
        sans: ["var(--font-barlow)", "ui-sans-serif", "system-ui", "sans-serif"],
        // Condensada para títulos e números em destaque.
        display: ["var(--font-barlow-condensed)", "var(--font-barlow)", "sans-serif"],
        // O sistema não usa monoespaçada; `font-mono` cai na mesma família.
        mono: ["var(--font-barlow)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
