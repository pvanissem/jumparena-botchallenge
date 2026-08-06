import type { CSSProperties } from "react";
import type { LegendEntry } from "../game/assets/legend";
import { LEGEND_ENTRIES } from "../game/assets/legend";

/** Kantenlänge der Vorschau-Box (px); Sprites werden darin zentriert skaliert. */
const PREVIEW_BOX = 40;

/**
 * Spritesheets dürfen nicht als Ganzes angezeigt werden (sonst stünden alle
 * Frames nebeneinander) – deshalb wird die Box exakt auf Frame-Größe gesetzt,
 * an Position 0/0 verankert und anschließend hochskaliert. Echte Einzelbilder
 * (`frameWidth === null`) werden einfach in die Box eingepasst.
 */
function previewStyle(entry: LegendEntry): CSSProperties {
  const { url, frameWidth, frameHeight } = entry.preview;
  if (frameWidth === null || frameHeight === null) {
    return {
      width: PREVIEW_BOX,
      height: PREVIEW_BOX,
      backgroundImage: `url("${url}")`,
      backgroundRepeat: "no-repeat",
      backgroundPosition: "center",
      backgroundSize: "contain",
    };
  }
  const scale = PREVIEW_BOX / Math.max(frameWidth, frameHeight);
  return {
    width: frameWidth,
    height: frameHeight,
    backgroundImage: `url("${url}")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "0 0",
    transform: `scale(${scale})`,
  };
}

/**
 * Legende unter dem Spielbereich (/dev): zeigt jedes Hazard/Utility mit seinem
 * echten Spiel-Asset und Namen, damit im Gespräch am Stand klar ist, welches
 * Ding wie heißt. Datenquelle ist `game/assets/legend.ts` (aus den Registries
 * abgeleitet, siehe dort).
 */
export function HazardLegend() {
  return (
    <section className="pixel-legend" aria-label="Legende der Hindernisse">
      <h2 className="pixel-legend__title">Legende</h2>
      <ul className="pixel-legend__list">
        {LEGEND_ENTRIES.map((entry) => (
          <li key={entry.kind} className="pixel-legend__item">
            <div className="pixel-legend__preview">
              <div role="img" aria-label={entry.label} style={previewStyle(entry)} />
            </div>
            <div className="pixel-legend__text">
              <span className="pixel-legend__name">
                {entry.label}
                {entry.stompable === true && (
                  <span className="pixel-legend__badge" title="Von oben stompbar">
                    STOMP
                  </span>
                )}
              </span>
              <span className="pixel-legend__desc">{entry.description}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
