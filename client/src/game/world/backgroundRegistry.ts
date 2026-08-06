/**
 * Zentrale Zuordnung `backgroundKey -> BackgroundSpec` – siehe
 * `.features/level-two-background/design.md`. Neuer Hintergrund = neuer
 * Eintrag hier (+ ggf. eine neue `buildTexture`-Funktion), `worldBuilder.ts`
 * verzweigt nie selbst nach `backgroundKey` (Open/Closed, analog
 * `hazards/registry.ts`).
 *
 * Reine Konstanten-Deklaration ohne Verzweigungslogik – kein eigener Test
 * nötig (siehe design.md, Test-Strategie).
 */
import type Phaser from "phaser";
import {
  buildNightStyleBackgroundTexture,
  buildSmb1StyleBackgroundTexture,
  buildUndergroundStyleBackgroundTexture,
} from "./proceduralBackgrounds";

export type BackgroundSpec =
  | { kind: "image"; textureKey: string }
  | { kind: "procedural"; buildTexture: (scene: Phaser.Scene, worldHeight: number) => string };

export const BACKGROUND_REGISTRY: Record<string, BackgroundSpec> = {
  default: { kind: "image", textureKey: "background" }, // bestehendes Blue.png
  "smb1-1": { kind: "procedural", buildTexture: buildSmb1StyleBackgroundTexture },
  night: { kind: "procedural", buildTexture: buildNightStyleBackgroundTexture },
  underground: { kind: "procedural", buildTexture: buildUndergroundStyleBackgroundTexture },
};

export const DEFAULT_BACKGROUND_KEY = "default";
