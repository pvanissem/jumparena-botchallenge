import type Phaser from "phaser";
import { FRUIT_VALUES, type FruitKind } from "../level/types";
import { AUDIO_SPECS } from "./audio";
import {
  BACKGROUND,
  FRUIT_FRAME,
  fruitSheetPath,
  SHEET_SPECS,
  STATIC_IMAGE_SPECS,
} from "./spriteSheets";

/**
 * Stellt alle Arena-Assets in die Ladewarteschlange einer Szene – jeweils nur,
 * wenn sie nicht bereits im Cache liegen.
 *
 * Hintergrund: Im Turniermodus laufen mehrere `RaceScene`-Instanzen im SELBEN
 * Phaser-Game und teilen sich Textur-/Audio-Cache. Ohne die Existenzprüfung
 * meldet Phaser für jede weitere Instanz `Texture key already in use`.
 * Damit die Prüfung greift, lädt `MatchBootScene` die Assets EINMAL vorab –
 * die Racer-Szenen finden sie dann bereits im Cache vor.
 */
export function preloadArenaAssets(scene: Phaser.Scene): void {
  if (!scene.textures.exists(BACKGROUND.key)) {
    scene.load.image(BACKGROUND.key, BACKGROUND.path);
  }

  for (const spec of SHEET_SPECS) {
    if (scene.textures.exists(spec.key)) continue;
    scene.load.spritesheet(spec.key, spec.path, {
      frameWidth: spec.frameWidth,
      frameHeight: spec.frameHeight,
    });
  }

  for (const spec of STATIC_IMAGE_SPECS) {
    if (scene.textures.exists(spec.key)) continue;
    scene.load.image(spec.key, spec.path);
  }

  for (const fruit of Object.keys(FRUIT_VALUES) as FruitKind[]) {
    const key = `fruit-${fruit}`;
    if (scene.textures.exists(key)) continue;
    scene.load.spritesheet(key, fruitSheetPath(fruit), {
      frameWidth: FRUIT_FRAME.width,
      frameHeight: FRUIT_FRAME.height,
    });
  }

  for (const spec of AUDIO_SPECS) {
    if (scene.cache.audio.exists(spec.key)) continue;
    scene.load.audio(spec.key, spec.path);
  }
}
