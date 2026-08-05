/**
 * Finish-Overlay für den /dev-Testlauf: legt sich über das Spielbild, sobald
 * der Lauf beendet ist (Ziel erreicht oder DNF/Zeitlimit), und zeigt die
 * Score-Aufschlüsselung + einen "Neu starten"-Button.
 *
 * NUR für /dev gedacht (Debugging/Feedback) – nicht Teil der Turnier-Wertung.
 */
import type { RacerRuntimeState } from "../game/rules/racerState";
import { SCORING, computeScore, computeTimeBonus, computeTimeMultiplier } from "../game/scoring";

function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

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

  const multiplier = computeTimeMultiplier(racer.timeElapsedMs);
  const flatBonus = Math.round(computeTimeBonus(racer.timeElapsedMs));
  const deathPenalty = racer.deaths * SCORING.DEATH_PENALTY;

  return (
    <div className="pixel-overlay">
      <div className="pixel-overlay__card">
        <h2 className={`pixel-overlay__title ${reachedGoal ? "is-win" : "is-fail"}`}>
          {reachedGoal ? "★ ZIEL ERREICHT ★" : "✖ NICHT INS ZIEL ✖"}
        </h2>

        <div className="pixel-overlay__score">{finalScore}</div>
        <div className="pixel-overlay__score-label">Punkte</div>

        <div className="pixel-overlay__rows">
          <div className="pixel-overlay__row">
            <span>🍒 Früchte</span>
            <span>{racer.fruitScore}</span>
          </div>
          {reachedGoal ? (
            <>
              <div className="pixel-overlay__row">
                <span>⚡ Zeit-Multiplikator</span>
                <span>×{multiplier.toFixed(2)}</span>
              </div>
              <div className="pixel-overlay__row">
                <span>➕ Flat-Bonus</span>
                <span>+{flatBonus}</span>
              </div>
            </>
          ) : (
            <div className="pixel-overlay__row is-penalty">
              <span>🚫 DNF-Strafe</span>
              <span>−{SCORING.DNF_PENALTY}</span>
            </div>
          )}
          {racer.deaths > 0 && (
            <div className="pixel-overlay__row is-penalty">
              <span>💀 Tode ({racer.deaths})</span>
              <span>−{deathPenalty}</span>
            </div>
          )}
          <div className="pixel-overlay__row">
            <span>⏱ Zeit</span>
            <span>{formatSeconds(racer.timeElapsedMs)}</span>
          </div>
        </div>

        <button type="button" className="pixel-btn pixel-btn--accent" onClick={onRestart}>
          ↻ Neu starten
        </button>
      </div>
    </div>
  );
}
