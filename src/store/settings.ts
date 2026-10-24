import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_KEYS, DEFAULT_PAD, type Action, type DeviceId, type KeyProfile, type PadBinding, type PadProfile } from "@/input/bindings";

export interface Settings {
  name: string;
  keys: Record<"kbA" | "kbB", KeyProfile>;
  pad: PadProfile;
  /** Devices that control each player in local versus. */
  sources: [DeviceId[], DeviceId[]];
  music: number;
  sfx: number;
  cpuLevel: number;
  rounds: number;
  time: number;
  inputDelay: number;
  screenShake: boolean;
  showInputs: boolean;
  setKey: (profile: "kbA" | "kbB", action: Action, code: string) => void;
  setPad: (action: Action, binding: PadBinding) => void;
  resetControls: () => void;
  toggleSource: (player: 0 | 1, device: DeviceId) => void;
  set: (patch: Partial<Settings>) => void;
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

export const useSettings = create<Settings>()(
  persist(
    (set) => ({
      name: "Candidat",
      keys: clone(DEFAULT_KEYS),
      pad: clone(DEFAULT_PAD),
      sources: [["kbA", "pad0"], ["kbB", "pad1"]],
      music: 0.6,
      sfx: 0.8,
      cpuLevel: 1,
      rounds: 2,
      time: 99,
      inputDelay: 2,
      screenShake: true,
      showInputs: false,
      setKey: (profile, action, code) =>
        set((s) => {
          const keys = clone(s.keys);
          // A key does one thing per profile: remove it elsewhere first.
          for (const a of Object.keys(keys[profile]) as Action[]) keys[profile][a] = keys[profile][a].filter((c) => c !== code);
          keys[profile][action] = [code];
          return { keys };
        }),
      setPad: (action, binding) =>
        set((s) => {
          const pad = clone(s.pad);
          const same = (x: PadBinding) => x.kind === binding.kind && x.index === binding.index && (x.kind !== "axis" || binding.kind !== "axis" || x.dir === binding.dir);
          for (const a of Object.keys(pad) as Action[]) pad[a] = pad[a].filter((x) => !same(x));
          pad[action] = [binding];
          return { pad };
        }),
      resetControls: () => set({ keys: clone(DEFAULT_KEYS), pad: clone(DEFAULT_PAD), sources: [["kbA", "pad0"], ["kbB", "pad1"]] }),
      toggleSource: (player, device) =>
        set((s) => {
          const sources = clone(s.sources);
          const other = (1 - player) as 0 | 1;
          if (sources[player].includes(device)) sources[player] = sources[player].filter((d) => d !== device);
          else {
            sources[player].push(device);
            sources[other] = sources[other].filter((d) => d !== device);
          }
          return { sources };
        }),
      set: (patch) => set(patch),
    }),
    { name: "prezfighter-settings", version: 1 }
  )
);
