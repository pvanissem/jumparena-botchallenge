/** Alle gültigen Level-IDs. Einzige serverseitig verfügbare Quelle der
 *  Wahrheit; die zugehörigen `LevelDef`s liegen weiterhin im Client
 *  (`client/src/game/level/levelRegistry.ts`) und werden über diese IDs
 *  referenziert. Ein Test im Client stellt sicher, dass beide Listen nicht
 *  auseinanderlaufen. */
export const LEVEL_IDS = [
  "level-one",
  "level-two",
  "level-three",
  "level-four",
  "level-five",
  "toolkit-test",
] as const;

export function isValidLevelId(value: unknown): value is string {
  return typeof value === "string" && (LEVEL_IDS as readonly string[]).includes(value);
}
