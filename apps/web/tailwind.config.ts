import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"] ,
  theme: {
    extend: {
      colors: {
        background: "var(--color-bg)",
        foreground: "var(--color-fg)",
        card: "var(--color-card)",
        primary: "var(--color-primary)",
        primaryForeground: "var(--color-primary-fg)",
        accent: "var(--color-accent)",
        "accent-foreground": "var(--color-accent-fg)",
        muted: "var(--color-muted)",
        "muted-foreground": "var(--color-muted-fg)",
        border: "var(--color-border)"
      },
      borderRadius: {
        xl: "1.25rem"
      }
    }
  },
  plugins: []
};

export default config;
