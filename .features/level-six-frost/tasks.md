# Tasks: Level-Six-Frost

Alle Tasks folgen dem verbindlichen Rot-Grün-Refactor-Zyklus (AGENTS.md, „Test-Driven
Development"). Kein Produktivcode ohne vorher geschriebenen, fehlschlagenden Test.

Ausnahme (keine sinnvolle Unit-Testbarkeit, im `design.md` unter „Test-Strategie" begründet):
Task 5 (prozeduraler Hintergrund, benötigt Canvas-Rendering) und Task 10 (Doku).

Test-Kommandos:
- gezielt: `npx vitest run client/src/game/level/levelSix.test.ts`
- gesamt: `npm test` (Workspace `server`, `client`, `packages/*`)

---

## Phase 1 – Level-Datenmodul (Kern)

- [x] **1. Testgerüst + Struktur-Invarianten schreiben (rot)**
      (Bezug: US-3, Design „Test-Strategie / A – Struktur-Invarianten")
      Neue Datei `client/src/game/level/levelSix.test.ts` nach dem Muster von
      `levelFive.test.ts`. Importiert `LEVEL_SIX` aus `./levelSix` (existiert noch nicht → rot).
      Prüft: 10–15 Früchte, 3–5 versteckte Blöcke, ≥ 3 Checkpoints, genau ein Spawn/Ziel,
      `worldHeight === 540`, `groundY === 500`, paarweise verschiedene IDs über alle
      Entitätslisten, Hazard-Kinds ⊆ bekannte Kinds, `ninjafrog`/`stachlinger`/`kugelblitz`
      je mindestens einmal und `loderix` genau zweimal sowie `spikehead` genau einmal,
      `backgroundKey === "ice"`, `terrainStyleKey === "ice"`, keine `kind: "ceiling"`-Plattform,
      alle Bodenlücken außerhalb der Frost-Gauntlet-Zone ≤ 190 px.

- [x] **2. `levelSix.ts` mit vollständigem Layout anlegen (grün)**
      (Bezug: US-1, US-2, US-3, Design „Layout" + „Entitäten" + „Frost-Gauntlet-Details")
      Neue Datei `client/src/game/level/levelSix.ts` mit `export const LEVEL_SIX: LevelDef`.
      Übernimmt exakt die Koordinaten aus `design.md`:
      - Bodensegmente G1 (0/20 Tiles), G2 (470/24), G3 (1014/68 – Frost-Gauntlet-Trägerplattform),
        G4 (2262/31); Alkove-Float (2320/6, y=240)
      - 12 Früchte, 4 versteckte Blöcke, 4 Checkpoints (u. a. `checkpoint-2` @ 1390,
        `checkpoint-3` @ 1950)
      - 6 Hazards: `ninjafrog-1`, `stachlinger-1`, `loderix-1` (x=1400, onMs=900, offMs=900,
        phaseMs=0), `loderix-2` (x=1784, onMs=900, offMs=900, phaseMs=900), `spikehead-1`
        (x=1864, originY=90, fallToY=484, triggerMinX=1804, triggerMaxX=1864, Default-Timings),
        `kugelblitz-1` (pivotX=2182, pivotY=250, length=140)
      - 1 Utility: `boingo-1` @ (2300, 486)
      Zusätzlich als exportierte, dokumentierte Konstanten (Muster `levelFive.ts`):
      `GROUND_Y`, `GAUNTLET_ZONE_MIN_X` (= `checkpoint-2.x` = 1390),
      `GAUNTLET_ZONE_MAX_X` (= `checkpoint-3.x` = 1950).
      Modul-Kommentar mit Timing-Herleitung (Kurzfassung aus `design.md`) und
      Sektionsübersicht wie in Level 3–5.
      Ziel: Tests aus Task 1 grün.

- [x] **3. Test: Frost-Gauntlet-Invariante (rot → grün)**
      (Bezug: US-2, Design „Test-Strategie / B", „Physik-/Timing-Grundlage")
      In `levelSix.test.ts` ergänzen, `isTimedActive` aus `../hazards/behaviors` importieren
      (echte Funktion, keine Neuimplementierung der Formel):
      - `onMs === offMs` für `loderix-1` und `loderix-2`
      - `loderix-2.phaseMs === loderix-1.phaseMs + (onMs + offMs) / 2` (mod Zykluslänge)
      - Property-Test über z. B. 200 gleichmäßig verteilte Zeitpunkte über zwei volle Zyklen:
        `isTimedActive(loderix-1, t) !== isTimedActive(loderix-2, t)` für jeden Zeitpunkt (echtes
        XOR)
      - `loderix-2.x − loderix-1.x` liegt im Bereich `[320·0.9, 320·1.8)` px (= Sprint-Tempo ×
        `Δ ∈ [900,1800)` ms, siehe Herleitung in `design.md`)
      - `spikehead-1.triggerMinX − loderix-2.x ≤ 40`
      - `spikehead-1.fallToY === GROUND_Y - 16`
      - `checkpoint-2.x === GAUNTLET_ZONE_MIN_X` liegt unmittelbar vor `loderix-1.x` (kleiner,
        Abstand ≤ 20 px); `checkpoint-3.x === GAUNTLET_ZONE_MAX_X` liegt unmittelbar nach
        `spikehead-1.triggerMaxX` (größer, Abstand ≤ 100 px)
      - zwischen `GAUNTLET_ZONE_MIN_X` und `GAUNTLET_ZONE_MAX_X` liegt kein Plattform-Wechsel und
        keine Lücke (ein einziges `PlatformDef` mit `kind !== "float"`/`"ceiling"` deckt
        `[GAUNTLET_ZONE_MIN_X, GAUNTLET_ZONE_MAX_X]` durchgehend ab)
      Erwartung: mit dem Layout aus Task 2 direkt grün – schlägt ein Kriterium fehl, wird die
      **Geometrie** in `levelSix.ts` korrigiert, nicht das Kriterium.

## Phase 2 – Frost-Theming

- [x] **4. Test + Eintrag für `ice`-Terrain-Style (rot → grün)**
      (Bezug: US-1, Design „Theming")
      Zuerst in `client/src/game/world/terrainStyleRegistry.test.ts`: `ice` existiert, `tint`
      ist eine endliche Zahl, Farbe ist kühl (`b > r` und `b > g`) → rot.
      Dann in `terrainStyleRegistry.ts`: `ice: { tint: 0xDCEEFF }` (kein `frames`, bewusst das
      bestehende `TERRAIN_TILES`-Set) → grün.

      **Nachtrag (nach Task 11, manuelle Abnahme):** Ein reiner Tint auf `TERRAIN_TILES` sah
      trotz hellem Wert weiterhin nach Wiese aus (multiplikatives `setTint` kann Grün nicht
      neutralisieren). Test erweitert um `frames`-Erwartung (rot) → Eintrag auf
      `{ frames: STONE_TERRAIN_TILES, tint: 0xeaf6ff }` umgestellt (grün), analog zu
      `underground`. Siehe `requirements.md`/„Nachträgliche Korrektur" und `design.md`/„Theming".

- [x] **5. `buildIceStyleBackgroundTexture` implementieren (ohne Unit-Test)**
      (Bezug: US-1, Design „Theming")
      In `client/src/game/world/proceduralBackgrounds.ts` nach dem Muster von
      `buildDesertStyleBackgroundTexture`: Textur-Key `bg-ice-${worldHeight}` (idempotent
      gecacht), `TILE_W = 512`, Texturhöhe = `worldHeight`.
      Inhalt: 6-Band-Kaltverlauf `0x6FB7E0 → 0xEFFBFF`, blasse Wintersonne `0xF3FBFF` bei
      `(400, worldHeight · 0,2)` mit schwachem Halo, drei gestaffelte Berg-Silhouetten
      (`0xB2D6ED`/`0xC7E3F2`/`0xDCEFFA`, hinterste am hellsten), Handvoll statischer
      Schneeflocken-Punkte `0xFFFFFF`.
      Deterministisch, keine Laufzeit-Zufälligkeit. Kommentar mit Verweis auf dieses Spec.

- [x] **6. `ice` in `backgroundRegistry.ts` registrieren**
      (Bezug: US-1, Design „Theming")
      Import ergänzen, Eintrag
      `ice: { kind: "procedural", buildTexture: buildIceStyleBackgroundTexture }`.
      Reine Konstanten-Deklaration ohne Verzweigung → kein eigener Test (wie im Bestand).

## Phase 3 – Registrierung & Verfügbarkeit

- [x] **7. Test: `level-six` in der Level-Registry (rot)**
      (Bezug: US-4, Design „Registrierung")
      In `client/src/game/level/levelRegistry.test.ts`: `level-six` ist in `LEVEL_REGISTRY`
      enthalten, Label nicht leer, `getLevelById("level-six") === LEVEL_SIX`,
      `DEFAULT_LEVEL_ID` bleibt `"level-one"`. Die bestehenden Zwei-Wege-Konsistenztests gegen
      `LEVEL_IDS` greifen automatisch mit.

- [x] **8. Registrierung in Client und Shared vornehmen (grün)**
      (Bezug: US-4)
      `client/src/game/level/levelRegistry.ts`: Import `LEVEL_SIX` + Eintrag
      `{ id: "level-six", label: "Level 6 – Frost", level: LEVEL_SIX }` nach `level-five`.
      `packages/shared/src/levels.ts`: `"level-six"` in `LEVEL_IDS` vor `"toolkit-test"`.
      Falls vorhanden: `packages/shared/src/levels.test.ts` testgetrieben um `level-six` ergänzen
      (erst Test, dann Wert).
      Verifikation: Level 6 erscheint ohne weitere Codeänderung in `DevPage`, `PresentPage`,
      `StageLevelEditor`, `TournamentSetup`. `tournament/stageLevelList.ts` wird **nicht**
      verändert (Level 6 ist verfügbar, aber keine Voreinstellung).

## Phase 4 – Abschluss

- [x] **9. `docs/06-level-design.md` ergänzen**
      (Bezug: US-1–US-4)
      Level-6-Abschnitt in der Level-Übersicht nach dem Muster der Level-1–5-Einträge: Thema
      Eis/Schnee, Frost-Gauntlet-Timing-Puzzle (Loderix-Duo im Gegentakt + Spikehead),
      Schwierigkeitsgrad mittel, Verweis auf `.features/level-six-frost/`.

- [x] **10. Gesamt-Testlauf, Lint/Typecheck und Refactoring**
      `npm test` (alle Workspaces) sowie `npm run check` müssen grün sein (ggf. vorbestehende,
      unabhängige Fehler wie bei Level 5 dokumentieren, nicht verdecken). Anschließend
      Refactoring bei grünen Tests: Duplikate in `levelSix.test.ts` zusammenfassen, Kommentare in
      `levelSix.ts` auf Verständlichkeit prüfen, keine Magic Numbers ohne benannte Konstante oder
      erklärenden Kommentar (insb. die Frost-Gauntlet-Zahlen mit Verweis auf die Herleitung in
      `design.md`).

      Ergebnis:
      - `npx vitest run`: 78 Testdateien, 743 Tests, alle grün (inkl. `levelSix.test.ts` mit 20
        Tests und dem Anti-Phasen-Property-Test).
      - `npx tsc -p client/tsconfig.json --noEmit`: keine Typfehler.
      - `npm run check` (Biome) auf dem Gesamt-Repo zeigt ausschließlich CRLF-Formatierungs-
        abweichungen in **vorbestehenden, nicht angefassten** Dateien (Windows-Checkout,
        `core.autocrlf=true`) – exakt dieselbe, bereits bei Level 5 dokumentierte Umgebungs-
        eigenheit, keine Regression. Gezielt gegen `levelSix.ts`/`levelSix.test.ts` geprüft: ein
        echter Formatierungs-Hinweis (zu lange Zeile) gefunden und behoben, danach `npx biome
        check` auf beiden Dateien sauber.

- [ ] **11. Manuelle Abnahme am Dev-Stand**
      (Bezug: Design „Test-Strategie / Manuelle Abnahme")
      `/dev` mit Level 6 und einem Beispiel-Bot starten: Eis-Optik (Verlauf, Wintersonne, Berge,
      Eisblau-Terrain) prüfen; Frost-Gauntlet einmal gut getimt durchsprinten (soll ohne
      Anhalten klappen); danach bewusst in der Spikehead-Trigger-Zone stehen bleiben (soll vom
      fallenden Kopf getroffen werden); Alkove per Boingo besuchen; Respawn an `checkpoint-2`
      bzw. `checkpoint-3` nach einem Fehlversuch prüfen.

- [x] **12. Abgleich gegen `requirements.md`**
      Alle Akzeptanzkriterien aus US-1 bis US-4 einzeln durchgehen und die Erfüllung (Testname
      bzw. manuelle Prüfung aus Task 11) zuordnen. Abweichungen dokumentieren.

      Ergebnis:
      - **US-1 Frost-Look:** Hintergrund (`buildIceStyleBackgroundTexture`, manuell abgenommen)
        und Terrain-Einfärbung erfüllt – mit der dokumentierten Korrektur auf
        `STONE_TERRAIN_TILES` statt `TERRAIN_TILES` (siehe „Nachträgliche Korrektur" oben).
        Fail-Fast/Default-Verhalten und Regressionsschutz für Level 1-5 unverändert (alle
        bestehenden Level-Tests weiterhin grün).
      - **US-2 Frost-Gauntlet:** alle Akzeptanzkriterien 1:1 durch `levelSix.test.ts`, Describe-
        Block „frost gauntlet timing invariant" abgedeckt (Anti-Phasen-Beweis per Property-Test,
        Distanz-/Timing-Fenster, Trigger-Zonen-Abstand, `fallToY`, Checkpoints, durchgehende
        Trägerplattform).
      - **US-3 Struktur-Vorgaben:** durch `levelSix.test.ts`, Describe-Blöcke „structure" und
        „gaps" abgedeckt (12 Früchte, 4 Blöcke, 4 Checkpoints, eindeutige IDs, bekannte
        Hazard-Kinds inkl. Pflicht-Kinds, Lücken ≤ 190 px – tatsächlich sogar ≤ 160 px). Die
        optionale Boingo-Alkove ist durch Konstruktion nicht zielkritisch (kein Pflichtpfad
        führt hindurch) und manuell bestätigt.
      - **US-4 Auswählbarkeit:** durch `levelRegistry.test.ts` und `packages/shared/src/
        levels.test.ts` abgedeckt (Registry-Eintrag, Zwei-Wege-Konsistenz mit `LEVEL_IDS`,
        `isValidLevelId`). Dev-Station/Präsentation/Turnier-Stage-Editor speisen sich generisch
        aus `LEVEL_REGISTRY`, keine weitere Codeänderung nötig (Muster wie bei Level 5).
        `tournament/stageLevelList.ts` nicht angefasst – Level 6 keine Default-Stage.
      - Keine offenen Abweichungen. Gesamt-Testlauf nach Merge mit Upstream (Tournament-Show-Flow):
        840 Tests, 104 Dateien, alle grün.
