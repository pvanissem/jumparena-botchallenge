import { computeScore } from "../game/scoring";
import type { TileOverlayDescriptor } from "../match/tileOverlays";
import { ScoreBreakdown } from "./ScoreBreakdown";

const TITLES: Record<
  TileOverlayDescriptor["outcome"]["kind"],
  { text: string; className: string }
> = {
  goal: { text: "★ ZIEL ERREICHT ★", className: "is-win" },
  "out-of-lives": { text: "✖ LEBEN VERBRAUCHT ✖", className: "is-fail" },
  "time-limit": { text: "✖ ZEIT ABGELAUFEN ✖", className: "is-fail" },
  disabled: { text: "⏸ BOT PAUSIERT ⏸", className: "is-fail" },
};

export function RacerTileOverlay({ descriptor }: { descriptor: TileOverlayDescriptor }) {
  const { name, outcome, racer, isWinner, viewport } = descriptor;
  const title = TITLES[outcome.kind];
  const finalScore = computeScore({
    fruitScore: racer.fruitScore,
    timeElapsedMs: racer.timeElapsedMs,
    deaths: racer.deaths,
    reachedGoal: outcome.reachedGoal,
  });

  return (
    <div
      className={`pixel-overlay pixel-overlay--tile ${isWinner ? "pixel-overlay--winner" : ""}`}
      style={{
        left: viewport.x,
        top: viewport.y,
        width: viewport.width,
        height: viewport.height,
      }}
    >
      <div className={`pixel-overlay__card ${isWinner ? "pixel-overlay__card--winner" : ""}`}>
        {isWinner && <div className="pixel-overlay__winner-badge">👑 SIEGER</div>}
        <div className="pixel-overlay__bot-name">{name}</div>
        <h2 className={`pixel-overlay__title ${title.className}`}>{title.text}</h2>
        <div className="pixel-overlay__score">{finalScore}</div>
        <div className="pixel-overlay__score-label">Punkte</div>
        <ScoreBreakdown racer={racer} />
      </div>
    </div>
  );
}
