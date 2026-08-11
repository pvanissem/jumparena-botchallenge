import { RUN_TIME_LIMIT_MS } from "../../game/rules/racerState";
import type { LiveStanding } from "../../tournament/liveStandings";

export interface LiveScoreboardProps {
  standings: LiveStanding[];
  variant: "admin" | "present";
}

const STATUS_LABELS: Record<LiveStanding["status"], string> = {
  racing: "Im Rennen",
  finished: "Im Ziel",
  dnf: "Nicht im Ziel",
  disabled: "Deaktiviert",
};

function seconds(ms: number): string {
  return `${(Math.max(0, ms) / 1_000).toFixed(1)}s`;
}

export function LiveScoreboard({ standings, variant }: LiveScoreboardProps) {
  return (
    <section
      className={`live-scoreboard live-scoreboard--${variant}`}
      aria-label="Live-Punktestand"
      data-variant={variant}
    >
      <header className="live-scoreboard__header">
        <h2>Live Score</h2>
        <span className="live-scoreboard__count">{standings.length} Bots</span>
      </header>
      <ol className="live-scoreboard__list">
        {standings.map((standing) => (
          <li
            key={standing.botId}
            aria-label={`Platz ${standing.rank}, ${standing.name}`}
            className="live-scoreboard__row"
            data-leader={standing.rank === 1 ? "true" : "false"}
            data-status={standing.status}
            style={{ borderInlineStartColor: standing.color }}
          >
            <strong className="live-scoreboard__rank">#{standing.rank}</strong>
            <span className="live-scoreboard__name">{standing.name}</span>
            <span className="live-scoreboard__score">{standing.score} PTS</span>
            <span>{Math.round(standing.progress * 100)}%</span>
            <span>
              <span aria-hidden="true">♥</span> {standing.livesRemaining} Leben
            </span>
            <span>Restzeit {seconds(RUN_TIME_LIMIT_MS - standing.timeElapsedMs)}</span>
            <span className="live-scoreboard__status">{STATUS_LABELS[standing.status]}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
