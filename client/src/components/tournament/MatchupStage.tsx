import type { MatchDef } from "@arena/shared";

interface MatchupStageProps {
  match: MatchDef;
  roundLabel: string;
  countdown: number | null;
}

export function MatchupStage({ match, roundLabel, countdown }: MatchupStageProps) {
  return (
    <section className="matchup-stage" data-participant-count={match.participants.length}>
      <header className="matchup-stage__header">
        <span>{roundLabel}</span>
        <h2>Bereit für das nächste Match?</h2>
      </header>

      <div className="matchup-stage__participants">
        {match.participants.map((participant, index) => (
          <article
            key={participant.botId}
            className="matchup-stage__participant"
            style={{ borderColor: participant.color }}
          >
            <span className="matchup-stage__slot">Player {index + 1}</span>
            <h3>{participant.name}</h3>
            <p>gebaut von {participant.author}</p>
          </article>
        ))}
      </div>

      {countdown !== null && (
        <strong
          className="matchup-stage__countdown"
          role="timer"
          aria-label={`Start in ${countdown} Sekunden`}
        >
          {countdown}
        </strong>
      )}
    </section>
  );
}
