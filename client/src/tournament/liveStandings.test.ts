import type { MatchDef, MatchProgressMessage } from "@arena/shared";
import { describe, expect, it } from "vitest";
import { buildLiveStandings } from "./liveStandings";

const match: MatchDef = {
  id: "m1",
  participants: [
    { botId: "leader", name: "Leader", author: "A", color: "#00ffff" },
    { botId: "chaser", name: "Chaser", author: "B", color: "#ff00ff" },
  ],
  status: "running",
  result: null,
};

function progress(
  botId: string,
  overrides: Partial<MatchProgressMessage["entries"][number]> = {}
): MatchProgressMessage["entries"][number] {
  return {
    botId,
    fruitScore: 10,
    livesRemaining: 3,
    timeElapsedMs: 1_000,
    progress: 0.2,
    finished: false,
    didNotFinish: false,
    disabled: false,
    ...overrides,
  };
}

describe("buildLiveStandings", () => {
  it("sorts by score, progress, time and stable bot id", () => {
    const standings = buildLiveStandings(
      match,
      [progress("chaser", { progress: 0.3 }), progress("leader", { fruitScore: 20 })],
      3
    );

    expect(standings.map((entry) => entry.botId)).toEqual(["leader", "chaser"]);
    expect(standings[0]).toMatchObject({ rank: 1, status: "racing" });
  });

  it("creates neutral rows for participants without progress", () => {
    expect(buildLiveStandings(match, [], 3)).toEqual([
      expect.objectContaining({ botId: "chaser", rank: 1, score: 0, livesRemaining: 3 }),
      expect.objectContaining({ botId: "leader", rank: 2, score: 0, livesRemaining: 3 }),
    ]);
  });

  it.each([
    [{ disabled: true }, "disabled"],
    [{ didNotFinish: true }, "dnf"],
    [{ finished: true }, "finished"],
  ] as const)("maps progress flags to %s", (flags, expected) => {
    const standings = buildLiveStandings(match, [progress("leader", flags)], 3);
    expect(standings.find((entry) => entry.botId === "leader")?.status).toBe(expected);
  });
});
