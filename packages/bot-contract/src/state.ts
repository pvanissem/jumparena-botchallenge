/**
 * Bot-State/Action-Contract – siehe `docs/02-bot-api.md`.
 *
 * Dies ist der read-only Snapshot, den eine `decide(state)`-Funktion pro
 * Simulations-Tick (~33ms, 30Hz) übergeben bekommt, sowie der Aktions-Typ, den
 * sie zurückgeben muss.
 */
import type { HazardKind, UtilityKind } from "./hazards";
import type { NavigationObservation, RelativeBounds } from "./navigation";

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
  id?: string;
  bounds?: RelativeBounds;
  /** Pixel-Distanz horizontal, relativ zum Bot (– = links, + = rechts). */
  dx: number;
  /** Pixel-Distanz vertikal, relativ zum Bot (– = oben, + = unten). */
  dy: number;
  /** Score-Wert dieser Münze (gestaffelt nach Frucht, siehe docs/05). */
  value: number;
}

export interface VisibleHazard {
  id?: string;
  bounds?: RelativeBounds;
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
   *  damit der Bot die Spielregeln nicht kennen muss – aktuell nur `ninjafrog`,
   *  siehe docs/08-hazards-und-utilities.md). */
  stompable: boolean;
  /** Aktuelle Geschwindigkeit des Hazards (Pixel/s; vx>0 = rechts, vy>0 = unten).
   *  Ermittelt aus der Positionsänderung zwischen zwei Ticks (siehe
   *  `.features/bot-toolkit/design.md`, US-7). */
  vx: number;
  vy: number;
}

/** Sichtbare Checkpoint-Fahne; active bedeutet aktuelles Respawn-Ziel. */
export interface VisibleCheckpoint {
  id: string;
  dx: number;
  dy: number;
  bounds: RelativeBounds;
  reached: boolean;
  active: boolean;
}

/** Bekannte tatsächliche Wiedererscheinungsposition, unabhängig vom Sichtfeld. */
export interface RespawnPoint {
  checkpointId: string | null;
  x: number;
  y: number;
}

export interface VisibleUtility {
  id?: string;
  bounds?: RelativeBounds;
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

/** Art einer sichtbaren, physikalisch soliden Fläche (`state.platforms`). */
export type PlatformKind = "ground" | "float" | "ceiling" | "block";

/**
 * Exakte (nicht gerasterte) Rechteck-Geometrie einer sichtbaren, solide
 * kollidierenden Fläche, relativ zum Bot. `kind: "block"` ist ein noch nicht
 * ausgelöster versteckter Münzblock (voller Collider, von jeder Seite
 * solide; wird nach Auflösung nicht mehr geliefert). Siehe
 * `.features/bot-toolkit/design.md`, US-2.
 */
export interface VisiblePlatform {
  id?: string;
  bounds?: RelativeBounds;
  collision?: "solid" | "one-way-up";
  /** Linke obere Ecke, horizontal relativ zum Bot (Pixel). */
  dx: number;
  /** Linke obere Ecke, vertikal relativ zum Bot (Pixel). */
  dy: number;
  width: number;
  height: number;
  kind: PlatformKind;
}

/**
 * Bewegungsrelevante Physik-Konstanten, damit ein Bot Trajektorien/Sprünge
 * ohne geratene Zahlen berechnen kann (siehe `.features/bot-toolkit/design.md`,
 * US-3). Single Source of Truth ist `MOVEMENT_TUNING`/`TILE_SIZE` im Client;
 * dieser Block spiegelt deren aktuelle Werte pro Tick.
 */
export interface BotTuning {
  /** Schwerkraft (Pixel/s², positiv = nach unten). */
  gravity: number;
  /** Kantenlänge eines Tiles in Pixeln. */
  tileSize: number;
  /** Intervall zwischen zwei `decide`-Aufrufen in Millisekunden (~30Hz). */
  tickMs: number;
  baseMoveSpeed: number;
  sprintMoveSpeed: number;
  sprintRampMs: number;
  /** Sprungimpuls ohne Sprint (negativ = nach oben). */
  baseJumpVelocity: number;
  /** Sprungimpuls bei voller Sprint-Geschwindigkeit (negativ = nach oben). */
  sprintJumpVelocity: number;
  minJumpHoldMs: number;
  /** Breite/Höhe der eigenen Arcade-Kollisionsbox in Pixeln. */
  botWidth: number;
  botHeight: number;
}

export interface BotState {
  navigation?: NavigationObservation;
  tick: number;
  position: { x: number; y: number };
  facing: "left" | "right";
  onGround: boolean;
  isAlive: boolean;

  /** Eigene aktuelle Geschwindigkeit (Pixel/s; vx>0 = rechts, vy>0 = unten). */
  velocity: { vx: number; vy: number };
  /** Ob der Bot gerade Sprint-Momentum aufbaut. */
  isSprinting: boolean;
  /** Fortschritt der Sprint-Rampe (0 = Basistempo, 1 = volles Sprint-Tempo).
   *  Ergänzt `isSprinting` (nur boolean) um den genauen Stand, damit die
   *  künftige Geschwindigkeit vorhersagbar ist (siehe
   *  `.features/bot-toolkit/design.md`, US-3). */
  sprintRampProgress: number;

  /** Begrenztes Sichtfeld um den Bot herum (11×9, Bot in der Mitte bei [4][5]). */
  nearbyTiles: TileType[][];

  /** Exakte Rechteck-Geometrie aller sichtbaren, solide kollidierenden
   *  Flächen (Plattformen + ungelöste versteckte Münzblöcke). Ergänzt
   *  `nearbyTiles` um nicht gerasterte Geometrie für Trajektorien-Berechnungen
   *  (siehe `.features/bot-toolkit/design.md`, US-2). */
  platforms: VisiblePlatform[];

  /** Bewegungsrelevante Physik-Konstanten (siehe `BotTuning`). */
  tuning: BotTuning;

  /** Nächstgelegenes Objekt je Art (= erstes Element der jeweiligen Liste) oder
   *  `null`, wenn die Liste leer ist. */
  nearestCoin: NearestCoin | null;
  nearestHazard: NearestHazard | null;
  nearestUtility: NearestUtility | null;

  /** Alle im Sichtbereich befindlichen Objekte, aufsteigend nach Distanz sortiert. */
  coins: VisibleCoin[];
  hazards: VisibleHazard[];
  utilities: VisibleUtility[];
  /** Neue Runtimes liefern beide Felder immer; optional für ältere States. */
  checkpoints?: VisibleCheckpoint[];
  respawnPoint?: RespawnPoint;

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
