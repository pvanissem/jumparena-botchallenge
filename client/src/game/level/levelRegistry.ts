/**
 * Zentrale Level-Registry – siehe `.features/level-two-kaizo/design.md`,
 * Abschnitt "Level-Registry". Einziger Ort, der konkrete Level-Module
 * importiert; Konsumenten (RaceScene, /dev-UI, später ggf. /admin)
 * referenzieren Level ausschließlich über ihre stabile `id`.
 */
import { LEVEL_FIVE } from "./levelFive";
import { LEVEL_FOUR } from "./levelFour";
import { LEVEL_ONE } from "./levelOne";
import { LEVEL_SIX } from "./levelSix";
import { LEVEL_THREE } from "./levelThree";
import { LEVEL_TOOLKIT_TEST } from "./levelToolkitTest";
import { LEVEL_TWO } from "./levelTwo";
import type { LevelDef } from "./types";

export interface LevelRegistryEntry {
  id: string;
  label: string;
  level: LevelDef;
}

export const LEVEL_REGISTRY: readonly LevelRegistryEntry[] = [
  { id: "level-one", label: "Level 1", level: LEVEL_ONE },
  { id: "level-two", label: "Level 2 – Kaizo", level: LEVEL_TWO },
  { id: "level-three", label: "Level 3 – Night", level: LEVEL_THREE },
  { id: "level-four", label: "Level 4 – Underground", level: LEVEL_FOUR },
  { id: "level-five", label: "Level 5 – Desert", level: LEVEL_FIVE },
  { id: "level-six", label: "Level 6 – Frost", level: LEVEL_SIX },
  { id: "toolkit-test", label: "Test – Bot Toolkit", level: LEVEL_TOOLKIT_TEST },
];

export const DEFAULT_LEVEL_ID = "level-one";

/** Fail-Fast: wirft bei unbekannter ID, statt still ein Default zu laden. */
export function getLevelById(levelId: string): LevelDef {
  const entry = LEVEL_REGISTRY.find((e) => e.id === levelId);
  if (!entry) {
    throw new Error(
      `Unbekannte Level-ID: "${levelId}". Verfügbar: ${LEVEL_REGISTRY.map((e) => e.id).join(", ")}`
    );
  }
  return entry.level;
}
