import { create } from "zustand";
import type { GameState } from "@/core/types";
import type { OnlineLink } from "@/net/online";

export type Mode = "arcade" | "versus" | "cpu" | "online" | "training";

export type Screen =
  | "boot" | "title" | "menu" | "select" | "stage" | "fight" | "results" | "options" | "controls"
  | "online" | "roster" | "credits" | "arcadeEnd";

export interface ArcadeRun {
  char: number;
  ladder: number[];
  index: number;
  continues: number;
}

interface AppState {
  screen: Screen;
  mode: Mode;
  chars: [number, number];
  stage: string;
  seed: number;
  arcade: ArcadeRun | null;
  lastResult: GameState | null;
  link: OnlineLink | null;
  /** Online: which side this browser plays. */
  localSide: 0 | 1;
  /** Online: rules agreed by the host (both peers must simulate the same match). */
  rules: { rounds: number; time: number } | null;
  go: (screen: Screen) => void;
  set: (patch: Partial<AppState>) => void;
}

export const useApp = create<AppState>()((set) => ({
  screen: "boot",
  mode: "versus",
  chars: [0, 1],
  stage: "elysee",
  seed: 1,
  arcade: null,
  lastResult: null,
  link: null,
  localSide: 0,
  rules: null,
  go: (screen) => set({ screen }),
  set: (patch) => set(patch),
}));
