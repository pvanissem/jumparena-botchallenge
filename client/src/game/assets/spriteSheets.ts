/**
 * Definition aller animierten Spritesheets: Ladepfade, Frame-Größen und
 * Textur-Keys – zentral hier, damit `RaceScene.preload()` nur noch iteriert
 * und `assets/animations.ts` nur noch Animationen daraus erzeugt. Angelehnt
 * an `coin-quest-arena-tmp/src/game/assets/spriteSheets.ts`.
 */
import type { FruitKind } from "../level/types";

const BASE = "assets";
const CHARACTER = "Main Characters/Mask Dude";

/** Textur-Keys für Spritesheets (getrennt von reinen Einzelbild-Keys). */
export const SheetKeys = {
  PLAYER_IDLE: "player-idle",
  PLAYER_RUN: "player-run",
  PLAYER_JUMP: "player-jump",
  PLAYER_FALL: "player-fall",
  PLAYER_HIT: "player-hit",

  TERRAIN: "terrain",

  SAW: "saw",
  FIRE_ON: "fire-on",
  TRAMPOLINE_JUMP: "trampoline-jump",

  GOAL_IDLE: "goal-idle",
  GOAL_PRESSED: "goal-pressed",

  CHECKPOINT_IDLE: "checkpoint-idle",
  CHECKPOINT_ACTIVATE: "checkpoint-activate",

  BLOCK_HIT: "block-hit",

  FRUIT_COLLECTED: "fruit-collected",
} as const;

export interface SheetSpec {
  key: string;
  path: string;
  frameWidth: number;
  frameHeight: number;
}

export const SHEET_SPECS: readonly SheetSpec[] = [
  {
    key: SheetKeys.PLAYER_IDLE,
    path: `${BASE}/${CHARACTER}/Idle (32x32).png`,
    frameWidth: 32,
    frameHeight: 32,
  },
  {
    key: SheetKeys.PLAYER_RUN,
    path: `${BASE}/${CHARACTER}/Run (32x32).png`,
    frameWidth: 32,
    frameHeight: 32,
  },
  {
    key: SheetKeys.PLAYER_JUMP,
    path: `${BASE}/${CHARACTER}/Jump (32x32).png`,
    frameWidth: 32,
    frameHeight: 32,
  },
  {
    key: SheetKeys.PLAYER_FALL,
    path: `${BASE}/${CHARACTER}/Fall (32x32).png`,
    frameWidth: 32,
    frameHeight: 32,
  },
  {
    key: SheetKeys.PLAYER_HIT,
    path: `${BASE}/${CHARACTER}/Hit (32x32).png`,
    frameWidth: 32,
    frameHeight: 32,
  },

  {
    key: SheetKeys.TERRAIN,
    path: `${BASE}/Terrain/Terrain (16x16).png`,
    frameWidth: 16,
    frameHeight: 16,
  },

  { key: SheetKeys.SAW, path: `${BASE}/Traps/Saw/On (38x38).png`, frameWidth: 38, frameHeight: 38 },
  {
    key: SheetKeys.FIRE_ON,
    path: `${BASE}/Traps/Fire/On (16x32).png`,
    frameWidth: 16,
    frameHeight: 32,
  },
  {
    key: SheetKeys.TRAMPOLINE_JUMP,
    path: `${BASE}/Traps/Trampoline/Jump (28x28).png`,
    frameWidth: 28,
    frameHeight: 28,
  },

  {
    key: SheetKeys.GOAL_IDLE,
    path: `${BASE}/Items/Checkpoints/End/End (Idle).png`,
    frameWidth: 64,
    frameHeight: 64,
  },
  {
    key: SheetKeys.GOAL_PRESSED,
    path: `${BASE}/Items/Checkpoints/End/End (Pressed) (64x64).png`,
    frameWidth: 64,
    frameHeight: 64,
  },

  /**
   * WICHTIG: "Checkpoint (Flag Idle)(64x64).png" ist trotz des irreführenden
   * Dateinamens (der wie eine einzelne Bildgröße aussieht) tatsächlich ein
   * Spritesheet mit 10 Frames à 64x64 (640x64 Gesamtgröße) – eine
   * Fahnen-Wink-Animation. Als `load.image` geladen wurden früher alle 10
   * Frames nebeneinander als EIN Bild angezeigt ("viele Zielfahnen
   * nebeneinander"). Muss daher zwingend als Spritesheet geladen werden.
   */
  {
    key: SheetKeys.CHECKPOINT_IDLE,
    path: `${BASE}/Items/Checkpoints/Checkpoint/Checkpoint (Flag Idle)(64x64).png`,
    frameWidth: 64,
    frameHeight: 64,
  },

  /**
   * Einmalige Hiss-Animation beim Aktivieren eines Checkpoints (26 Frames),
   * danach wechselt das Sprite in die looped `checkpoint-idle`-Wink-Animation
   * (siehe `RaceScene.onCheckpointOverlap`). Vorher der reinen Idle-Textur
   * (`STATIC_IMAGE_KEYS.CHECKPOINT_POLE`, Fahnenstab ohne Fahne) fehlte diese
   * Zwischenstufe komplett.
   */
  {
    key: SheetKeys.CHECKPOINT_ACTIVATE,
    path: `${BASE}/Items/Checkpoints/Checkpoint/Checkpoint (Flag Out) (64x64).png`,
    frameWidth: 64,
    frameHeight: 64,
  },

  /**
   * Versteckte Münzblöcke: "Box1" aus dem Pixel-Adventure-Set (NICHT
   * `Checkpoint (No Flag).png` – das ist ein Fahnenstab ohne Fahne, kein
   * Block, siehe Chat-Verlauf). `Idle.png` ist ein einzelnes 28x24-Bild
   * (kein Spritesheet nötig, siehe `STATIC_IMAGE_SPECS`), `Hit (28x24).png`
   * ist ein 3-Frame-Spritesheet für die kurze "angestoßen"-Animation.
   */
  {
    key: SheetKeys.BLOCK_HIT,
    path: `${BASE}/Items/Boxes/Box1/Hit (28x24).png`,
    frameWidth: 28,
    frameHeight: 24,
  },

  {
    key: SheetKeys.FRUIT_COLLECTED,
    path: `${BASE}/Items/Fruits/Collected.png`,
    frameWidth: 32,
    frameHeight: 32,
  },
];

