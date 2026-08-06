/**
 * Erstellt alle Animationen einmalig (`scene.anims` ist szenenübergreifend
 * gecacht, `anims.exists` verhindert Doppel-Erzeugung bei Szenen-Neustart).
 * Angelehnt an `coin-quest-arena-tmp/src/game/assets/animations.ts`.
 */
import type Phaser from "phaser";
import type { FruitKind } from "../level/types";
import { FRUIT_FRAME, fruitAnimKey, fruitTextureKey, SheetKeys } from "./spriteSheets";

const ALL_FRUITS: readonly FruitKind[] = [
  "cherries",
  "strawberry",
  "orange",
  "apple",
  "bananas",
  "kiwi",
  "melon",
  "pineapple",
];

export function createAnimations(scene: Phaser.Scene): void {
  const anims = scene.anims;

  const define = (key: string, sheet: string, endFrame: number, frameRate: number, repeat = -1) => {
    if (anims.exists(key)) return;
    anims.create({
      key,
      frames: anims.generateFrameNumbers(sheet, { start: 0, end: endFrame }),
      frameRate,
      repeat,
    });
  };

  // --- Player ---
  define("player-idle", SheetKeys.PLAYER_IDLE, 10, 20);
  define("player-run", SheetKeys.PLAYER_RUN, 11, 20);
  define("player-jump", SheetKeys.PLAYER_JUMP, 0, 1);
  define("player-fall", SheetKeys.PLAYER_FALL, 0, 1);
  define("player-hit", SheetKeys.PLAYER_HIT, 6, 20, 0);

  // --- Schnetzler (Säge) ---
  define("saw-spin", SheetKeys.SAW, 7, 24);

  // --- Ninja-Frog (patrouillierender, stompbarer NPC): 12 Lauf-Frames ---
  define("ninjafrog-run", SheetKeys.NINJAFROG_RUN, 11, 20);

  // --- Loderix (Feuer): nur "an"-Zustand animiert, "aus" ist ein Einzelbild ---
  define("loderix-on", SheetKeys.FIRE_ON, 2, 14);

  // --- Boingo (Trampolin): einmaliger Bounce ---
  define("boingo-jump", SheetKeys.TRAMPOLINE_JUMP, 7, 30, 0);

  // --- Ziel-Flagge ---
  define("goal-idle", SheetKeys.GOAL_IDLE, 0, 1);
  define("goal-pressed", SheetKeys.GOAL_PRESSED, 7, 18, 0);

  // --- Checkpoint-Flagge: einmaliges Hissen (26 Frames), danach winkend (10 Frames) ---
  define("checkpoint-activate", SheetKeys.CHECKPOINT_ACTIVATE, 25, 24, 0);
  define("checkpoint-idle", SheetKeys.CHECKPOINT_IDLE, 9, 10);

  // --- Münzblock: kurzer "angestoßen"-Ruckler, danach zurück zu Idle-Textur ---
  define("block-hit", SheetKeys.BLOCK_HIT, 2, 20, 0);

  // --- Pickup-Popeffekt ---
  define("fruit-collected", SheetKeys.FRUIT_COLLECTED, 5, 24, 0);

  // --- "Puff", wenn ein gestompter Gegner verschwindet (einmalig, 7 Frames) ---
  define("disappearing", SheetKeys.DISAPPEARING, 6, 20, 0);

  // --- Frucht-Idle-Rotationen ---
  for (const fruit of ALL_FRUITS) {
    define(fruitAnimKey(fruit), fruitTextureKey(fruit), FRUIT_FRAME.frameCount - 1, 20);
  }
}
