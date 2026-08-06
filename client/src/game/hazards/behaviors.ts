/**
 * Pure Zeitfunktionen für Hazard-Bewegung/-Zustand – siehe
 * `.features/level-one-arena/design.md`, Abschnitt "hazards/behaviors.ts".
 * Vollständig ohne Phaser testbar (kein Sprite nötig).
 */
import { HAZARD_DEFAULTS } from "./registry";

export interface PatrolLike {
  minX: number;
  maxX: number;
  speed: number;
}

/** Aktuelle x-Position eines zwischen minX/maxX patrouillierenden Hazards. */
export function patrolX(def: PatrolLike, elapsedMs: number): number {
  const range = def.maxX - def.minX;
  if (range <= 0 || def.speed <= 0) return def.minX;

  const oneWayMs = (range / def.speed) * 1000;
  const cycleMs = oneWayMs * 2;
  const t = elapsedMs % cycleMs;

  if (t <= oneWayMs) {
    return def.minX + (t / oneWayMs) * range;
  }
  const back = t - oneWayMs;
  return def.maxX - (back / oneWayMs) * range;
}

export interface TimedLike {
  onMs?: number;
  offMs?: number;
  phaseMs?: number;
}

/** Ob ein getakteter Hazard (z.B. Loderix) aktuell "an" (gefährlich) ist. */
export function isTimedActive(def: TimedLike, elapsedMs: number): boolean {
  const onMs = def.onMs ?? HAZARD_DEFAULTS.loderix.onMs;
  const offMs = def.offMs ?? HAZARD_DEFAULTS.loderix.offMs;
  const phaseMs = def.phaseMs ?? HAZARD_DEFAULTS.loderix.phaseMs;

  const cycleMs = onMs + offMs;
  const t = (elapsedMs + phaseMs) % cycleMs;
  return t < onMs;
}

export interface PendulumLike {
  length: number;
  periodMs?: number;
  amplitudeDeg?: number;
}

/** Versatz (relativ zum Pivot-Punkt) eines schwingenden Hazards. */
export function pendulumOffset(def: PendulumLike, elapsedMs: number): { x: number; y: number } {
  const periodMs = def.periodMs ?? HAZARD_DEFAULTS.kugelblitz.periodMs;
  const amplitudeDeg = def.amplitudeDeg ?? HAZARD_DEFAULTS.kugelblitz.amplitudeDeg;
  const amplitudeRad = (amplitudeDeg * Math.PI) / 180;

  const angle = amplitudeRad * Math.sin((2 * Math.PI * elapsedMs) / periodMs);
  return {
    x: def.length * Math.sin(angle),
    y: def.length * (1 - Math.cos(angle)),
  };
}

export interface SpikeheadLike {
  originY: number;
  fallToY: number;
  warnMs?: number;
  fallMs?: number;
  restMs?: number;
  riseMs?: number;
}

export type SpikeheadPhase = "idle" | "warning" | "falling" | "resting" | "rising";

export interface SpikeheadState {
  phase: SpikeheadPhase;
  /** Aktuelle vertikale Position. */
  y: number;
  /** Ob der Hazard gerade gefährlich ist (falling/resting/rising). */
  active: boolean;
}

/**
 * Rein zeitbasiert ab dem Moment des Triggers (`msSinceTrigger`). `null`
 * bedeutet "noch nie/nicht mehr getriggert" -> idle an `originY`. Zyklus:
 * idle -(Trigger)-> warning (an originY, ungefährlich, Vorwarnzeit) ->
 * falling (Y interpoliert originY->fallToY, gefährlich) -> resting (an
 * fallToY, gefährlich) -> rising (Y interpoliert langsam zurück
 * fallToY->originY, weiterhin gefährlich) -> zurück zu idle, sobald wieder
 * vollständig oben (erst dann erneut auslösbar, siehe `RaceScene
 * .updateSpikeheadTriggers`).
 */
export function spikeheadState(def: SpikeheadLike, msSinceTrigger: number | null): SpikeheadState {
  if (msSinceTrigger === null) {
    return { phase: "idle", y: def.originY, active: false };
  }

  const warnMs = def.warnMs ?? HAZARD_DEFAULTS.spikehead.warnMs;
  const fallMs = def.fallMs ?? HAZARD_DEFAULTS.spikehead.fallMs;
  const restMs = def.restMs ?? HAZARD_DEFAULTS.spikehead.restMs;
  const riseMs = def.riseMs ?? HAZARD_DEFAULTS.spikehead.riseMs;

  if (msSinceTrigger < warnMs) {
    return { phase: "warning", y: def.originY, active: false };
  }
  if (msSinceTrigger < warnMs + fallMs) {
    const t = (msSinceTrigger - warnMs) / fallMs;
    return { phase: "falling", y: def.originY + (def.fallToY - def.originY) * t, active: true };
  }
  if (msSinceTrigger < warnMs + fallMs + restMs) {
    return { phase: "resting", y: def.fallToY, active: true };
  }
  if (msSinceTrigger < warnMs + fallMs + restMs + riseMs) {
    const t = (msSinceTrigger - (warnMs + fallMs + restMs)) / riseMs;
    return { phase: "rising", y: def.fallToY + (def.originY - def.fallToY) * t, active: true };
  }
  return { phase: "idle", y: def.originY, active: false };
}
