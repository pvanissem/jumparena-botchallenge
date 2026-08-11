import type { MatchDef, TournamentState } from "@arena/shared";
import { describe, expect, it } from "vitest";
import { selectNextPendingMatch } from "./selectNextPendingMatch";

function match(id: string, status: MatchDef["status"], participantCount = 2): MatchDef {
  return {
    id,
    participants: Array.from({ length: participantCount }, (_, index) => ({
      botId: `${id}-bot-${index}`,
      name: `Bot ${index}`,
      author: "A",
      color: "#000",
    })),
    status,
    result: null,
  };
}

function state(rounds: MatchDef[][]): TournamentState {
  return {
    mode: "single-elimination",
    stageLevelIds: ["level-one"],
    livesPerRun: 3,
    groupSize: 2,
    rounds,
    status: "running",
    championBotId: null,
  };
}

describe("selectNextPendingMatch", () => {
  it("selects the first real pending match in round and array order", () => {
    const next = selectNextPendingMatch(
      state([
        [match("finished", "finished"), match("running", "running")],
        [match("next", "pending"), match("later", "pending")],
      ])
    );

    expect(next).toEqual({ match: expect.objectContaining({ id: "next" }), roundIndex: 1 });
  });

  it("skips a pending bye defensively", () => {
    const next = selectNextPendingMatch(
      state([[match("bye", "pending", 1), match("real", "pending", 2)]])
    );

    expect(next?.match.id).toBe("real");
  });

  it("returns null when no real pending match remains", () => {
    expect(
      selectNextPendingMatch(state([[match("done", "finished"), match("active", "running")]]))
    ).toBeNull();
  });
});
