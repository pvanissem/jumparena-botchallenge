/**
 * Overlay + HUD EINER Spielstation – siehe `.features/play-mode/design.md`,
 * Abschnitt "Seite & UI" (US-7). Liegt als absolut positionierte Hälfte über
 * dem gemeinsamen Canvas (Muster: `match-view__overlays`/`RacerTileOverlay`).
 *
 * Reine Darstellung: keine Eingabeverarbeitung, keine Spielregeln.
 */
import { LEVEL_REGISTRY } from "../game/level/levelRegistry";
import type { RacerRuntimeState } from "../game/rules/racerState";
import { RUN_TIME_LIMIT_MS } from "../game/rules/racerState";
import { STATION_SHORT_LABELS, type StationId } from "./input/inputs";
import { NAME_LENGTH } from "./nameEntry";
import {
  COUNTDOWN_MS,
  currentLevelId,
  levelsCompleted,
  PLAY_LEVEL_IDS,
  type StationState,
} from "./station";

interface StationOverlayProps {
  stationId: StationId;
  state: StationState;
  /** Live-Zustand der laufenden Szene (null außerhalb eines Levels). */
  racer: RacerRuntimeState | null;
}

function levelLabel(levelId: string): string {
  return LEVEL_REGISTRY.find((entry) => entry.id === levelId)?.label ?? levelId;
}

function formatSeconds(ms: number): string {
  return Math.max(0, Math.ceil(ms / 1000)).toString();
}

export function StationOverlay({ stationId, state, racer }: StationOverlayProps) {
  const levelNumber = state.levelIndex + 1;
  const lives = racer?.livesRemaining ?? state.livesRemaining;
  const remainingMs = RUN_TIME_LIMIT_MS - (racer?.timeElapsedMs ?? 0);
  const timeFraction = Math.max(0, Math.min(1, remainingMs / RUN_TIME_LIMIT_MS));
  const inLevel = state.phase === "playing" || state.phase === "disconnected";
  const lastResult = state.results[state.results.length - 1];

  return (
    <div className={`play-station play-station--${stationId}`} data-phase={state.phase}>
      {inLevel && (
        <header className="play-hud" data-testid="station-hud">
          <div className="play-hud__row">
            <span className="play-hud__name">{state.name}</span>
            <span className="play-hud__lives" data-testid="station-lives">
              {"❤️".repeat(Math.max(0, Math.min(9, lives)))}
            </span>
          </div>
          <div className="play-hud__row">
            <span className="play-hud__level">
              {levelNumber}/{PLAY_LEVEL_IDS.length} · {levelLabel(currentLevelId(state))}
            </span>
            <span className="play-hud__score">
              <span data-testid="station-level-score">+{racer?.fruitScore ?? 0}</span>
              <strong>{state.totalScore}</strong>
            </span>
          </div>
          <div className="play-hud__time" data-testid="station-time">
            <div className="play-hud__time-bar" style={{ width: `${timeFraction * 100}%` }} />
            <span className="play-hud__time-label">{formatSeconds(remainingMs)}s</span>
          </div>
          <p className="play-hud__legend" data-testid="station-legend">
            ⬅➡ Laufen · SPRUNG springen · SPRINT rennen · ZURÜCK beenden
          </p>
        </header>
      )}

      {state.phase === "attract" && (
        <div className="play-overlay play-overlay--attract">
          <p className="play-overlay__eyebrow">{STATION_SHORT_LABELS[stationId]}</p>
          <h2 className="play-overlay__title">Taste drücken zum Starten</h2>
          <p className="play-overlay__hint">
            {PLAY_LEVEL_IDS.length} Level · {state.livesRemaining} Leben · Bestenliste
          </p>
        </div>
      )}

      {state.phase === "name-entry" && (
        <div className="play-overlay play-overlay--name">
          <h2 className="play-overlay__title">Wie heißt du?</h2>
          <ol className="play-name">
            {Array.from({ length: NAME_LENGTH }, (_, slot) => (
              <li
                // biome-ignore lint/suspicious/noArrayIndexKey: feste Anzahl Plätze, Position IST die Identität
                key={slot}
                data-testid={`name-slot-${slot}`}
                data-cursor={state.nameEntry.cursor === slot ? "true" : "false"}
                className={`play-name__slot${state.nameEntry.cursor === slot ? " is-cursor" : ""}`}
              >
                {state.nameEntry.chars[slot] === " " ? "_" : state.nameEntry.chars[slot]}
              </li>
            ))}
          </ol>
          <p className="play-overlay__hint">
            ⬆⬇ Buchstabe · ⬅➡ Position · BESTÄTIGEN übernehmen · ZURÜCK abbrechen
          </p>
        </div>
      )}

      {state.phase === "countdown" && (
        <div className="play-overlay play-overlay--countdown" data-testid="station-level-intro">
          <p className="play-overlay__eyebrow">Level {levelNumber}</p>
          <h2 className="play-overlay__title">{levelLabel(currentLevelId(state))}</h2>
          <p className="play-overlay__countdown">
            {Math.max(1, Math.ceil((COUNTDOWN_MS - state.phaseElapsedMs) / 1000))}
          </p>
        </div>
      )}

      {state.phase === "level-result" && lastResult && (
        <div className="play-overlay play-overlay--result" data-testid="station-level-result">
          <p className="play-overlay__eyebrow">
            {lastResult.reachedGoal ? "Ziel erreicht!" : "Zeit abgelaufen – nicht geschafft"}
          </p>
          <h2 className="play-overlay__title">{lastResult.score} Punkte</h2>
          <p className="play-overlay__hint">
            Gesamt {state.totalScore} · {lastResult.livesRemaining} Leben übrig
          </p>
        </div>
      )}

      {state.phase === "game-over" && (
        <div className="play-overlay play-overlay--gameover" data-testid="station-game-over">
          <p className="play-overlay__eyebrow">Game Over</p>
          <h2 className="play-overlay__title">{state.name}</h2>
          <p className="play-overlay__score">{state.totalScore} Punkte</p>
          <p className="play-overlay__hint">
            {levelsCompleted(state)} von {PLAY_LEVEL_IDS.length} Leveln geschafft
          </p>
          {state.rank !== null && (
            <p className="play-overlay__rank">🏆 Platz {state.rank} der Bestenliste!</p>
          )}
          <p className="play-overlay__hint">BESTÄTIGEN drücken für ein neues Spiel</p>
        </div>
      )}

      {state.phase === "disconnected" && (
        <div className="play-overlay play-overlay--disconnected">
          <h2 className="play-overlay__title">Controller getrennt</h2>
          <p className="play-overlay__hint">Bitte wieder einstecken – das Spiel wartet.</p>
        </div>
      )}
    </div>
  );
}
