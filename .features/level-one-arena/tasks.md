# Tasks: Level-One-Arena (erstes Level + Phaser-Integration)

Bezug: `requirements.md` (US-1 bis US-9), `design.md`. Arbeitsweise: strikt
Rot-Grün-Refactor (siehe `AGENTS.md`) – jeder Task mit fachlicher Logik beginnt
mit einem fehlschlagenden Test.

## 0. Grundgerüst

- [ ] 0.1 Phaser-Dependency + Ordnerstruktur (Bezug: Design "Repo-/Modulstruktur")
      `phaser` zu `client/package.json` hinzufügen. Leere Ordner
      `client/src/game/{level,hazards,rules,state,control,world,scenes}`
      anlegen (noch ohne Code).
- [ ] 0.2 Assets übernehmen (Bezug: Design "Auswirkungen auf bestehenden Code")
      Terrain/Background/Fruits/Checkpoints/Traps (Saw, Spikes, Fire, Spiked
      Ball, Trampoline)/ein Charakter-Spritesheet aus
      `coin-quest-arena-tmp/public/assets` nach `client/public/assets/`
      kopieren (kein Code, kein Test nötig).

## 1. Level-Typen & Level-Eins-Daten (US-1)

- [ ] 1.1 `level/types.ts` implementieren (Bezug: Design "level/types.ts")
      `PlatformDef`, `CoinDef`, `HiddenCoinBlockDef`, `CheckpointDef`,
      `GoalDef`, `HazardInstanceDef`, `UtilityInstanceDef`, `LevelDef`,
      `FruitKind`, `FRUIT_VALUES`. Reine Typ-/Daten-Deklaration, kein Test
      nötig (siehe Design).
- [ ] 1.2 Test: `LEVEL_ONE`-Struktur erfüllt Größenvorgaben (Bezug: US-1,
      Design "levelOne.test.ts")
      Assertions gemäß Design (10–15 Coins, 3–5 Hidden Blocks, ≥2
      Checkpoints, alle 4 Hazard-Kinds vertreten, ≥1 Utility) schreiben
      (rot, `LEVEL_ONE` existiert noch nicht).
- [ ] 1.3 `level/levelOne.ts` implementieren (grün)
      Konkrete Level-Daten anlegen (angelehnt an das Prototyp-Level, aber
      ergänzt um `id`-Felder, Checkpoints, Hidden Blocks), Test aus 1.2 grün.

## 2. Pure Tile-Ableitung (US-4)

- [ ] 2.1 Test: `tileTypeAt` je Kategorie (Bezug: Design "level/tiles.ts")
      Für ein kleines Test-`LevelDef`-Fixture: Position innerhalb einer
      Plattform → `"solid"`; Position eines aktiven Hazards → `"hazard"`;
      Position eines unresolved Blocks → `"coinBlock"`; Ziel-Position →
      `"goal"`; freie Position → `"empty"` (rot).
- [ ] 2.2 Test: Priorität bei Überlappung (Bezug: Design "Fail-Fast-Kette")
      Aktiver Hazard auf einem Block/Ziel-Tile → `"hazard"` gewinnt (rot).
- [ ] 2.3 `tileTypeAt` implementieren (grün)
      Fail-Fast-Kette gemäß Design. Tests 2.1–2.2 grün.
- [ ] 2.4 Test: `buildNearbyTiles` Dimension & Zentrierung (Bezug: US-4)
      7×5-Fenster (Default) um einen Mittelpunkt liefert korrekte Maße, Racer
      steht in der Mitte des Fensters (rot).
- [ ] 2.5 `buildNearbyTiles` implementieren (grün)
      Test 2.4 grün.
- [ ] 2.6 Test: `buildDynamicTileState` leitet korrekt ab (Bezug: Design
      "Drift-Schutz")
      `resolvedBlockIds` entspricht 1:1 `racer.resolvedBlockIds`;
      `activeHazardIds` enthält alle nicht-getakteten Hazard-Kinds (schnetzler/
      stachlinger/kugelblitz) immer, `loderix` nur wenn `isTimedActive` true
      liefert (rot).
- [ ] 2.7 `buildDynamicTileState` implementieren (grün)
      Test 2.6 grün.

## 3. Hazard-Registry & Zeitverhalten (US-3, US-9)

- [ ] 3.1 `hazards/registry.ts` implementieren (Bezug: Design
      "hazards/registry.ts")
      `HAZARD_REGISTRY`, `UTILITY_REGISTRY`, `HazardSpec`, `UtilitySpec`,
      `HitboxSpec`, `HazardBehaviorKind` gemäß Design. Reine
      Konstanten-Deklaration, kein Test nötig (siehe Design).
