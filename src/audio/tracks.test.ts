import { describe, expect, it } from "vitest";
import { TRACKS } from "./tracks";

describe("tracks", () => {
  it("every track has aligned layers", () => {
    for (const [id, t] of Object.entries(TRACKS)) {
      expect(t.lead.length % 16, id).toBe(0);
      expect(t.lead.length, id).toBe(t.bass.length);
      expect(t.drums.length, id).toBe(t.bass.length);
    }
  });
});
