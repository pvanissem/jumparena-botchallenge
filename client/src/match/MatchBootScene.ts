import Phaser from "phaser";
import { preloadArenaAssets } from "../game/assets/preloadArenaAssets";

export const MATCH_BOOT_SCENE_KEY = "match-boot";
/** Wird auf `game.events` gefeuert, sobald alle Arena-Assets geladen sind. */
export const MATCH_ASSETS_READY = "match-assets-ready";

/**
 * Lädt einmalig alle Arena-Assets des gesamten Matches.
 *
 * Warum eine eigene Boot-Szene:
 * 1. Würden die vier Racer-Szenen gleichzeitig starten, würde jede dieselben
 *    Assets in die Ladewarteschlange stellen (die Existenzprüfung greift nicht,
 *    solange parallel geladen wird) – Phaser meldet dann massenhaft
 *    `Texture key already in use`.
 * Die Turniermusik lebt unabhängig davon in `TournamentMusicScene`, damit sie
 * beim Wechsel zwischen Match und Intermission nicht abreißt.
 */
export class MatchBootScene extends Phaser.Scene {
  assetsReady = false;

  constructor() {
    super(MATCH_BOOT_SCENE_KEY);
  }

  preload(): void {
    preloadArenaAssets(this);
  }

  create(): void {
    this.assetsReady = true;
    this.game.events.emit(MATCH_ASSETS_READY);
  }
}