- [ ] 3.2 Test: `patrolX` an Intervallgrenzen (Bezug: US-3, Design
      "hazards/behaviors.ts")
      Bei `elapsedMs=0` → Startposition; an der Hälfte der Periode →
      gegenüberliegender Umkehrpunkt; Position bleibt stets in
      `[minX, maxX]` (rot).
- [ ] 3.3 Test: `isTimedActive` mit `phaseMs`-Versatz (Bezug: US-3)
      Für `onMs=1500, offMs=1500, phaseMs=0`: aktiv in `[0,1500)`, inaktiv in
      `[1500,3000)`; mit `phaseMs=750` entsprechend verschoben (rot).
- [ ] 3.4 Test: `pendulumOffset` an Viertel-/Halbperiode (Bezug: US-3)
      Bei `elapsedMs=0` → Ruhelage (Auslenkung 0); bei einem Viertel der
      Periode → maximale Auslenkung (rot).
- [ ] 3.5 `hazards/behaviors.ts` implementieren (grün)
      `patrolX`, `isTimedActive`, `pendulumOffset` gemäß Design. Tests
      3.2–3.4 grün.

## 4. Racer-State & Spielregeln (US-3, US-5, das Herzstück)

- [ ] 4.1 Test: `createInitialRacerState` liefert korrekte Startwerte (Bezug:
      Design "racerState.ts")
      `lastCheckpoint` entspricht `level.spawn`, `livesRemaining === 3`,
      `isAlive === true`, alle Sets leer (rot, `racerState.ts` existiert noch
      nicht).
- [ ] 4.2 `rules/racerState.ts` implementieren (grün, Bezug: Design
      "rules/racerState.ts")
      `RacerRuntimeState`-Interface, `createInitialRacerState(level)` gemäß
      Design. Test aus 4.1 grün.
- [ ] 4.3 Test: `applyCoinPickup` erhöht Score/Coins (Bezug: US-3, Design
      "raceRules.ts")
      Coin mit `value=10` einsammeln → `coinsCollected+1`, `fruitScore+10`,
      `coinId` landet in `collectedCoinIds` (rot).
- [ ] 4.4 `applyCoinPickup` implementieren (grün)
- [ ] 4.5 Test: `applyBlockHit` markiert Block resolved (Bezug: US-2, US-3)
      `blockId` landet in `resolvedBlockIds`, sonstiger State unverändert
      (rot).
- [ ] 4.6 `applyBlockHit` implementieren (grün)
- [ ] 4.7 Test: `resolveHazardContact` alle Kombinationen (Bezug: US-3, Design)
      stompbar (`schnetzler`) + von oben → `"stomped"`; stompbar + seitlich →
      `"hit"`; nicht stompbar (`stachlinger`/`loderix`/`kugelblitz`), egal ob
      von oben → `"hit"`; `isActive=false` (nur relevant bei `loderix`) →
      `"none"` (rot).
- [ ] 4.8 `resolveHazardContact` implementieren (grün)
      Nutzt `HAZARD_REGISTRY[kind].stompable`. Tests 4.7 grün.
- [ ] 4.9 Test: `applyHazardContact("hit")` reduziert Leben + respawnt (Bezug:
      US-3)
      Position wird auf `state.lastCheckpoint` zurückgesetzt,
      `livesRemaining` sinkt um 1, `deaths+1` (rot).
- [ ] 4.10 Test: `applyHazardContact("stomped")` ändert Racer-State nicht
      (Bezug: US-3)
      `livesRemaining`/Position unverändert (rot).
- [ ] 4.11 Test: `applyHazardContact("hit")` bei `livesRemaining=1` (Bezug:
      US-3)
      Ergebnis: `livesRemaining=0`, `didNotFinish=true`, `isAlive=false`
      (rot).
- [ ] 4.12 `applyHazardContact` + private `loseLifeAndRespawn` implementieren
      (grün)
      Tests 4.9–4.11 grün.
- [ ] 4.13 Test: `applyPitFall` verhält sich wie `applyHazardContact("hit")`
      (Bezug: US-3)
      Gleiches Ergebnis-Muster wie 4.9 (rot).
- [ ] 4.14 `applyPitFall` implementieren (grün, nutzt `loseLifeAndRespawn`)
- [ ] 4.15 Test: `applyCheckpointReached` aktualisiert `lastCheckpoint` (Bezug:
      US-3)
      Neue Checkpoint-Position wird übernommen (rot).
- [ ] 4.16 `applyCheckpointReached` implementieren (grün)
- [ ] 4.17 Test: `applyGoalReached` setzt `finished=true` (Bezug: US-3)
      (rot)
- [ ] 4.18 `applyGoalReached` implementieren (grün)
- [ ] 4.19 Test: `applyTimeLimitReached` setzt `didNotFinish=true`, außer
      bereits `finished` (Bezug: US-3)
      Zwei Fälle: nicht `finished` → `didNotFinish=true`; bereits `finished`
      → unverändert (rot).
