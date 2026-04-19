import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-manrope)", "system-ui", "sans-serif"],
      },
      colors: {
        paper: {
          DEFAULT: "#f5f0e8",
          light: "#fdfbf5",
          warm: "#faf6ed",
          beige: "#ebe3d3",
        },
        ink: {
          DEFAULT: "#2d1f16",
          soft: "#4a3d30",
          muted: "#6b5d4f",
          faint: "#8a7a6a",
          mist: "#a09080",
        },
        line: {
          DEFAULT: "#e8ddc8",
          soft: "#f2ebe0",
        },
        rust: {
          DEFAULT: "#cc785c",
          deep: "#b86544",
          pale: "#f5e1d5",
        },
        honey: "#c8954a",
        agent: {
          architect: "#5b7ca0",
          security: "#c65d47",
          cost: "#7a8956",
          devil: "#8e5b7e",
        },
      },
    },
  },
  plugins: [],
};

export default config;
