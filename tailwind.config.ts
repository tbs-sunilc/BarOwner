import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        ink: {
          DEFAULT: "var(--color-ink)",
          2: "var(--color-ink-2)",
          3: "var(--color-ink-3)",
        },
        ivory: {
          DEFAULT: "var(--color-ivory)",
          2: "var(--color-ivory-2)",
        },
        surface: "var(--color-surface)",
        hairline: "var(--color-border)",
        strong: "var(--color-border-strong)",
        accent: {
          DEFAULT: "var(--color-accent)",
          hi: "var(--color-accent-hi)",
          lo: "var(--color-accent-lo)",
          tint: "var(--color-accent-tint)",
        },
        muted: "var(--color-text-muted)",
        soft: "var(--color-text-soft)",
        invert: "var(--color-text-invert)",
        success: "var(--color-success)",
        danger: "var(--color-danger)",
        info: "var(--color-info)",
      },
      fontFamily: {
        display: "var(--font-display)",
        sans: "var(--font-sans)",
        mono: "var(--font-mono)",
      },
      borderRadius: {
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
      },
    },
  },
  plugins: [],
};
export default config;
