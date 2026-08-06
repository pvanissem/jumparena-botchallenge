# Tasks: Level-Three-Underground

Bezug: `.features/level-three-underground/requirements.md`,
`.features/level-three-underground/design.md`. Reihenfolge = Abhängigkeitsreihenfolge (pure
Bausteine zuerst, Wiring zuletzt). Jeder Test-Task wird VOR dem zugehörigen
Implementierungs-Task rot geschrieben (TDD-Pflicht laut AGENTS.md).

- [x] 1. `LevelDef.terrainStyleKey` ergänzen (Bezug: US-3, Design "level/types.ts")
      `level/types.ts` – rein additives, optionales Feld, kein eigener Test nötig (reine
      Typ-Deklaration).

- [x] 2. Test für `TERRAIN_STYLE_REGISTRY` (rot) (Bezug: US-3, Design
      "world/terrainStyleRegistry.ts")
      `world/terrainStyleRegistry.test.ts`: enthält `"default"` (kein Tint) und
      `"underground"` (mit Tint-Farbwert).
- [x] 3. `terrainStyleRegistry.ts` implementieren (grün)
      `world/terrainStyleRegistry.ts`.

- [x] 4. Test für `LEVEL_THREE`-Struktur (rot) (Bezug: US-1, Design "level/levelThree.ts")
      `level/levelThree.test.ts`: Münzen-/Block-/Checkpoint-Anzahl (10-15/3-5/>=3), nur
      bestehende Hazard-Kinds, keine Schnetzler-Cluster >=3 auf einer Plattform, alle
      Boden-Lücken <=128px, Spikehead-Timings entschärft (`warnMs` größer / `restMs` kleiner
      als Level-2-Defaults), `backgroundKey === "underground"`,
      `terrainStyleKey === "underground"`, physikalische Plausibilität (Coins/Blocks/
      Checkpoints/Utilities über Plattformen) analog `levelTwo.test.ts`.
- [x] 5. `LEVEL_THREE`-Daten implementieren (grün)
      `level/levelThree.ts` – vollständiges, spielbares Level gemäß design.md.

- [x] 6. Test für `LEVEL_REGISTRY`-Erweiterung (rot) (Bezug: US-1, Design "Level-Registry")
      `level/levelRegistry.test.ts` erweitern: enthält `"level-three"` mit Label,
      `getLevelById("level-three")` liefert `LEVEL_THREE`, bestehende Einträge unverändert.
- [x] 7. `LEVEL_REGISTRY` erweitern (grün)
      `level/levelRegistry.ts` – `LEVEL_THREE` importieren, Eintrag ergänzen.

- [x] 8. `proceduralBackgrounds.ts` erweitern: `buildUndergroundStyleBackgroundTexture`
      (Bezug: US-2, Design "world/proceduralBackgrounds.ts")
      `world/proceduralBackgrounds.ts` – dunkler Grundton, 3 Fels-Ebenen (`drawRockLayer`),
      Kristall-Akzente (`drawCrystals`). Ungetestet (Phaser/Canvas-Rendering), analog zu
      `buildSmb1StyleBackgroundTexture`.

- [x] 9. `backgroundRegistry.ts` erweitern (Bezug: US-2, Design
      "world/backgroundRegistry.ts")
      Eintrag `"underground"` ergänzt – reine Konstanten, kein eigener Test nötig (analog
      `"smb1-1"`).

- [x] 10. `worldBuilder.ts::paintTerrainSegment` anpassen (Bezug: US-3, Design
      "world/worldBuilder.ts")
      Liest `TERRAIN_STYLE_REGISTRY[level.terrainStyleKey ?? DEFAULT_TERRAIN_STYLE_KEY]` und
      wendet `setTint()` an, falls gesetzt. Ungetestet (Phaser), ruft nur bereits getestete
      Registry-Lookup-Logik auf.

- [x] 11. Doku-Updates (Bezug: "Begleitende Doku-Updates")
      `docs/06-level-design.md` (Hinweis auf drei Level, Schwierigkeitsgrade),
      `docs/08-hazards-und-utilities.md` (kurzer Hinweis auf Wiederverwendung in Level 3).

- [x] 12. Vollständiger Testlauf + manuelle Verifikation
      Workspace-Testbefehl grün; manuelle Checkliste aus design.md Test-Strategie im
      Browser durchgehen (`/dev`, Level 1/2/3-Dropdown, Regressionstest Level 1+2,
      Untergrund-Optik, Durchspielbarkeit Level 3).
