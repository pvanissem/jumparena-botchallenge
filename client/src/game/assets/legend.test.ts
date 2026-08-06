import { describe, expect, it } from "vitest";
import { HAZARD_REGISTRY, UTILITY_REGISTRY } from "../hazards/registry";
import { LEGEND_ENTRIES } from "./legend";

describe("LEGEND_ENTRIES", () => {
  it("covers every hazard kind and every utility kind (no drift)", () => {
    const kinds = LEGEND_ENTRIES.map((e) => e.kind);
    for (const kind of Object.keys(HAZARD_REGISTRY)) {
      expect(kinds, `legend entry missing for hazard "${kind}"`).toContain(kind);
    }
    for (const kind of Object.keys(UTILITY_REGISTRY)) {
      expect(kinds, `legend entry missing for utility "${kind}"`).toContain(kind);
    }
    expect(new Set(kinds).size).toBe(kinds.length);
  });

  it("provides a label, a description and an absolute asset url per entry", () => {
    for (const entry of LEGEND_ENTRIES) {
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.description.length).toBeGreaterThan(0);
      expect(entry.preview.url.startsWith("/assets/")).toBe(true);
      expect(entry.preview.url).not.toContain(" ");
    }
  });

  it("reports stompability straight from the hazard registry", () => {
    const frog = LEGEND_ENTRIES.find((e) => e.kind === "ninjafrog");
    const saw = LEGEND_ENTRIES.find((e) => e.kind === "schnetzler");
    const boingo = LEGEND_ENTRIES.find((e) => e.kind === "boingo");
    expect(frog?.stompable).toBe(true);
    expect(saw?.stompable).toBe(false);
    // Utilities sind keine Hazards -> Stompbarkeit ist für sie nicht definiert.
    expect(boingo?.stompable).toBeNull();
  });

  it("exposes the single-frame size for spritesheet previews", () => {
    const frog = LEGEND_ENTRIES.find((e) => e.kind === "ninjafrog");
    expect(frog?.preview.frameWidth).toBe(32);
    expect(frog?.preview.frameHeight).toBe(32);

    // Stachlinger nutzt ein echtes Einzelbild -> keine Frame-Zerlegung nötig.
    const spikes = LEGEND_ENTRIES.find((e) => e.kind === "stachlinger");
    expect(spikes?.preview.frameWidth).toBeNull();
  });
});
