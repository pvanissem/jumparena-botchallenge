import type { RacerRuntimeState } from "../game/rules/racerState";
import { computeTimeBonus, computeTimeMultiplier, SCORING } from "../game/scoring";

function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

interface ScoreBreakdownProps {
  racer: RacerRuntimeState;
}

/**
 * Score-Aufschlüsselung, die von `/dev` (`FinishOverlay`) und `/present`
 * (`RacerTileOverlay`) gemeinsam genutzt wird (DRY).
 */
export function ScoreBreakdown({ racer }: ScoreBreakdownProps) {
  const reachedGoal = racer.finished;
  const multiplier = computeTimeMultiplier(racer.timeElapsedMs);
  const flatBonus = Math.round(computeTimeBonus(racer.timeElapsedMs));
  const deathPenalty = racer.deaths * SCORING.DEATH_PENALTY;

  return (
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
  );
}
