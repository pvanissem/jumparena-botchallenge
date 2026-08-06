/**
 * Bot-State/Action-Contract – siehe `docs/02-bot-api.md`.
 *
 * Dies ist der read-only Snapshot, den eine `decide(state)`-Funktion pro
 * Simulations-Tick (~33ms, 30Hz) übergeben bekommt, sowie der Aktions-Typ, den
 * sie zurückgeben muss.
 */
import type { HazardKind, UtilityKind } from "./hazards";

export type TileType = "empty" | "solid" | "hazard" | "coinBlock" | "goal" | "unknown";

export type Action = "left" | "right" | "jump" | "idle" | "sprint-left" | "sprint-right";

/** Einzige Quelle der Wahrheit für gültige Action-Werte (Laufzeit-Prüfung). */
export const ACTIONS: readonly Action[] = [
  "left",
  "right",
  "jump",
  "idle",
  "sprint-left",
  "sprint-right",
];

/**
 * Rückgabewert von `decide`: eine Liste von Actions, die im selben Tick
 * gleichzeitig angewendet werden (z.B. `["jump", "sprint-right"]` = springen und
 * dabei nach rechts sprinten). `[]` bedeutet "nichts tun". Bei mehreren
 * horizontalen Bewegungs-Actions gewinnt die zuletzt genannte.
 */
export type DecideResult = Action[];

export interface VisibleCoin {
  /** Pixel-Distanz horizontal, relativ zum Bot (– = links, + = rechts). */
  dx: number;
  /** Pixel-Distanz vertikal, relativ zum Bot (– = oben, + = unten). */
  dy: number;
  /** Score-Wert dieser Münze (gestaffelt nach Frucht, siehe docs/05). */
  value: number;
}

export interface VisibleHazard {
  dx: number;
  dy: number;
  kind: HazardKind;
  /** Ob die Gefahr im aktuellen Tick gefährlich ist (getaktete Hazards togglen). */
  active: boolean;
  /** Ob sich eine Gefahr gerade ankündigt (Spikehead-Vorwarnphase): noch nicht
   *  gefährlich (`active: false`), aber gleich. Für alle anderen Hazards immer
   *  `false`. */
  warning: boolean;
  /** Ob dieser Hazard durch Draufspringen neutralisiert werden kann (vorberechnet,
   *  damit der Bot die Spielregeln nicht kennen muss – aktuell nur `schnetzler`). */
  stompable: boolean;
}

export interface VisibleUtility {
  dx: number;
  dy: number;
  kind: UtilityKind;
}

/** Bequeme Shortcuts auf das jeweils nächstgelegene Objekt = Listen-`[0]`. */
export type NearestCoin = VisibleCoin;
export type NearestHazard = VisibleHazard;
export type NearestUtility = VisibleUtility;

export interface GapAhead {
  /** Ob in Blickrichtung (`facing`) im Sichtbereich eine Bodenlücke kommt. */
  present: boolean;
  /** Pixel-Distanz bis zur Lückenkante, oder `null`, wenn keine Lücke voraus. */
  distance: number | null;
}

export interface BotState {
  tick: number;
  position: { x: number; y: number };
  facing: "left" | "right";
  onGround: boolean;
  isAlive: boolean;

  /** Eigene aktuelle Geschwindigkeit (Pixel/s; vx>0 = rechts, vy>0 = unten). */
  velocity: { vx: number; vy: number };
  /** Ob der Bot gerade Sprint-Momentum aufbaut. */
  isSprinting: boolean;

  /** Begrenztes Sichtfeld um den Bot herum (7×5, Bot in der Mitte). */
  nearbyTiles: TileType[][];

  /** Nächstgelegenes Objekt je Art (= erstes Element der jeweiligen Liste) oder
   *  `null`, wenn die Liste leer ist. */
  nearestCoin: NearestCoin | null;
  nearestHazard: NearestHazard | null;
  nearestUtility: NearestUtility | null;

  /** Alle im Sichtbereich befindlichen Objekte, aufsteigend nach Distanz sortiert. */
  coins: VisibleCoin[];
  hazards: VisibleHazard[];
  utilities: VisibleUtility[];

  goalDirection: { dx: number; dy: number };
  gapAhead: GapAhead;
  worldBounds: { width: number; height: number };

  /** `true` im ersten Tick, nachdem der Bot an einem Checkpoint respawnt ist. */
  justRespawned: boolean;
  /** `true` im ersten Tick, nachdem der Bot ein Leben verloren hat. */
  tookDamage: boolean;

  coinsCollected: number;
  livesRemaining: number;
  timeElapsedMs: number;
}
