import type { MatchDef } from "@arena/shared";
import { describe, expect, it } from "vitest";
import { buildBracketGraph } from "./bracketGraph";

function match(id: string, winnerId: string | null = null): MatchDef {
  const participants = ["a", "b"].map((suffix) => ({
    botId: `${id}-${suffix}`,
    name: suffix,
    author: "A",
    color: "#000",
  }));
  return {
    id,
    participants,
    status: winnerId ? "finished" : "pending",
    result: winnerId
      ? {
          entries: participants.map((participant, index) => ({
            botId: participant.botId,
            rank: participant.botId === winnerId ? 1 : 2,
            score: 10 - index,
            fruitScore: 0,
            coinsCollected: 0,
            deaths: 0,
            timeElapsedMs: 0,
            reachedGoal: false,
            disabled: false,
          })),
        }
      : null,
  };
}

function roundCounts(nodes: ReturnType<typeof buildBracketGraph>["nodes"]): number[] {
  const counts: number[] = [];
  for (const node of nodes) counts[node.roundIndex] = (counts[node.roundIndex] ?? 0) + 1;
  return counts;
}

describe("buildBracketGraph", () => {
  it("creates every future slot for group size four", () => {
    const firstRound = Array.from({ length: 5 }, (_, index) => match(`m${index}`));
    expect(roundCounts(buildBracketGraph([firstRound], 4).nodes)).toEqual([5, 2, 1]);
  });

  it("connects a finished match to a synthetic target and highlights its winner", () => {
    const first = match("m0", "m0-a");
    const graph = buildBracketGraph([[first, match("m1"), match("m2")]], 2);

    expect(graph.edges.find((edge) => edge.sourceNodeId === "round-0-slot-0")).toEqual({
      sourceNodeId: "round-0-slot-0",
      targetNodeId: "round-1-slot-0",
      advancedBotId: "m0-a",
      highlighted: true,
    });
    expect(graph.nodes.find((node) => node.id === "round-1-slot-0")?.match).toBeNull();
    expect(
      graph.nodes
        .find((node) => node.id === "round-1-slot-0")
        ?.qualifiers.map((participant) => participant.botId)
    ).toEqual(["m0-a"]);
  });

  it("uses real follow-up matches when already materialized", () => {
    const final = match("final");
    const graph = buildBracketGraph([[match("semi-1"), match("semi-2")], [final]], 2);

    expect(graph.nodes.find((node) => node.id === "round-1-slot-0")?.match).toBe(final);
  });
});
