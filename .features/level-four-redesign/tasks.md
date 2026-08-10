# Tasks: Level-Four-Redesign

Reihenfolge: erst Farbschema (klein, isoliert), dann Layout (groß). Jeder Task folgt
Rot → Grün → Refactor; Tasks ohne sinnvollen Unit-Test sind explizit als "manuell verifiziert"
markiert.

## Farbschema (US-1)

- [ ] 1. **Test: Terrain-Style `underground` ist blau (rot)** (Bezug: US-1, Design
      "Farbschema")
      In `world/terrainStyleRegistry.test.ts` ergänzen: Eintrag `underground` hat `frames`
      **und** `tint`; der Tint-Wert ist blau im Sinne von Blau-Kanal > Rot-Kanal und
      Blau-Kanal > Grün-Kanal.

- [ ] 2. **Blau-Tint in der Registry ergänzen (grün)** (Bezug: US-1)
      `world/terrainStyleRegistry.ts`: `underground: { frames: STONE_TERRAIN_TILES, tint:
      0x4a8cff }`. Kommentar zur multiplikativen Tint-Wirkung ergänzen.

- [ ] 3. **Hintergrund auf reines Schwarz umstellen** (Bezug: US-1, Design "Farbschema") –
      *manuell verifiziert, kein Unit-Test (Canvas-Rendering)*
      `world/proceduralBackgrounds.ts`: `buildUndergroundStyleBackgroundTexture` malt nur noch
      die schwarze Grundfläche. `drawBrickGrid()` sowie `UNDERGROUND_BRICK_COLOR`,
      `UNDERGROUND_MORTAR_COLOR`, `BRICK_W`, `BRICK_H`, `MORTAR_THICKNESS` ersatzlos entfernen.
      Doc-Kommentar der Funktion an das neue Verhalten anpassen.

## Level-Geometrie (US-2, US-3, US-4, US-5)

- [ ] 4. **Test: Decken-Struktur (rot)** (Bezug: US-3, Design "Level-Geometrie")
      `level/levelFour.test.ts`: alte Ceiling-Tests ("deckungsgleich zum Boden", "konstante
      Höhe") entfernen. Neu:
      - Ceiling-Segmente decken `[0, worldWidth]` lückenlos und überlappungsfrei ab.
      - Jedes Ceiling-`y` ∈ `{GROUND_Y − CLEARANCE_LOW/_NORMAL/_HIGH}`, alle drei kommen vor.
      - `CLEARANCE_NORMAL >= 235 + 32` (Sprint-Sprung passt darunter).
      - `CLEARANCE_LOW < 174 + 32` (Springen wirkungslos).

- [ ] 5. **Sektions-Geometrie implementieren (grün)** (Bezug: US-3)
      `level/levelFour.ts`: `CEILING_CLEARANCE` durch `CLEARANCE_LOW/_NORMAL/_HIGH` ersetzen,
      `worldWidth: 2800`, 7 Ceiling-Segmente und 6 Ground-Segmente gemäß Design-Tabellen setzen.

- [ ] 6. **Test: Lücken-Vielfalt und Schwierigkeit (rot)** (Bezug: US-2, US-4)
      Lücken-Test von "≤128px" auf "≤170px" ändern und ergänzen: mindestens 3 verschiedene
      Lückenbreiten. Neu: `LEVEL_THREE.hazards.length < LEVEL_FOUR.hazards.length <=
      LEVEL_TWO.hazards.length`.

- [ ] 7. **Test: Solvability der Kriechzonen (rot)** (Bezug: US-3)
      Über keiner LOW-Zone liegt (a) eine Boden-Lücke, (b) eine Float-Plattform, (c) ein Hazard
      mit `kind !== "loderix"`.

- [ ] 8. **Test: Stalaktiten-Verankerung + Hazard-Inventar (rot)** (Bezug: US-2, US-3)
      - Jeder `spikehead`: `originY` liegt unter der Decken-Unterkante seiner Sektion und
        höchstens 32px darunter; `fallToY` auf Bodenhöhe; Trigger-Zone über einem Boden-Segment.
      - `LEVEL_FOUR` enthält ≥1 `ninjafrog`; `LEVEL_ONE/TWO/THREE` enthalten keinen.
      - `LEVEL_FOUR` enthält keinen `kugelblitz`.

- [ ] 9. **Hazards platzieren (grün)** (Bezug: US-2, US-3, US-4)
      Die 8 Hazards aus der Design-Tabelle in `levelFour.ts` eintragen.

- [ ] 10. **Test: Anti-Klon gegen Level 3 (rot)** (Bezug: US-2)
      Die Folge der `[x, tilesWide]`-Paare der Boden-Segmente unterscheidet sich von der aus
      `LEVEL_THREE`; keine Hazard-`x`-Position aus `LEVEL_FOUR` kommt in `LEVEL_THREE` vor.

- [ ] 11. **Test: Träger für Sammelobjekte erweitern (rot)** (Bezug: US-5)
      Bestehenden "über Boden"-Test so anpassen, dass auch Float-Plattformen als Träger gelten
      (für die Alkoven- und Obere-Route-Münzen).

- [ ] 12. **Münzen, Blöcke, Checkpoints, Floats und Boingo setzen (grün)** (Bezug: US-2, US-5)
      14 Münzen, 4 versteckte Blöcke, 4 Checkpoints, 4 Float-Plattformen, 1 Boingo, Spawn und
      Ziel gemäß Design.

- [ ] 13. **Refactor + Doku im Level-Modul** (Bezug: alle)
      Header-Kommentar von `levelFour.ts` neu schreiben: Sektionsübersicht, korrigierte
      Sprunghöhen (174 / 235 / 374px), Begründung der drei Deckenhöhen. Test-Datei aufräumen
      (gemeinsame Helper für Ground-/Ceiling-/Float-Filter).

- [ ] 14. **Gesamtlauf grün** (Bezug: alle)
      `npm test` und Lint/Typecheck im `client`-Package fehlerfrei; keine verwaisten Imports
      (`CEILING_CLEARANCE`).

- [ ] 15. **Doku aktualisieren** (Bezug: US-1, US-3)
      `docs/06-level-design.md`: Level-4-Beschreibung um Kriechgänge, variable Korridorhöhe und
      das SMB-1-2-Farbschema ergänzen.

- [ ] 16. **Manuelle Verifikation im Dev-Modus** (Bezug: US-1, US-3, Design "Test-Strategie")
      `npm run dev`, Level 4: schwarzer Hintergrund, blaue Blöcke, Kriechgänge als Tunnel
      lesbar, Loderix dort nicht überspringbar, Boingo trägt bis zur Alkove F4, kein Kopfstoß
      bei Sprint-Sprüngen in normalen Passagen.
