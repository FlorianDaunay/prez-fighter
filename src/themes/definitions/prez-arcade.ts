import { defineTheme } from "../define";

export default defineTheme({
  id: "prez-arcade",
  name: "Prez Arcade",
  description: "Le thème du jeu : nuit électorale, néons tricolores, coins vifs.",
  scheme: "dark",
  colors: {
    canvas: "#0a0a1c",
    surface: "#15153a",
    surfaceHover: "#22225a",
    border: "#4a4ab0",
    textPrimary: "#ffffff",
    textSecondary: "#cfd2ff",
    textMuted: "#9093c9",
    accent: "#ffcc1a",
    success: "#4ef08a",
    warning: "#ffb020",
    danger: "#ff4a4a",
  },
  radius: { control: "4px", tile: "6px", card: "10px", pill: "9999px" },
  shadow: {
    card: "0 0 0 2px rgb(0 0 0 / 0.6), 0 8px 0 0 rgb(0 0 0 / 0.45)",
    overlay: "0 0 0 3px rgb(0 0 0 / 0.7), 0 0 40px -6px rgb(255 204 26 / 0.45)",
    control: "0 4px 0 0 rgb(0 0 0 / 0.55)",
    inset: "inset 0 3px 0 rgb(0 0 0 / 0.45)",
  },
  fonts: { sans: 'Inter, "Segoe UI", sans-serif' },
});
