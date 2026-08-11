# Tasks: Level-Five-Desert

Alle Tasks folgen dem verbindlichen Rot-Grün-Refactor-Zyklus (AGENTS.md, „Test-Driven
Development"). Kein Produktivcode ohne vorher geschriebenen, fehlschlagenden Test.

Ausnahmen (keine sinnvolle Unit-Testbarkeit, im `design.md` unter „Test-Strategie" begründet):
Task 6 (prozeduraler Hintergrund, benötigt Canvas-Rendering) und Task 11 (Doku).

Test-Kommandos:
- gezielt: `npx vitest run client/src/game/level/levelFive.test.ts`
- gesamt: `npm test` (Workspace `server`, `client`, `packages/*`)

---

## Phase 1 – Level-Datenmodul (Kern)

- [x] **1. Testgerüst + Struktur-Invarianten schreiben (rot)**
      (Bezug: US-4, Design „Test-Strategie / A – Struktur-Invarianten")
      Neue Datei `client/src/game/level/levelFive.test.ts` nach dem Muster von
      `levelFour.test.ts`. Importiert `LEVEL_FIVE` aus `./levelFive` (existiert noch nicht →
      rot). Prüft: 10–15 Früchte, 3–5 versteckte Blöcke, ≥ 3 Checkpoints, genau ein Spawn/Ziel,
      `worldHeight === 540`, `groundY === 500`, `worldWidth` in [2500, 3500], paarweise
      verschiedene IDs über alle Entitätslisten, Hazard-Kinds ⊆ bekannte Kinds, kein
      `kugelblitz`, ≤ 1 `spikehead`, `backgroundKey === "desert"`,
      `terrainStyleKey === "desert"`, keine `kind: "ceiling"`-Plattform.

- [x] **2. `levelFive.ts` mit vollständigem Layout anlegen (grün)**
      (Bezug: US-2, US-3, US-4, Design „Layout" + „Entitäten")
      Neue Datei `client/src/game/level/levelFive.ts` mit `export const LEVEL_FIVE: LevelDef`.
      Übernimmt exakt die Koordinatentabellen aus `design.md`:
      Bodensegmente G1–G5, Kettenplattformen K1–K3 (y = 200), Hochroute H1–H4 (y = 330),
      13 Früchte, 4 versteckte Blöcke, 4 Checkpoints, 6 Hazards, 3 Boingos.
      Zusätzlich als exportierte, dokumentierte Konstanten (Muster `levelFour.ts`
      `CLEARANCE_*`): `GROUND_Y`, `CHAIN_Y`, `HIGH_ROUTE_Y`, `CHASM_MIN_X`, `CHASM_MAX_X`.
      Modul-Kommentar mit Physik-Herleitung und Sektionsübersicht wie in Level 3/4.
      Ziel: Tests aus Task 1 grün.

- [x] **3a. `BOINGO_JUMP_VELOCITY` nach `MOVEMENT_TUNING` extrahieren (rot → grün)**
      (Bezug: US-2, Design „Physik-Grundlage"; Entscheidung des Users: Variante B –
      eine Quelle der Wahrheit statt gespiegelter Konstante im Test)
      Aktuell liegt `BOINGO_JUMP_VELOCITY = -820` modul-privat in
      `client/src/game/scenes/RaceScene.ts:62` und ist für einen Phaser-freien Daten-Test nicht
      importierbar. Ohne Extraktion müsste `levelFive.test.ts` den Wert duplizieren – die
      Level-Geometrie würde stillschweigend falsch, sobald jemand die Sprungkraft ändert.
      Vorgehen:
      1. In `client/src/game/movement/movement.test.ts` (bzw. neu, falls nicht vorhanden) einen
         Test ergänzen, der `MOVEMENT_TUNING.BOINGO_JUMP_VELOCITY === -820` erwartet → rot.
      2. Feld `BOINGO_JUMP_VELOCITY: -820` in `MOVEMENT_TUNING` (`movement/movement.ts`)
         aufnehmen, mit Kommentar analog zu `BASE_JUMP_VELOCITY` (negativ = nach oben) → grün.
      3. `RaceScene.ts`: modul-private Konstante entfernen, Verwendungsstelle (Zeile ~713) auf
         `MOVEMENT_TUNING.BOINGO_JUMP_VELOCITY` umstellen.
      Regressionsschutz: `STOMP_BOUNCE_VELOCITY` bleibt unangetastet; das Boingo-Verhalten ändert
      sich nicht (identischer Wert), bestehende Tests müssen unverändert grün bleiben.
      Prüfen, ob `state/botStateBuilder.ts` den Wert in die Bot-Sicht aufnehmen sollte – **nein**,
      das wäre eine Bot-API-Änderung und ist laut Requirements ein Nicht-Ziel.

- [x] **3b. Physik-Helper für die Testberechnung schreiben (rot → grün)**
      (Bezug: US-2, Design „Physik-Grundlage")
      In `levelFive.test.ts` lokale, reine Hilfsfunktionen, die die Landefenster ausschließlich
      aus `MOVEMENT_TUNING` (inkl. `BOINGO_JUMP_VELOCITY` aus Task 3a) **berechnen** statt sie
      als Magic Numbers zu hinterlegen:
      `boingoRangeForRise(rise, speed)` (zweite Parabel-Nullstelle, da `float`-Plattformen
      jump-through sind) und `fallDrift(drop, speed)`.
      Sanity-Test: `boingoRangeForRise(0, 320) ≈ 583`, `boingoRangeForRise(300, 200) ≈ 263`,
      `fallDrift(300, 320) ≈ 261`.
      Kein hartkodierter Geschwindigkeits- oder Gravitationswert im Test.

- [x] **4. Test: Großer Graben & Trampolin-Kette (rot → grün)**
      (Bezug: US-2, Design „Test-Strategie / B")
      In `levelFive.test.ts` ergänzen: genau eine Bodenlücke > 1000 px und alle übrigen ≤ 160 px;
      ≥ 3 `float`-Plattformen vollständig innerhalb des Grabens; je Kettenplattform
      `235 < groundY − y ≤ 340`; je Ketten-Boingo überdeckt die nächste Kettenplattform das
      komplette Landefenster (via Helper aus Task 3); Einstiegs-Boingo liegt auf dem
      Bodensegment direkt vor dem Graben; jede Kettenplattform mit Folge-Hop trägt genau ein
      `boingo` mit `y === plattformY − 14`; die letzte Kettenplattform trägt kein Boingo und die
      Falldrift landet bei Basis- wie Sprinttempo im ersten Bodensegment hinter dem Graben;
      Checkpoint auf dem Bodensegment unmittelbar vor dem Graben vorhanden.
      Erwartung: mit dem Layout aus Task 2 direkt grün – schlägt ein Kriterium fehl, wird die
      **Geometrie** korrigiert, nicht das Kriterium.

- [x] **5. Test: Zwei parallele Routen (rot → grün)**
      (Bezug: US-3, Design „Test-Strategie / C")
      Ergänzen: Hochroute bildet eine zusammenhängende Kette mit Parallelstrecke ≥ 600 px;
      Einstiegshöhe ≤ 200 px über `groundY`; Lücken zwischen Hochrouten-Plattformen ≤ 249 px;
      letzte Hochrouten-Plattform endet horizontal über einem Bodensegment (Rückmündung);
      `FRUIT_VALUES`-Summe Hochroute > Summe parallele Bodenstrecke (Ketten-Früchte ausgenommen);
      Hazard-Anzahl Hochroute ≥ Hazard-Anzahl parallele Bodenstrecke;
      Bodenroute führt allein bis zum Ziel (nur zulässige Sprunglücken).

## Phase 2 – Wüsten-Theming

- [x] **6. `buildDesertStyleBackgroundTexture` implementieren (ohne Unit-Test)**
      (Bezug: US-1, Design „Theming")
      In `client/src/game/world/proceduralBackgrounds.ts` nach dem Muster von
      `buildNightStyleBackgroundTexture`: Textur-Key `bg-desert-${worldHeight}` (idempotent
      gecacht), `TILE_W = 512`, Texturhöhe = `worldHeight`.
      Inhalt: 6-Band-Warmverlauf `0xF2C14E → 0xF7E1A0`, Sonnenscheibe `0xFFF3C4` bei
      `(400, worldHeight · 0,22)` mit Halo, drei gestaffelte Dünen-Ellipsen
      (`0xD9A441`/`0xC98F35`/`0xB87B2A`), zwei Kaktus-Silhouetten `0x8A6A2A`.
      Deterministisch, keine Laufzeit-Zufälligkeit. Kommentar mit Verweis auf dieses Spec und
      auf die Begründung, warum die Texturhöhe exakt `worldHeight` sein muss.

- [x] **7. `desert` in `backgroundRegistry.ts` registrieren**
      (Bezug: US-1, Design „Theming")
      Import ergänzen, Eintrag
      `desert: { kind: "procedural", buildTexture: buildDesertStyleBackgroundTexture }`.
      Reine Konstanten-Deklaration ohne Verzweigung → kein eigener Test (wie im Bestand).

- [x] **8. Test + Eintrag für `desert`-Terrain-Style (rot → grün)**
      (Bezug: US-1, Design „Theming")
      Zuerst in `client/src/game/world/terrainStyleRegistry.test.ts`: `desert` existiert, `tint`
      ist eine endliche Zahl, Farbe ist warm (`r > b` und `g > b`) → rot.
      Dann in `terrainStyleRegistry.ts`: `desert: { tint: 0xE8C27A }` (kein `frames`, bewusst das
      bestehende `TERRAIN_TILES`-Set) → grün.

## Phase 3 – Registrierung & Verfügbarkeit

- [x] **9. Test: `level-five` in der Level-Registry (rot)**
      (Bezug: US-5, Design „Registrierung")
      In `client/src/game/level/levelRegistry.test.ts`: `level-five` ist in `LEVEL_REGISTRY`
      enthalten, Label nicht leer, `getLevelById("level-five") === LEVEL_FIVE`,
      `DEFAULT_LEVEL_ID` bleibt `"level-one"`. Die bestehenden Zwei-Wege-Konsistenztests gegen
      `LEVEL_IDS` greifen automatisch mit.

- [x] **10. Registrierung in Client und Shared vornehmen (grün)**
      (Bezug: US-5)
      `client/src/game/level/levelRegistry.ts`: Import `LEVEL_FIVE` + Eintrag
      `{ id: "level-five", label: "Level 5 – Desert", level: LEVEL_FIVE }` nach `level-four`.
      `packages/shared/src/levels.ts`: `"level-five"` in `LEVEL_IDS` vor `"toolkit-test"`.
      Prüfen, ob es einen Shared-Test für `isValidLevelId` gibt; falls ja, dort `level-five`
      testgetrieben ergänzen (erst Test, dann Wert).
      Verifikation: Level 5 erscheint ohne weitere Codeänderung in `DevPage`, `PresentPage`,
      `StageLevelEditor`, `TournamentSetup`. `tournament/stageLevelList.ts` wird **nicht**
      verändert (Level 5 ist verfügbar, aber keine Voreinstellung).

## Phase 4 – Abschluss

- [x] **11. `docs/06-level-design.md` ergänzen**
      (Bezug: US-1–US-5)
      Level-5-Abschnitt in der Level-Übersicht (aktuell Zeilen ~49–80) nach dem Muster der
      Level-1–4-Einträge: Thema Wüste, Großer Graben mit Trampolin-Kette, zwei parallele Routen,
      Schwierigkeitsgrad leicht bis mittel, Verweis auf `.features/level-five-desert/`.

- [x] **12. Gesamt-Testlauf, Lint/Typecheck und Refactoring**
      `npm test` (alle Workspaces) sowie der im Projekt etablierte Lint-/Typecheck-Befehl müssen
      grün sein. Anschließend Refactoring bei grünen Tests: Duplikate in `levelFive.test.ts`
      zusammenfassen, Kommentare in `levelFive.ts` auf Verständlichkeit prüfen, keine
      Magic Numbers ohne benannte Konstante oder erklärenden Kommentar.

      Ergebnis:
      - `npm run build` erfolgreich durchgelaufen.
      - `npx vitest run --exclude "server/src/http/createStaticServer.test.ts"`: 717 Tests
        passed, keine neuen Fehler in meinen Dateien.
      - `npm run check`: Alle auf meinen neuen/geänderten Dateien verbleibenden Format-Fehler
        durch `npx biome format --write` behoben. Verbleibende Lint-Fehler in
        `AudioControls.tsx`, `ScoreHud.tsx`, `BotUploadForm.tsx`, `TournamentService.test.ts`
        und `RaceScene.ts:736` (Format-Rest eines fremden Codeblocks) existierten bereits vor
        dieser Feature-Implementierung und wurden nicht verändert.
      - `server/src/http/createStaticServer.test.ts` schlägt mit `EPERM` auf `0.0.0.0` fehl;
      das ist eine Umgebungsbeschränkung dieser Shell ohne Relation zum Feature.

- [ ] **13. Manuelle Abnahme am Dev-Stand**
      (Bezug: Design „Test-Strategie / Manuelle Abnahme")
      `/dev` mit Level 5 und einem Beispiel-Bot starten: Wüsten-Optik (Verlauf, Sonne, Dünen,
      Sandton-Terrain) prüfen; Trampolin-Kette einmal durchspielen (Einstieg, zwei Hops,
      Ausstieg per Herunterlaufen); Hochroute betreten und die Rückmündung auf die Bodenroute
      prüfen; Respawn nach Absturz in den Graben kontrollieren.

- [ ] **14. Abgleich gegen `requirements.md`**
      Alle Akzeptanzkriterien aus US-1 bis US-5 einzeln durchgehen und die Erfüllung
      (Testname bzw. manuelle Prüfung aus Task 13) zuordnen. Abweichungen dokumentieren.
