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
