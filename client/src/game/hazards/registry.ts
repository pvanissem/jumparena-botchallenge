/**
 * Rendering-/Verhaltens-Metadaten pro Hazard-/Utility-Kind – siehe
 * `.features/level-one-arena/design.md`, Abschnitt "hazards/registry.ts",
 * und `docs/08-hazards-und-utilities.md`.
 *
 * Reine Konstanten-Deklaration ohne Verzweigungslogik – kein eigener Test
 * nötig (siehe design.md, Test-Strategie).
 */
import type { HazardKind, UtilityKind } from "@arena/bot-contract";

export type HazardBehaviorKind = "patrol" | "static" | "timed" | "pendulum" | "trigger";

export interface HitboxSpec {
  width: number;
  height: number;
  offsetX?: number;
  offsetY?: number;
}

export interface HazardSpec {
  texture: string;
  anim?: string;
  /**
   * Alternative Textur, während der Hazard inaktiv ("aus") ist – bislang nur
   * für Loderix relevant (erloschenes Feuer, `Traps/Fire/Off.png`). Ohne
   * dieses Feld bliebe der Hazard im "Aus"-Zustand einfach unsichtbar, was
   * fälschlich wie ein fehlendes Asset aussieht.
   */
  inactiveTexture?: string;
  /**
   * Tint (Phaser `setTint`-Farbwert), um ein bestehendes Sprite ohne neues
   * Asset optisch zu unterscheiden (Spikehead nutzt das Stachlinger-Sprite in
   * einer anderen Farbe, siehe `.features/level-two-kaizo/design.md`).
   */
  tint?: number;
  stompable: boolean;
  behavior: HazardBehaviorKind;
  hitbox: HitboxSpec;
}

export const HAZARD_REGISTRY: Record<HazardKind, HazardSpec> = {
  schnetzler: {
    texture: "saw",
    anim: "saw-spin",
    stompable: true,
    behavior: "patrol",
    hitbox: { width: 28, height: 28, offsetX: 5, offsetY: 5 },
  },
  stachlinger: {
    texture: "spikes",
    stompable: false,
    behavior: "static",
    hitbox: { width: 10, height: 10, offsetX: 3, offsetY: 6 },
  },
  loderix: {
    texture: "fire-on",
    anim: "loderix-on",
    inactiveTexture: "fire-off",
    stompable: false,
    behavior: "timed",
    hitbox: { width: 10, height: 22, offsetX: 3, offsetY: 10 },
  },
  kugelblitz: {
    texture: "spiked-ball",
    stompable: false,
    behavior: "pendulum",
    hitbox: { width: 24, height: 24, offsetX: 2, offsetY: 2 },
  },
  spikehead: {
    // Nutzt bewusst dasselbe Asset wie Kugelblitz (Spiked Ball) statt
    // Stachlinger - passt optisch besser zur fallenden/kletternden Bewegung
    // als das flache Stachel-Sprite. Der Tint macht ihn trotzdem
    // unterscheidbar (rot statt der neutralen Kugelblitz-Farbe).
    texture: "spiked-ball",
    stompable: false,
    behavior: "trigger",
    hitbox: { width: 24, height: 24, offsetX: 2, offsetY: 2 },
    tint: 0xff5555,
  },
};

/**
 * Boingo hat bewusst KEIN `idleAnim` (YAGNI): Die Ruhe-Darstellung ist ein
 * einzelnes statisches Bild (`texture`), keine echte Animation. Nur der
 * Sprung-Auslöser (`triggerAnim`) ist eine echte Spritesheet-Animation;
 * danach wechselt das Sprite per `setTexture(spec.texture)` zurück (siehe
 * `RaceScene.onUtilityOverlap`).
 */
export interface UtilitySpec {
  texture: string;
  triggerAnim: string;
  hitbox: HitboxSpec;
}

export const UTILITY_REGISTRY: Record<UtilityKind, UtilitySpec> = {
  boingo: {
    texture: "trampoline",
    triggerAnim: "boingo-jump",
    hitbox: { width: 26, height: 10, offsetX: 1, offsetY: 18 },
  },
};

/** Standard-Timing-Konstanten (können pro Instanz in den Defs überschrieben werden). */
export const HAZARD_DEFAULTS = {
  loderix: { onMs: 1500, offMs: 1500, phaseMs: 0 },
  kugelblitz: { periodMs: 2400, amplitudeDeg: 50 },
  spikehead: { warnMs: 400, fallMs: 200, restMs: 600, riseMs: 500 },
} as const;
