# Tasks: Level-Two-Background

Bezug: `requirements.md`, `design.md`.

- [x] 1. `LevelDef.backgroundKey` ergänzen (Bezug: US-1)
      `level/types.ts` – additiv, optional, kein eigener Test nötig (reine Typ-Erweiterung).

- [x] 2. `BACKGROUND_REGISTRY`/`DEFAULT_BACKGROUND_KEY` anlegen (Bezug: US-1)
      `world/backgroundRegistry.ts` – reine Konstanten-Deklaration, kein Test nötig (siehe
      design.md Test-Strategie), referenziert `buildSmb1StyleBackgroundTexture` (Task 3).

- [x] 3. `proceduralBackgrounds.ts` implementieren (Bezug: US-2, US-3)
      `world/proceduralBackgrounds.ts` – `buildSmb1StyleBackgroundTexture` (Himmel, Wolken,
      Hügel, Büsche per Graphics + `generateTexture`, idempotent). Ungetestet (Phaser/Canvas),
      manuell verifiziert.

- [x] 4. `worldBuilder.ts` anpassen (Bezug: US-1, US-2)
      `buildBackground()` liest `BACKGROUND_REGISTRY[level.backgroundKey ?? DEFAULT_BACKGROUND_KEY]`
      statt hart `"background"`.

- [x] 5. `LEVEL_TWO` um `backgroundKey: "smb1-1"` ergänzen (Bezug: US-2)
      `level/levelTwo.ts`.

- [x] 6. Vollständiger Testlauf + manuelle Verifikation
      `npx vitest run` (client) grün (Regressionsschutz für `levelTwo.test.ts` etc.),
      `tsc --noEmit` sauber, manuelle Checkliste aus design.md im Browser (Level 1 unverändert,
      Level 2 neuer Hintergrund).
