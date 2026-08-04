/**
 * Level-Datenmodell – siehe `docs/06-level-design.md`, `docs/08-hazards-und-utilities.md`.
 * Reine Typ-/Daten-Deklaration, keine Phaser-Abhängigkeit (siehe
 * `.features/level-one-arena/design.md`).
 */
import type { HazardKind, UtilityKind } from "@arena/bot-contract";

export interface PlatformDef {
  x: number;
  y: number;
  tilesWide: number;
  /** "ground" = solides Bodensegment, "float" = schmale Schwebeplattform. Default "ground". */
  kind?: "ground" | "float";
}

export type FruitKind =
  | "cherries"
  | "strawberry"
  | "orange"
  | "apple"
  | "bananas"
  | "kiwi"
  | "melon"
  | "pineapple";

/** Score-Wert je Frucht (gestaffelt: leicht erreichbar -> günstig, siehe docs/06). */
export const FRUIT_VALUES: Record<FruitKind, number> = {
  cherries: 5,
  strawberry: 8,
  orange: 10,
  apple: 10,
  bananas: 12,
  kiwi: 15,
  melon: 20,
  pineapple: 25,
};

export interface CoinDef {
  id: string;
  x: number;
  y: number;
  fruit: FruitKind;
}

/** Versteckter Block – wird erst nach Treffer von unten zu einer einsammelbaren Münze. */
export interface HiddenCoinBlockDef {
  id: string;
  x: number;
  y: number;
  fruit: FruitKind;
}

export interface CheckpointDef {
  id: string;
  x: number;
  y: number;
}

export interface GoalDef {
  x: number;
  y: number;
}

// Hazard-/Utility-Geometrie – Kind kommt aus @arena/bot-contract (Single Source of
// Truth für die Kind-Strings), Geometrie/Timing lebt hier (Level-Belang, nicht
// Bot-Contract-Belang). `Extract<HazardKind, "...">` statt eines einfachen
// String-Literals: entfernte/umbenannte HazardKind-Werte würden hier zu `never`
// und damit zu einem Compile-Fehler führen (Drift-Schutz).
export type HazardInstanceDef =
  | {
      kind: Extract<HazardKind, "schnetzler">;
      id: string;
      x: number;
      y: number;
      minX: number;
      maxX: number;
      speed: number;
    }
  | {
      kind: Extract<HazardKind, "stachlinger">;
      id: string;
      x: number;
      y: number;
    }
  | {
      kind: Extract<HazardKind, "loderix">;
      id: string;
      x: number;
      y: number;
      onMs?: number;
      offMs?: number;
      phaseMs?: number;
    }
  | {
      kind: Extract<HazardKind, "kugelblitz">;
      id: string;
      pivotX: number;
      pivotY: number;
      length: number;
      periodMs?: number;
      amplitudeDeg?: number;
    };

export interface UtilityInstanceDef {
  kind: UtilityKind; // "boingo"
  id: string;
  x: number;
  y: number;
}

export interface LevelDef {
  worldWidth: number;
  worldHeight: number;
  groundY: number;
  spawn: { x: number; y: number };
  goal: GoalDef;
  platforms: PlatformDef[];
  coins: CoinDef[];
  hiddenCoinBlocks: HiddenCoinBlockDef[];
  checkpoints: CheckpointDef[];
  hazards: HazardInstanceDef[];
  utilities: UtilityInstanceDef[];
}
