/**
 * Verwaltet die Phaser-Szenen der beiden Spielstationen – siehe
 * `.features/play-mode/design.md`, Abschnitt "Phaser-Host" (US-4, US-5).
 *
 * Gleiches Muster wie `client/src/match/MatchRunner.ts` (mehrere `RaceScene`-
 * Instanzen mit eigenem Viewport in EINEM Phaser-Game), nur je Station statt
 * je Match-Teilnehmer. Jede Station hat genau eine Szene zur Zeit; ein
 * Levelwechsel tauscht ausschließlich die Szene DIESER Station aus, damit die
 * andere Station ungestört weiterläuft.
 */
import type Phaser from "phaser";
import type { HumanInputSource } from "../game/control/RacerController";
import type { RacerRuntimeState } from "../game/rules/racerState";
import { RaceScene, type RaceSceneInitData } from "../game/scenes/RaceScene";
import { computeGridViewports, type ViewportRect } from "../match/gridViewports";
import { STATION_IDS, type StationId } from "./input/inputs";
import { PLAY_ASSETS_READY, PLAY_BOOT_SCENE_KEY } from "./playBootKeys";

export interface StationLevelOptions {
  stationId: StationId;
  levelId: string;
  /** Verbleibende Leben des laufenden Runs – NICHT pro Level aufgefrischt. */
  startingLives: number;
  humanInput: HumanInputSource;
  onStatusChange: (status: { racer: RacerRuntimeState }) => void;
}

function sceneKeyFor(stationId: StationId): string {
  return `play-${stationId}`;
}

export class StationSceneHost {
  private readonly activeKeys = new Map<StationId, string>();
  /** Starts, die auf das Laden der Assets warten (siehe `startLevel`). */
  private readonly pending = new Map<StationId, StationLevelOptions>();
  private destroyed = false;

  constructor(private readonly game: Phaser.Game) {}

  /** Viewport-Hälfte dieser Station im gemeinsamen Canvas. */
  private viewportFor(stationId: StationId): ViewportRect {
    const viewports = computeGridViewports(2, this.game.canvas.width, this.game.canvas.height);
    return viewports[STATION_IDS.indexOf(stationId)];
  }

  startLevel(options: StationLevelOptions): void {
    if (this.destroyed) return;

    // Vorheriges Level derselben Station sauber beenden (Levelwechsel oder
    // Neustart) – die andere Station wird dabei nicht angefasst.
    this.stopLevel(options.stationId);

    // Die Racer-Szenen laufen mit `assetsPreloaded: true` und überspringen
    // ihr eigenes `preload()`. Startet eine Station, bevor `PlayBootScene`
    // fertig geladen hat, fehlen die Texturen – deshalb hier warten
    // (gleiches Muster wie `MatchRunner`).
    const boot = this.game.scene.getScene(PLAY_BOOT_SCENE_KEY) as { assetsReady?: boolean } | null;
    if (!boot?.assetsReady) {
      this.pending.set(options.stationId, options);
      this.game.events.once(PLAY_ASSETS_READY, () => this.startPending());
      return;
    }

    this.launch(options);
  }

  /** Holt die Starts nach, die auf die Assets gewartet haben. */
  private startPending(): void {
    if (this.destroyed) return;

    for (const options of [...this.pending.values()]) {
      this.pending.delete(options.stationId);
      this.launch(options);
    }
  }

  private launch(options: StationLevelOptions): void {
    const key = sceneKeyFor(options.stationId);
    const initData: RaceSceneInitData = {
      controllerMode: "gamepad",
      humanInput: options.humanInput,
      levelId: options.levelId,
      startingLives: options.startingLives,
      viewport: this.viewportFor(options.stationId),
      // Musik läuft zentral in `PlayBootScene` (sonst doppelt, siehe US-5);
      // Soundeffekte sollen beide Stationen hören.
      audio: { music: false, sfx: true },
      assetsPreloaded: true,
      onStatusChange: (status) => options.onStatusChange({ racer: status.racer }),
    };

    this.game.scene.add(key, new RaceScene(key), true, initData);
    this.activeKeys.set(options.stationId, key);
  }

  stopLevel(stationId: StationId): void {
    // Auch einen noch wartenden Start verwerfen – sonst startete die Szene
    // nachträglich, obwohl die Station längst beendet wurde.
    this.pending.delete(stationId);

    const key = this.activeKeys.get(stationId);
    if (!key) return;

    const scene = this.game.scene.getScene(key) as RaceScene | null;
    scene?.shutdown?.();
    this.game.scene.remove(key);
    this.activeKeys.delete(stationId);
  }

  /** Hält das Level einer Station an (z.B. Gamepad-Verlust, US-3). */
  pause(stationId: StationId): void {
    const key = this.activeKeys.get(stationId);
    if (key) this.game.scene.pause(key);
  }

  resume(stationId: StationId): void {
    const key = this.activeKeys.get(stationId);
    if (key) this.game.scene.resume(key);
  }

  destroy(): void {
    for (const stationId of [...this.activeKeys.keys()]) {
      this.stopLevel(stationId);
    }
    this.pending.clear();
    this.destroyed = true;
  }
}