/** 17 Frames à 32x32 je Frucht-Spritesheet (Idle-Rotation). */
export const FRUIT_FRAME = { width: 32, height: 32, frameCount: 17 } as const;

const FRUIT_FILE_NAMES: Record<FruitKind, string> = {
  cherries: "Cherries",
  strawberry: "Strawberry",
  orange: "Orange",
  apple: "Apple",
  bananas: "Bananas",
  kiwi: "Kiwi",
  melon: "Melon",
  pineapple: "Pineapple",
};

export function fruitTextureKey(fruit: FruitKind): string {
  return `fruit-${fruit}`;
}

export function fruitAnimKey(fruit: FruitKind): string {
  return `${fruitTextureKey(fruit)}-idle`;
}

export function fruitSheetPath(fruit: FruitKind): string {
  return `${BASE}/Items/Fruits/${FRUIT_FILE_NAMES[fruit]}.png`;
}

/**
 * Terrain-Frame-Indizes (Tileset: 22 Spalten pro Reihe). Gras/Erd-Block liegt
 * bei Spalten 6-8, Reihen 0-1 (Ober-/Mittelkante), analog zum Prototyp.
 */
const TILESET_COLS = 22;
const tileIndex = (col: number, row: number) => row * TILESET_COLS + col;

export const TERRAIN_TILES = {
  topLeft: tileIndex(6, 0),
  topMid: tileIndex(7, 0),
  topRight: tileIndex(8, 0),
  midLeft: tileIndex(6, 1),
  midMid: tileIndex(7, 1),
  midRight: tileIndex(8, 1),
} as const;

export const BACKGROUND = { key: "background", path: `${BASE}/Background/Blue.png` } as const;

// --- Einzelbilder (echte Einzelbilder ohne mehrere Frames, per load.image geladen) ---
export const STATIC_IMAGE_KEYS = {
  SPIKES: "spikes",
  SPIKED_BALL: "spiked-ball",
  TRAMPOLINE_IDLE: "trampoline",
  BLOCK_IDLE: "block-idle",
  FIRE_OFF: "fire-off",
  /** Fahnenstab ohne Fahne – Ruhezustand eines noch nicht erreichten Checkpoints. */
  CHECKPOINT_POLE: "checkpoint-pole",
} as const;

export const STATIC_IMAGE_SPECS: ReadonlyArray<{ key: string; path: string }> = [
  { key: STATIC_IMAGE_KEYS.SPIKES, path: `${BASE}/Traps/Spikes/Idle.png` },
  { key: STATIC_IMAGE_KEYS.SPIKED_BALL, path: `${BASE}/Traps/Spiked Ball/Spiked Ball.png` },
  { key: STATIC_IMAGE_KEYS.TRAMPOLINE_IDLE, path: `${BASE}/Traps/Trampoline/Idle.png` },
  { key: STATIC_IMAGE_KEYS.BLOCK_IDLE, path: `${BASE}/Items/Boxes/Box1/Idle.png` },
  // Erloschenes Feuer (Loderix im "Aus"-Zustand) – vorher fälschlich einfach
  // unsichtbar geschaltet, siehe hazards/factory.ts.
  { key: STATIC_IMAGE_KEYS.FIRE_OFF, path: `${BASE}/Traps/Fire/Off.png` },
  {
    key: STATIC_IMAGE_KEYS.CHECKPOINT_POLE,
    path: `${BASE}/Items/Checkpoints/Checkpoint/Checkpoint (No Flag).png`,
  },
];
