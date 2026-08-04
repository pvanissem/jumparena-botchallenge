/**
 * Bot-State/Action-Contract – siehe `docs/02-bot-api.md`.
 *
 * Dies ist der read-only Snapshot, den eine `decide(state)`-Funktion pro
 * Simulations-Tick übergeben bekommt, sowie der Aktions-Typ, den sie
 * zurückgeben muss.
 */
import type { HazardKind, UtilityKind } from "./hazards";

export type TileType = "empty" | "solid" | "hazard" | "coinBlock" | "goal" | "unknown";

export type Action = "left" | "right" | "jump" | "idle";

/** Einzige Quelle der Wahrheit für gültige Action-Werte (Laufzeit-Prüfung). */
export const ACTIONS: readonly Action[] = ["left", "right", "jump", "idle"];

export interface NearestCoin {
  dx: number;
  dy: number;
  /** Score-Wert dieser Münze (gestaffelt nach Frucht, siehe docs/05). */
  value: number;
}

export interface NearestHazard {
  dx: number;
  dy: number;
  kind: HazardKind;
  /** Ob die Gefahr im aktuellen Tick gefährlich ist (getaktete Hazards togglen). */
  active: boolean;
}

export interface NearestUtility {
  dx: number;
  dy: number;
  kind: UtilityKind;
}

export interface BotState {
  tick: number;
  position: { x: number; y: number };
  facing: "left" | "right";
  onGround: boolean;
  isAlive: boolean;

  /** Begrenztes Sichtfeld um den Bot herum. */
  nearbyTiles: TileType[][];

  nearestCoin: NearestCoin | null;
  nearestHazard: NearestHazard | null;
  nearestUtility: NearestUtility | null;
  goalDirection: { dx: number; dy: number };

  coinsCollected: number;
  livesRemaining: number;
  timeElapsedMs: number;
}
