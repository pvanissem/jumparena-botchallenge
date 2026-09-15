/**
 * `/dev` – Entwickler-Ansicht der Arena: mit Level-Auswahl und Phasers
 * Arcade-Debug-Overlay. Die eigentliche Seite steckt in `ArenaPage`
 * (siehe `.features/code-station-page/`).
 */
import { ArenaPage } from "./ArenaPage";

export function DevPage() {
  return <ArenaPage showLevelSelect physicsDebug />;
}
