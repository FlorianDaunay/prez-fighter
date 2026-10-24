import { describe, expect, it } from "vitest";
import { TRACKS } from "@/audio/tracks";
import { FX_SPRITE } from "@/render/fx";
import { LOOKS } from "@/render/looks";
import { hasPose } from "@/render/poses";
import { hasSprite } from "@/render/sprites";
import { STAGE_ART } from "@/render/stages";
import { COUNTRY } from "@/ui/components";
import { ROSTER } from "./roster";
import { STAGES } from "./stages";
import type { MoveSlot, ProjDef } from "./types";

const FOLLOW_UPS: MoveSlot[] = ["f1", "f2", "f3"];

describe("roster data", () => {
  it("has the 25 fighters, unique ids", () => {
    expect(ROSTER.length).toBe(25);
    expect(new Set(ROSTER.map((c) => c.id)).size).toBe(ROSTER.length);
  });

  it("every look, stage and track exists", () => {
    for (const c of ROSTER) {
      expect(LOOKS[c.look], c.id).toBeDefined();
      const stage = STAGES.find((s) => s.id === c.stage);
      expect(stage, c.id).toBeDefined();
      expect(STAGE_ART[c.stage], c.id).toBeDefined();
      expect(TRACKS[stage!.music], c.id).toBeDefined();
      const sl = c.support.look;
      const ok = sl === "scooter" || sl === "pandas" || (sl.startsWith("@") ? hasSprite(sl.slice(1)) : !!LOOKS[sl]);
      expect(ok, `${c.id} support ${sl}`).toBe(true);
      if (c.origin === "intl") expect(COUNTRY[c.id], c.id).toBeDefined();
    }
  });

  it("every pose, effect and sprite used by a move is drawable", () => {
    for (const c of ROSTER) {
      const projs: ProjDef[] = [...(c.support.projectiles ?? [])];
      for (const [slot, m] of Object.entries(c.moves)) {
        expect(hasPose(m!.pose), `${c.id}.${slot} pose ${m!.pose}`).toBe(true);
        if (m!.fx) expect(hasSprite(FX_SPRITE[m!.fx] ?? ""), `${c.id}.${slot} fx ${m!.fx}`).toBe(true);
        projs.push(...(m!.projectiles ?? []));
      }
      for (const p of projs) {
        if (p.sprite.startsWith("@")) expect(hasSprite(p.sprite.slice(1)), `${c.id} sprite ${p.sprite}`).toBe(true);
      }
    }
  });

  it("chains point to existing follow-ups, and follow-ups are reachable", () => {
    for (const c of ROSTER) {
      const targets = new Set<MoveSlot>();
      for (const [slot, m] of Object.entries(c.moves)) {
        if (!m!.chain) continue;
        expect(c.moves[m!.chain.to], `${c.id}.${slot} → ${m!.chain.to}`).toBeDefined();
        expect(m!.chain.until, `${c.id}.${slot}`).toBeLessThan(m!.frames);
        targets.add(m!.chain.to);
      }
      for (const f of FOLLOW_UPS) if (c.moves[f]) expect(targets.has(f), `${c.id}.${f} unreachable`).toBe(true);
    }
  });

  it("the cast uses the new mechanics", () => {
    const all = ROSTER.flatMap((c) => Object.values(c.moves));
    expect(all.filter((m) => m!.chain).length).toBeGreaterThanOrEqual(10);
    expect(all.filter((m) => m!.reflect).length).toBeGreaterThanOrEqual(4);
    expect(all.filter((m) => m!.heal).length).toBeGreaterThanOrEqual(3);
    expect(ROSTER.filter((c) => c.moves.jS).length).toBeGreaterThanOrEqual(12);
    // No more one-uppercut-fits-all: fewer than half of the cast has an uppercut on ↑ + Special.
    expect(ROSTER.filter((c) => c.moves.sU?.pose === "uppercut").length).toBeLessThan(ROSTER.length / 2);
    // Supers have their own poses.
    expect(ROSTER.filter((c) => c.moves.super?.pose === "decree").length).toBeLessThanOrEqual(3);
  });
});
