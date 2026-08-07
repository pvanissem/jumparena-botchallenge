/**
 * Leitet die aktuelle Geschwindigkeit jedes Hazards aus der Positionsänderung
 * zwischen zwei Ticks ab (finite Differenz) – siehe
 * `.features/bot-toolkit/design.md`, US-7. Bewusst generisch über alle
 * `HazardKind`s (keine `kind`-Fallunterscheidung), damit die Open/Closed-
 * Registry-Architektur aus `docs/08-hazards-und-utilities.md` nicht verletzt
 * wird. Pure Funktion, keine Phaser-Abhängigkeit.
 */
export interface HazardPosition {
  id: string;
  x: number;
  y: number;
}

export interface HazardVelocity {
  vx: number;
  vy: number;
}

/**
 * `previous` fehlt ein Eintrag (erster Tick eines Hazards) -> `{0, 0}`.
 * `deltaMs <= 0` -> `{0, 0}` (Division durch 0 vermeiden).
 */
export function computeHazardVelocities(
  current: readonly HazardPosition[],
  previous: ReadonlyMap<string, { x: number; y: number }>,
  deltaMs: number
): Map<string, HazardVelocity> {
  const result = new Map<string, HazardVelocity>();
  if (deltaMs <= 0) {
    for (const hazard of current) {
      result.set(hazard.id, { vx: 0, vy: 0 });
    }
    return result;
  }

  const dtSeconds = deltaMs / 1000;
  for (const hazard of current) {
    const prev = previous.get(hazard.id);
    if (!prev) {
      result.set(hazard.id, { vx: 0, vy: 0 });
      continue;
    }
    result.set(hazard.id, {
      vx: (hazard.x - prev.x) / dtSeconds,
      vy: (hazard.y - prev.y) / dtSeconds,
    });
  }
  return result;
}