- [ ] 4.20 `applyTimeLimitReached` implementieren (grün)
      Anschließend Refactor-Pass über `raceRules.ts` (Duplikation prüfen,
      Benennung schärfen).

## 5. `BotState`-Building (US-4)

- [ ] 5.1 `state/worldSnapshot.ts` – `WorldSnapshot`-Typ (Bezug: Design
      "state/worldSnapshot.ts")
      Reine Typ-Deklaration, kein Test nötig.
- [ ] 5.2 Test: `buildBotState` – Basis-Felder 1:1 übernommen (Bezug: US-4)
      `position`, `facing`, `onGround`, `isAlive`, `coinsCollected`,
      `livesRemaining`, `timeElapsedMs`, `tick` entsprechen exakt den
      Eingabewerten (rot).
- [ ] 5.3 Test: `nearestCoin`/`nearestHazard`/`nearestUtility` – mehrere
      Kandidaten (Bezug: US-4)
      Bei mehreren Coins wird der nächstgelegene gewählt (Distanzvergleich);
      bei keinem Kandidaten → `null` (rot).
- [ ] 5.4 Test: `nearestHazard.active` spiegelt `dynamic`-Zustand (Bezug: US-4)
      Hazard, dessen ID in `dynamic.activeHazardIds` ist → `active: true`,
      sonst `false` (rot).
- [ ] 5.5 `botStateBuilder.ts` implementieren (grün, inkl. privater
      `nearestByDistance`-Helper)
      Tests 5.2–5.4 grün.

## 6. Scoring (US-5)

- [ ] 6.1 Test: `computeScore` – Ziel erreicht innerhalb Budget (Bezug: US-5)
      `reachedGoal=true`, `timeElapsedMs < TIME_BUDGET_MS` → positiver
      Zeitbonus im Ergebnis enthalten (rot).
- [ ] 6.2 Test: `computeScore` – Ziel erreicht nach Budget (Bezug: US-5)
      `timeElapsedMs > TIME_BUDGET_MS` → Zeitbonus 0, nicht negativ (rot).
- [ ] 6.3 Test: `computeScore` – DNF (Bezug: US-5)
      `reachedGoal=false` → `DNF_PENALTY` abgezogen, kein Zeitbonus (rot).
- [ ] 6.4 Test: `computeScore` – mehrere Tode + Rundung (Bezug: US-5)
      `deaths=2` → `2×DEATH_PENALTY` abgezogen; Ergebnis ist gerundete
      Ganzzahl (rot).
- [ ] 6.5 `scoring.ts` implementieren (grün)
      `SCORING`-Konstanten + `computeScore` gemäß Design. Tests 6.1–6.4 grün.

## 7. Steuerung: `RacerController` (US-6, US-7)

- [ ] 7.1 `control/RacerController.ts` – Interface (Bezug: Design)
      Reine Typ-Deklaration, kein Test nötig.
- [ ] 7.2 Test: `KeyboardController` – jede Tasten-Kombination (Bezug: US-6)
      links → `"left"`; rechts → `"right"`; Leertaste → `"jump"`; keine →
      `"idle"`; links+rechts gleichzeitig → definiertes Verhalten (z.B.
      links gewinnt) (rot).
- [ ] 7.3 `KeyboardController` implementieren (grün)
      Tests 7.2 grün.
- [ ] 7.4 Test: `BotController` delegiert an `BotRunner` (Bezug: US-7)
      Fake-`BotRunner` (aus `client/src/sandbox/testUtils/FakeWorker.ts`-
      Pattern oder ein einfacher Test-Double mit `tick`/`dispose`-Spies):
      `getNextAction` ruft `runner.tick(botState)` genau einmal auf und gibt
      dessen Ergebnis zurück; `dispose()` ruft `runner.dispose()` (rot).
- [ ] 7.5 `BotController` implementieren (grün)
      Tests 7.4 grün.

## 8. Phaser-Schicht (nicht unit-getestet, siehe Design)

- [ ] 8.1 `hazards/factory.ts` implementieren (Bezug: Design "factory.ts")
      Erzeugt Sprite+Arcade-Body aus `HazardInstanceDef`/`UtilityInstanceDef`
      + `HAZARD_REGISTRY`/`UTILITY_REGISTRY`, ruft pro Frame die passende
      Behavior-Funktion (`patrolX`/`isTimedActive`/`pendulumOffset`) auf.
- [ ] 8.2 `world/worldBuilder.ts` implementieren (Bezug: Design "worldBuilder.ts")
      Baut Terrain, Hintergrund, sichtbare Münzen, versteckte Blöcke (als
      Sprite mit Block-Textur), Checkpoints, Ziel, Hazards (via factory),
      Utilities (via factory) aus `LevelDef`.
