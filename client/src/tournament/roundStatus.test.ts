import type { MatchDef } from "@arena/shared";
import { describe, expect, it } from "vitest";
import { computeRoundStatus } from "./roundStatus";

function match(overrides: Partial<MatchDef> & { id: string }): MatchDef {
  return {
    id: overrides.id,
    participants: [
      { botId: "b1", name: "Bot 1", author: "A", color: "#000" },
      { botId: "b2", name: "Bot 2", author: "B", color: "#111" },
    ],
    status: overrides.status ?? "pending",
    result: overrides.result ?? null,
  };
}

describe("computeRoundStatus", () => {
  it('ist "running", sobald ein Match läuft', () => {
    expect(computeRoundStatus([match({ id: "m1", status: "running" })])).toBe("running");
  });

  it('ist "finished", wenn alle Matches beendet sind', () => {
    expect(
      computeRoundStatus([
        match({ id: "m1", status: "finished", result: { entries: [] } }),
        match({ id: "m2", status: "finished", result: { entries: [] } }),
      ])
    ).toBe("finished");
  });

  it('ist "running", wenn einige fertig, aber keines läuft (angegangene Runde)', () => {
    expect(
      computeRoundStatus([
        match({ id: "m1", status: "finished", result: { entries: [] } }),
        match({ id: "m2" }),
      ])
    ).toBe("running");
  });

  it('ist "pending", wenn noch kein Match begonnen hat', () => {
    expect(computeRoundStatus([match({ id: "m1" }), match({ id: "m2" })])).toBe("pending");
  });

  it('ist "pending" für eine leere Runde', () => {
    expect(computeRoundStatus([])).toBe("pending");
  });
});
