import type {
  MatchDef,
  TournamentShowAction,
  TournamentShowPhase,
  TournamentShowState,
} from "@arena/shared";

const PHASE_LABELS: Record<TournamentShowPhase, string> = {
  ready: "Bereit",
  "matchup-intro": "Matchup-Intro",
  countdown: "Countdown",
  "match-running": "Match läuft",
  "match-result": "Match-Ergebnis",
  "bracket-update": "Bracket-Update",
  champion: "Champion",
};

const TIMED_PHASES = new Set<TournamentShowPhase>([
  "matchup-intro",
  "countdown",
  "match-result",
  "bracket-update",
]);

interface ShowControlPanelProps {
  show: TournamentShowState;
  match: MatchDef | null;
  remainingSeconds: number | null;
  onControl: (action: TournamentShowAction) => void;
  onReset: () => void;
}

export function ShowControlPanel({
  show,
  match,
  remainingSeconds,
  onControl,
  onReset,
}: ShowControlPanelProps) {
  const operatorHeld = show.holds.includes("operator");
  const timedPhase = TIMED_PHASES.has(show.phase);
  const displayedSeconds =
    remainingSeconds ??
    (show.heldRemainingMs === null ? null : Math.max(0, Math.ceil(show.heldRemainingMs / 1_000)));

  const confirmReset = () => {
    if (window.confirm("Turnier wirklich zurücksetzen? Die Bot-Registry bleibt erhalten.")) {
      onReset();
    }
  };

  return (
    <section className="show-control-panel" aria-label="Show-Steuerung" data-phase={show.phase}>
      <div className="show-control-panel__overview">
        <span>Aktuelle Phase</span>
        <h2>{PHASE_LABELS[show.phase]}</h2>
        {displayedSeconds !== null && (
          <strong className="show-control-panel__timer">{displayedSeconds}s</strong>
        )}
      </div>

      <div className="show-control-panel__match">
        <span>{show.phase === "ready" ? "Nächstes Match" : "Aktuelles Match"}</span>
        <strong>
          {match
            ? match.participants.map((participant) => participant.name).join(" vs ")
            : "Wird bestimmt"}
        </strong>
      </div>

      {!show.presentReady && (
        <p className="show-control-panel__warning" role="status">
          Present-Ansicht ist nicht bereit. Der automatische Ablauf wartet sicher.
        </p>
      )}

      <div className="show-control-panel__actions">
        {show.phase === "ready" && (
          <button type="button" onClick={() => onControl("start")}>
            Show starten
          </button>
        )}
        {timedPhase && operatorHeld && (
          <button type="button" onClick={() => onControl("resume")}>
            Fortsetzen
          </button>
        )}
        {timedPhase && !operatorHeld && (
          <button type="button" onClick={() => onControl("pause")}>
            Pause
          </button>
        )}
        {timedPhase && (
          <button type="button" onClick={() => onControl("advance")}>
            Sofort weiter
          </button>
        )}
      </div>

      <div className="show-control-panel__danger">
        <span>Danger Zone</span>
        <button type="button" onClick={confirmReset}>
          Turnier zurücksetzen
        </button>
      </div>
    </section>
  );
}