- [ ] 8.3 `scenes/RaceScene.ts` implementieren (Bezug: Design "Ablauf/Sequenz")
      Orchestriert: `worldBuilder` beim Scene-Start, hält `RacerRuntimeState`,
      Tick-Loop (~150ms) ruft `botStateBuilder` + `RacerController` auf,
      wendet Action auf den Arcade-Body an, registriert Overlap-Callbacks
      (Coin/Block/Checkpoint/Hazard/Utility/Goal) die jeweils die passende
      `raceRules`-Funktion aufrufen und danach Sprites/State synchronisieren,
      prüft `RUN_TIME_LIMIT_MS` pro Frame (Zielkontakt-Overlap zuerst
      auswerten, siehe Design "Fehlerbehandlung & Edge Cases").
- [ ] 8.4 `ArenaView.tsx` implementieren (Bezug: Design "ArenaView.tsx")
      Mountet `Phaser.Game` mit `RaceScene` in einem Container-Element via
      `useEffect`, Props für Steuerungsmodus (`"keyboard" | "bot"`) und
      optionalen Bot-Quellcode; baut je nach Modus `KeyboardController` oder
      `BotController` (mit `createBrowserWorker`+`BotRunner` aus
      `bot-decide-api`) und übergibt ihn an die Szene.

## 9. `/dev`-Integration (US-8)

- [ ] 9.1 Test: `useArenaControls`-Hook (Bezug: US-6/US-7, Konsistenz mit
      bestehendem `useWebSocketConnection`-Muster)
      Analog zum bereits etablierten Hook-Pattern in diesem Projekt wird die
      Umschalt-/Auswahl-Logik (Modus `"keyboard" | "bot"`, ausgewählter
      Beispiel-Bot) in einen eigenen, testbaren Hook extrahiert – `DevPage`
      selbst bleibt dünn/präsentational (wie alle anderen Pages, siehe
      `.features/arena-hub-server/design.md`, "Bewusst ohne eigene
      Unit-Tests"-Liste). Tests: Moduswechsel `"keyboard"` → `"bot"` und
      zurück; Bot-Auswahl ändert den ausgewählten Eintrag; initialer Zustand
      ist `"keyboard"` mit keinem ausgewählten Bot (rot).
- [ ] 9.2 `client/src/game/control/useArenaControls.ts` implementieren (grün)
      Kleiner React-Hook (`useState`-basiert), keine Phaser-/DOM-Abhängigkeit.
      Test aus 9.1 grün.
- [ ] 9.3 Liste der Beispiel-Bots als Konstante (Bezug: KISS/YAGNI)
      Statt eines Verzeichnis-Listings (über einen reinen Static-File-Server
      nicht möglich) eine feste Konstante `EXAMPLE_BOTS: readonly string[]`
      mit den 12 bekannten Dateinamen aus `client/public/example-bots/`
      anlegen. Reine Daten, kein Test nötig.
- [ ] 9.4 `DevPage.tsx` erweitern (Bezug: Design "Auswirkungen auf
      bestehenden Code")
      `<ArenaView/>` einbinden, `useArenaControls` nutzen, UI zum Umschalten
      "Selbst spielen"/"Bot laufen lassen", Dropdown/Liste aus
      `EXAMPLE_BOTS` (Bot-Quellcode wird bei Auswahl per `fetch` aus
      `client/public/example-bots/<name>` geladen und an `ArenaView`
      durchgereicht), Anzeige von `BotRunner.pausedReason` falls gesetzt.
      Bestehender Broadcast-Test-Teil bleibt unverändert erhalten. Kein
      eigener Test nötig (dünnes Wiring, analog zu `AdminPage`/`PresentPage`).

## 10. Manuelle Verifikation & Abschluss

- [ ] 10.1 Manueller Verifikationsschritt gemäß Design durchführen
      Die vier in `design.md` (Test-Strategie) beschriebenen Schritte
      (Level lädt sichtbar; alle Hazard-/Utility-Interaktionen; Bot-Modus
      mit Beispiel-Bot; Zeitlimit-Fall) durchspielen, Ergebnis kurz
      dokumentieren (z.B. als Kommentar/Notiz in diesem Task).
- [ ] 10.2 Vollständigen Testlauf verifizieren
      `npm test` (Root) läuft grün für alle neuen Module; `npx biome check .`
      ohne Findings; `npm run build` läuft durch.
- [ ] 10.3 Abgleich gegen Akzeptanzkriterien
      Jedes Akzeptanzkriterium aus `requirements.md` (US-1 bis US-9) einem
      Test oder einer expliziten Design-Entscheidung zuordnen; Lücken
      benennen und schließen, bevor das Feature als abgeschlossen gilt.
