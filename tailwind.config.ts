import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        pitch: {
          DEFAULT: "#2e7d32",
          dark: "#1b5e20",
          light: "#43a047",
        },
      },
    },
  },
  plugins: [],
};

export default config;
