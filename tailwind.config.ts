import type { Config } from "tailwindcss";
import { tailwindThemeExtension } from "./src/themes/tailwind";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      ...(tailwindThemeExtension() as unknown as NonNullable<Config["theme"]>),
      fontFamily: {
        ...(tailwindThemeExtension().fontFamily as Record<string, string>),
        arcade: ['"Bungee"', "Impact", "sans-serif"],
        pixel: ['"Press Start 2P"', "monospace"],
      },
    },
  },
} satisfies Config;
