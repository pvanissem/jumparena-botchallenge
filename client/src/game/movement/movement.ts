/**
 * Pure Bewegungs-/Sprung-Physik-Funktionen für Sprint-Momentum und variable
 * Sprunghöhe – siehe `.features/movement-sprint-and-variable-jump/design.md`.
 * Vollständig ohne Phaser testbar (kein Sprite/Body nötig).
 */

export const MOVEMENT_TUNING = {
  /** Basisgeschwindigkeit ohne Sprint (bisheriges `MOVE_SPEED`). */
  BASE_MOVE_SPEED: 200,
  /** Ziel-Geschwindigkeit bei voll aufgebautem Sprint. */
  SPRINT_MOVE_SPEED: 320,
  /** Zeit, um von Basis- auf Sprint-Tempo zu rampen. */
  SPRINT_RAMP_MS: 450,
  /** Sprungkraft ohne Sprint (bisheriges `JUMP_VELOCITY`, negativ = nach oben). */
  BASE_JUMP_VELOCITY: -560,
  /** Sprungkraft bei voller Sprint-Geschwindigkeit. */
  SPRINT_JUMP_VELOCITY: -650,
  /** Sprungkraft eines Trampolin-Bounces (negativ = nach oben). */
  BOINGO_JUMP_VELOCITY: -820,
  /** Garantierte Mindest-Halte-Zeit eines Sprungs (> 150ms Bot-Tick-Intervall). */
  MIN_JUMP_HOLD_MS: 180,
  /** Schwerkraft (Arcade-Physik-Y-Achse, siehe `ArenaView.tsx`). Hochgezogen
   *  aus dem bisherigen Literal, damit sie konsistent im Bot-State
   *  (`state.tuning.gravity`, siehe `.features/bot-toolkit/`) exponiert
   *  werden kann. */
  GRAVITY_Y: 900,
  /** Arcade-Body-Größe des Spielers (siehe `RaceScene.ts` `body.setSize(...)`).
   *  Ebenfalls für `state.tuning` benötigt (Kollisionsboxen in Trajektorie-
   *  Berechnungen). */
  PLAYER_BODY_SIZE: { width: 24, height: 32 },
  /** Intervall zwischen zwei Bot-Ticks in Millisekunden (~30Hz). Hochgezogen
   *  aus `RaceScene.ts`s vormals lokaler Konstante, damit `state.tuning.tickMs`
   *  (siehe `.features/bot-toolkit/`) dieselbe Quelle referenziert, ohne einen
   *  Phaser-Import in reine State-Tests zu ziehen. */
  BOT_TICK_INTERVAL_MS: 33,
} as const;

type SprintSpeedTuning = Pick<
  typeof MOVEMENT_TUNING,
  "BASE_MOVE_SPEED" | "SPRINT_MOVE_SPEED" | "SPRINT_RAMP_MS"
>;

/**
 * Aktuelle horizontale Geschwindigkeit als Funktion davon, wie lange
 * ununterbrochen in dieselbe Richtung gesprintet wurde (`sprintHoldMs`).
 * `sprintHoldMs<=0` -> Basisgeschwindigkeit, `sprintHoldMs>=SPRINT_RAMP_MS`
 * -> volle Sprint-Geschwindigkeit, linear dazwischen. Der Aufrufer
 * entscheidet, wann `sprintHoldMs` erhöht/zurückgesetzt wird (z.B. auf 0,
 * wenn gerade nicht gesprintet wird) - diese Funktion kennt nur die reine
 * Rampen-Mathematik.
 */
export function rampedSprintSpeed(
  sprintHoldMs: number,
  tuning: SprintSpeedTuning = MOVEMENT_TUNING
): number {
  const t = Math.max(0, Math.min(1, sprintHoldMs / tuning.SPRINT_RAMP_MS));
  return tuning.BASE_MOVE_SPEED + (tuning.SPRINT_MOVE_SPEED - tuning.BASE_MOVE_SPEED) * t;
}

type JumpVelocityTuning = Pick<
  typeof MOVEMENT_TUNING,
  "BASE_MOVE_SPEED" | "SPRINT_MOVE_SPEED" | "BASE_JUMP_VELOCITY" | "SPRINT_JUMP_VELOCITY"
>;

/**
 * Sprung-Velocity (negativ = nach oben) skaliert stufenlos zwischen
 * `BASE_JUMP_VELOCITY` (bei `BASE_MOVE_SPEED`) und `SPRINT_JUMP_VELOCITY`
 * (bei `SPRINT_MOVE_SPEED`), abhängig von der aktuellen horizontalen
 * Geschwindigkeit zum Absprungzeitpunkt. Werte außerhalb dieser Spanne
 * werden geklemmt (kein Extrapolieren).
 */
export function jumpVelocityForSpeed(
  currentSpeed: number,
  tuning: JumpVelocityTuning = MOVEMENT_TUNING
): number {
  const range = tuning.SPRINT_MOVE_SPEED - tuning.BASE_MOVE_SPEED;
  const t =
    range <= 0 ? 0 : Math.max(0, Math.min(1, (currentSpeed - tuning.BASE_MOVE_SPEED) / range));
  return tuning.BASE_JUMP_VELOCITY + (tuning.SPRINT_JUMP_VELOCITY - tuning.BASE_JUMP_VELOCITY) * t;
}

/**
 * Ob ein laufender Sprung JETZT abgeschnitten werden soll (Racer soll
 * sofort in den Fall-Zustand übergehen). `true` nur, wenn die
 * Mindest-Halte-Zeit bereits verstrichen ist UND die Sprung-Taste/Action
 * aktuell NICHT gehalten wird. Der Aufrufer ruft dies nur auf, während sich
 * der Racer im Aufstieg befindet (siehe RaceScene) - kennt daher nichts
 * über `vy`/`onGround`.
 */
export function shouldCutJump(
  msSinceJumpStart: number,
  jumpHeld: boolean,
  minHoldMs: number = MOVEMENT_TUNING.MIN_JUMP_HOLD_MS
): boolean {
  if (jumpHeld) return false;
  return msSinceJumpStart >= minHoldMs;
}
