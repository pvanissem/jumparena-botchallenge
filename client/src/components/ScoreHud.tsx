/**
 * Live-HUD für den /dev-Testlauf: zeigt den aktuellen Punktestand
 * (`fruitScore`), Leben, verbleibende Zeit bis zum Zeitlimit und den gerade
 * erreichbaren Zeitbonus. Ein Info-Popup (Hover) erklärt die Scoring-Formel.
 *
 * Bewusst NUR Anzeige – die Score-Logik lebt in `game/scoring.ts`
 * (Single Source of Truth), diese Komponente rechnet nicht selbst.
 */
import type { RacerRuntimeState } from "../game/rules/racerState";
import { RUN_TIME_LIMIT_MS } from "../game/rules/racerState";
import { computeTimeBonus, computeTimeMultiplier, SCORING } from "../game/scoring";

function formatLives(livesRemaining: number): string {
  return Number.isFinite(livesRemaining) ? String(livesRemaining) : "∞";
}

function formatSeconds(ms: number): string {
  return `${Math.max(0, Math.ceil(ms / 1000))}s`;
}

export function ScoreHud({ racer }: { racer: RacerRuntimeState }) {
  const timeRemainingMs = RUN_TIME_LIMIT_MS - racer.timeElapsedMs;
  const multiplier = computeTimeMultiplier(racer.timeElapsedMs);
  const flatBonus = computeTimeBonus(racer.timeElapsedMs);
  const bonusActive = multiplier > 1 || flatBonus > 0;
  // Live-Projektion des Scores, als würde der Bot jetzt das Ziel erreichen
  // (Früchte × Zeit-Multiplikator + Flat-Bonus − Todesstrafe). Rein informativ.
  const projected = Math.round(
    racer.fruitScore * multiplier + flatBonus - racer.deaths * SCORING.DEATH_PENALTY
  );

  return (
    <div className="pixel-hud pixel-hud--score">
      <span title="Eingesammelte Frucht-Punkte">🍒 {racer.fruitScore}</span>
      <span title="Verbleibende Leben">❤️ {formatLives(racer.livesRemaining)}</span>
      <span title="Restzeit bis zum Zeitlimit">⏱ {formatSeconds(timeRemainingMs)}</span>
      <span
        className={bonusActive ? "pixel-hud__bonus pixel-hud__bonus--on" : "pixel-hud__bonus"}
        title="Zeit-Multiplikator auf die Früchtepunkte (+ kleiner Flat-Bonus) bei sofortigem Finish"
      >
        ⚡ ×{multiplier.toFixed(2)}
        {flatBonus > 0 ? ` +${Math.round(flatBonus)}` : ""}
      </span>

      <span className="pixel-info" tabIndex={0} aria-label="Wie funktioniert das Scoring?">
        ℹ
        <span className="pixel-info__pop" role="tooltip">
          <span className="pixel-info__title">▶ So zählt der Score</span>
          <span className="pixel-info__row">
            🍒 <b>Früchte</b> – jede Frucht bringt Punkte (5–25 je nach Sorte).
          </span>
          <span className="pixel-info__row">
            ⚡ <b>Zeit-Multiplikator</b> – multipliziert die Früchtepunkte: bis ×
            {(1 + SCORING.TIME_MULTIPLIER_MAX_BONUS).toFixed(2)} bei sofortigem Finish, linear
            fallend auf ×1.00 nach {SCORING.TIME_BUDGET_MS / 1000}s.
          </span>
          <span className="pixel-info__row">
            ➕ <b>Flat-Bonus</b> – kleiner Zusatz obendrauf, ebenfalls je schneller desto mehr.
          </span>
          <span className="pixel-info__row">
            ⏱ <b>Zeitlimit</b> {RUN_TIME_LIMIT_MS / 1000}s – danach: kein Finish (DNF, −
            {SCORING.DNF_PENALTY}).
          </span>
          <span className="pixel-info__row">
            💀 <b>Tod</b> – jeder Tod kostet −{SCORING.DEATH_PENALTY} Punkte.
          </span>
          <span className="pixel-info__total">
            ≈ Score bei Finish jetzt: <b>{projected}</b>
          </span>
        </span>
      </span>
    </div>
  );
}
