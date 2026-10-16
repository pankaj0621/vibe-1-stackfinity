import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#141210",
          900: "#0D0B0A",
          800: "#1C1815",
          700: "#282220",
          600: "#3B322C",
          500: "#5B4F47",
        },
        sun: {
          DEFAULT: "#FFC93C",
          100: "#FFF1C9",
          400: "#FFD766",
          500: "#FFB703",
          600: "#E8960C",
        },
        cream: "#FFF8EC",
        coral: {
          DEFAULT: "#FF5B4A",
          100: "#FFE1DC",
          600: "#E8412F",
        },
        teal: {
          DEFAULT: "#0FA47F",
          100: "#D6F3EA",
          600: "#0B7D61",
        },
        grape: {
          DEFAULT: "#6D5AE6",
          100: "#E7E3FF",
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        pop: "0 28px 60px -28px rgba(20,18,16,0.45)",
        soft: "0 12px 32px -14px rgba(20,18,16,0.22)",
        glow: "0 18px 44px -18px rgba(255,183,3,0.65)",
      },
    },
  },
  plugins: [],
};

export default config;
