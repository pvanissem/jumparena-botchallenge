# Tasks: Level-Four-Underground

- [x] 1. `PlatformDef.kind` um `"ceiling"` erweitern (Bezug: US-1, Design "Schnittstellen")
      In `level/types.ts` die Union um `"ceiling"` ergänzen (rein additiv, keine bestehenden
      Werte ändern).

- [x] 2. Test für Ceiling-Solid-Erkennung (rot) → grün (Bezug: US-1, Design "Warum Decke ohne
      Physik-/Tiles-Änderung funktioniert")
      In `level/tiles.test.ts` einen Fixture-Test ergänzen: eine Platform mit
      `kind: "ceiling"` wird von `isSolidAt` an ihrer Zeile korrekt als solid erkannt. Test
      zuerst schreiben (schlägt vor Task 1 wegen fehlendem Typ fehl), dann mit Task 1 grün.

- [x] 3. `STONE_TERRAIN_TILES`-Frame-Konstante (Bezug: US-2, Design "Tileset-Sichtung")
      In `assets/spriteSheets.ts` `STONE_TERRAIN_TILES` (Spalten 0-2, Reihe 0, siehe Design)
      neben `TERRAIN_TILES` ergänzen. Reine Konstante, kein dedizierter Test (analog
      `TERRAIN_TILES`).

- [x] 4. Test für `terrainStyleRegistry`-Erweiterung (rot) → grün (Bezug: US-2, Design
      "Schnittstellen")
      In `world/terrainStyleRegistry.test.ts` Test ergänzen: `TERRAIN_STYLE_REGISTRY.underground`
      existiert, hat `frames` (kein `tint`), alle Frame-Indizes sind gültige Tile-Indizes
      (0 ≤ i < 22×11). Dann `TerrainStyleSpec.frames?: TerrainFrameSet` + Eintrag
      `underground: { frames: STONE_TERRAIN_TILES }` in `terrainStyleRegistry.ts` ergänzen, bis
      Test grün ist.

- [x] 5. Prozeduraler Untergrund-Hintergrund (Bezug: US-3, Design "proceduralBackgrounds.ts")
      `buildUndergroundStyleBackgroundTexture()` in `world/proceduralBackgrounds.ts` ergänzen
      (schwarzer Grund + grünliches Backstein-/Blockraster, analog
      `buildNightStyleBackgroundTexture`). Nicht unit-getestet (Phaser/Canvas, siehe Design
      Test-Strategie).

- [x] 6. Hintergrund-Registry-Eintrag (Bezug: US-3, Design "backgroundRegistry.ts")
      `underground: { kind: "procedural", buildTexture: buildUndergroundStyleBackgroundTexture }`
      in `world/backgroundRegistry.ts` ergänzen. Kein dedizierter Test (analog bestehenden
      Einträgen, reine Konstanten-Deklaration).

- [x] 7. `paintTerrainSegment()`: Ceiling-Rendering + Frame-Set aus Style (Bezug: US-1, US-2,
      Design "worldBuilder.ts")
      In `world/worldBuilder.ts`: Frame-Set aus `style.frames ?? TERRAIN_TILES` statt hartkodiert
      `TERRAIN_TILES` lesen; neuer Zweig für `kind === "ceiling"` (Zeilen aufwärts von `p.y` bis
      `y=0` zeichnen, Rand-Frame vertikal geflippt). Nicht unit-getestet (Phaser-Rendering,
      manuelle Verifikation in Task 11).

- [x] 8. Test für `LEVEL_FOUR`-Struktur (rot) → `LEVEL_FOUR` implementieren (grün) (Bezug: US-1,
      Design "level/levelFour.ts" + Test-Strategie)
      `level/levelFour.test.ts` zuerst schreiben (analog `levelThree.test.ts`, plus neue
      Assertions: jedes `"ground"`-Segment hat ein deckungsgleiches `"ceiling"`-Segment; jedes
      `"ceiling"`-Segment liegt bei `y === GROUND_Y - CEILING_CLEARANCE`). Dann `LEVEL_FOUR` in
      `level/levelFour.ts` implementieren, bis alle Tests grün sind.

- [x] 9. Test für `LEVEL_REGISTRY`-Eintrag (rot) → Registry ergänzen (grün) (Bezug: US-1, Design
      "levelRegistry.ts")
      `levelRegistry.test.ts` um `"level-four"`-Fälle erweitern (enthalten,
      `getLevelById("level-four") === LEVEL_FOUR`). Dann Eintrag
      `{ id: "level-four", label: "Level 4 – Underground", level: LEVEL_FOUR }` in
      `levelRegistry.ts` ergänzen.

- [x] 10. Doku-Update `docs/06-level-design.md` (Bezug: Begleitende Doku-Updates in
       `requirements.md`)
       Kurzer Absatz, dass nun vier Level existieren, inkl. Level 4 (echtes
       Boden+Decke-Untergrund-Level, graue Stein-Tiles, SMB-1-2-Hintergrund).

- [x] 11. Manuelle Verifikation (Bezug: Design Test-Strategie "bewusst nicht unit-getestet")
       `npm run dev`, Level 4 auswählen: Korridor wirkt geschlossen (Boden+Decke durchgehend),
       Deckentiles wirken nicht wie invertierter Boden, normaler Sprung stößt nicht zwingend an
       die Decke, Hintergrund erinnert an SMB-1-2 (schwarz + grünes Backstein-Raster).

- [x] 12. Vollständiger Testlauf + Lint (Bezug: US-4 NFR)
       `npm test` und `npm run check` grün, bevor das Feature als abgeschlossen gilt.
