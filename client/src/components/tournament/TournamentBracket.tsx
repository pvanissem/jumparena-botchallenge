import type { MatchDef, TournamentShowState, TournamentState } from "@arena/shared";
import { resolveStageLevelId } from "@arena/shared";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { LEVEL_REGISTRY } from "../../game/level/levelRegistry";
import { buildBracketGraph } from "../../tournament/bracketGraph";
import { selectVisibleRoundRange } from "../../tournament/showSelectors";

export interface TournamentBracketProps {
  state: TournamentState;
  show: TournamentShowState | null;
  variant: "admin" | "present";
}

interface EdgePath {
  id: string;
  d: string;
  highlighted: boolean;
}

function levelLabel(state: TournamentState, roundIndex: number): string {
  const id = resolveStageLevelId(state.stageLevelIds, roundIndex);
  return LEVEL_REGISTRY.find((entry) => entry.id === id)?.label ?? id;
}

function winnerId(match: MatchDef): string | null {
  return match.result?.entries.find((entry) => entry.rank === 1)?.botId ?? null;
}

function MatchNode({ match, active }: { match: MatchDef; active: boolean }) {
  const winner = winnerId(match);
  return (
    <article
      className={`tournament-bracket__match tournament-bracket__match--${match.status}`}
      aria-label={`Match ${match.id}`}
      data-active={active ? "true" : "false"}
    >
      <span className="tournament-bracket__status">
        {match.status === "running"
          ? "Live"
          : match.status === "finished"
            ? "Beendet"
            : "Ausstehend"}
      </span>
      <ol className="tournament-bracket__participants">
        {match.participants.map((participant) => {
          const isWinner = participant.botId === winner;
          const eliminated = match.status === "finished" && winner !== null && !isWinner;
          return (
            <li
              key={participant.botId}
              className={eliminated ? "tournament-bracket__participant--eliminated" : undefined}
              style={{ borderInlineStartColor: participant.color }}
            >
              <span>{participant.name}</span>
              {isWinner && <strong>Sieger</strong>}
            </li>
          );
        })}
      </ol>
    </article>
  );
}

export function TournamentBracket({ state, show, variant }: TournamentBracketProps) {
  const graph = useMemo(
    () => buildBracketGraph(state.rounds, state.groupSize),
    [state.groupSize, state.rounds]
  );
  const roundCount = Math.max(0, ...graph.nodes.map((node) => node.roundIndex + 1));
  const range =
    variant === "present"
      ? selectVisibleRoundRange(roundCount, show?.activeRoundIndex ?? 0)
      : { startIndex: 0, endIndex: Math.max(0, roundCount - 1) };
  const visibleNodes = useMemo(
    () =>
      graph.nodes.filter(
        (node) => node.roundIndex >= range.startIndex && node.roundIndex <= range.endIndex
      ),
    [graph.nodes, range.endIndex, range.startIndex]
  );
  const visibleIds = useMemo(() => new Set(visibleNodes.map((node) => node.id)), [visibleNodes]);
  const containerRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef(new Map<string, HTMLElement>());
  const [paths, setPaths] = useState<EdgePath[]>([]);

  useLayoutEffect(() => {
    const updatePaths = () => {
      const container = containerRef.current;
      if (!container) return;
      const containerRect = container.getBoundingClientRect();
      setPaths(
        graph.edges
          .filter((edge) => visibleIds.has(edge.sourceNodeId) && visibleIds.has(edge.targetNodeId))
          .flatMap((edge) => {
            const source = nodeRefs.current.get(edge.sourceNodeId)?.getBoundingClientRect();
            const target = nodeRefs.current.get(edge.targetNodeId)?.getBoundingClientRect();
            if (!source || !target) return [];
            const x1 = source.right - containerRect.left;
            const y1 = source.top + source.height / 2 - containerRect.top;
            const x2 = target.left - containerRect.left;
            const y2 = target.top + target.height / 2 - containerRect.top;
            const middle = (x1 + x2) / 2;
            return [
              {
                id: edge.sourceNodeId,
                d: `M ${x1} ${y1} C ${middle} ${y1}, ${middle} ${y2}, ${x2} ${y2}`,
                highlighted: edge.highlighted,
              },
            ];
          })
      );
    };

    updatePaths();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updatePaths);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [graph.edges, visibleIds]);

  return (
    <div ref={containerRef} className={`tournament-bracket tournament-bracket--${variant}`}>
      <svg className="tournament-bracket__edges" aria-hidden="true">
        {paths.map((path) => (
          <path
            key={path.id}
            d={path.d}
            className={path.highlighted ? "tournament-bracket__edge--highlighted" : undefined}
          />
        ))}
      </svg>
      {Array.from({ length: range.endIndex - range.startIndex + 1 }, (_, offset) => {
        const roundIndex = range.startIndex + offset;
        const nodes = visibleNodes.filter((node) => node.roundIndex === roundIndex);
        return (
          <section className="tournament-bracket__round" key={roundIndex}>
            <h3>
              Runde {roundIndex + 1} · {levelLabel(state, roundIndex)}
            </h3>
            <div className="tournament-bracket__round-matches">
              {nodes.map((node) => (
                <div
                  key={node.id}
                  ref={(element) => {
                    if (element) nodeRefs.current.set(node.id, element);
                    else nodeRefs.current.delete(node.id);
                  }}
                  data-node-id={node.id}
                >
                  {node.match ? (
                    <MatchNode match={node.match} active={show?.activeMatchId === node.match.id} />
                  ) : (
                    <article
                      className="tournament-bracket__match tournament-bracket__match--placeholder"
                      aria-label={`Zukünftiges Match ${roundIndex + 1}-${node.matchIndex + 1}`}
                    >
                      Wartet auf Sieger
                    </article>
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
