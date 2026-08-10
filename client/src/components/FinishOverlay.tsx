/**
 * Finish-Overlay für den /dev-Testlauf: legt sich über das Spielbild, sobald
 * der Lauf beendet ist (Ziel erreicht oder DNF/Zeitlimit), und zeigt die
 * Score-Aufschlüsselung + einen "Neu starten"-Button.
 *
 * NUR für /dev gedacht (Debugging/Feedback) – nicht Teil der Turnier-Wertung.
 */
import type { RacerRuntimeState } from "../game/rules/racerState";
import { computeScore } from "../game/scoring";
import { ScoreBreakdown } from "./ScoreBreakdown";

export function FinishOverlay({
  racer,
  onRestart,
}: {
  racer: RacerRuntimeState;
  onRestart: () => void;
}) {
  const reachedGoal = racer.finished;
  const finalScore = computeScore({
    fruitScore: racer.fruitScore,
    timeElapsedMs: racer.timeElapsedMs,
    deaths: racer.deaths,
    reachedGoal,
  });

  return (
    <div className="pixel-overlay">
      <div className="pixel-overlay__card">
        <h2 className={`pixel-overlay__title ${reachedGoal ? "is-win" : "is-fail"}`}>
          {reachedGoal ? "★ ZIEL ERREICHT ★" : "✖ NICHT INS ZIEL ✖"}
        </h2>

        <div className="pixel-overlay__score">{finalScore}</div>
        <div className="pixel-overlay__score-label">Punkte</div>

        <ScoreBreakdown racer={racer} />

        <button type="button" className="pixel-btn pixel-btn--accent" onClick={onRestart}>
          ↻ Neu starten
        </button>
      </div>
    </div>
  );
}
