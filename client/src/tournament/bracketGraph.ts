import type { MatchDef, MatchParticipant } from "@arena/shared";

export interface BracketNode {
  id: string;
  roundIndex: number;
  matchIndex: number;
  match: MatchDef | null;
  qualifiers: MatchParticipant[];
}

export interface BracketEdge {
  sourceNodeId: string;
  targetNodeId: string;
  advancedBotId: string | null;
  highlighted: boolean;
}

export interface BracketGraph {
  nodes: BracketNode[];
  edges: BracketEdge[];
}

function slotId(roundIndex: number, matchIndex: number): string {
  return `round-${roundIndex}-slot-${matchIndex}`;
}

function winnerId(match: MatchDef | null): string | null {
  return match?.result?.entries.find((entry) => entry.rank === 1)?.botId ?? null;
}

function winnerParticipant(match: MatchDef | null): MatchParticipant | null {
  const id = winnerId(match);
  return match?.participants.find((participant) => participant.botId === id) ?? null;
}

export function buildBracketGraph(
  rounds: readonly (readonly MatchDef[])[],
  groupSize: number
): BracketGraph {
  const firstRoundCount = rounds[0]?.length ?? 0;
  if (firstRoundCount === 0) return { nodes: [], edges: [] };

  const slotCounts = [firstRoundCount];
  while (slotCounts[slotCounts.length - 1] > 1) {
    slotCounts.push(Math.ceil(slotCounts[slotCounts.length - 1] / groupSize));
  }

  const baseNodes = slotCounts.flatMap((count, roundIndex) =>
    Array.from({ length: count }, (_, matchIndex) => ({
      id: slotId(roundIndex, matchIndex),
      roundIndex,
      matchIndex,
      match: rounds[roundIndex]?.[matchIndex] ?? null,
    }))
  );
  const qualifiersByNode = new Map<string, MatchParticipant[]>();
  const edges = baseNodes
    .filter((node) => node.roundIndex < slotCounts.length - 1)
    .map((node) => {
      const advancedBotId = winnerId(node.match);
      const targetNodeId = slotId(node.roundIndex + 1, Math.floor(node.matchIndex / groupSize));
      const qualifier = winnerParticipant(node.match);
      if (qualifier) {
        qualifiersByNode.set(targetNodeId, [
          ...(qualifiersByNode.get(targetNodeId) ?? []),
          qualifier,
        ]);
      }
      return {
        sourceNodeId: node.id,
        targetNodeId,
        advancedBotId,
        highlighted: advancedBotId !== null,
      };
    });
  const nodes = baseNodes.map((node) => ({
    ...node,
    qualifiers: qualifiersByNode.get(node.id) ?? [],
  }));

  return { nodes, edges };
}
