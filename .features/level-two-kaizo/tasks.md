# Tasks: Level-Two-Kaizo

Bezug: `.features/level-two-kaizo/requirements.md`, `.features/level-two-kaizo/design.md`.
Reihenfolge = Abhängigkeitsreihenfolge (pure Bausteine zuerst, Wiring zuletzt). Jeder
Test-Task wird VOR dem zugehörigen Implementierungs-Task rot geschrieben (TDD-Pflicht laut
AGENTS.md).

- [x] 1. `HazardKind` um `"spikehead"` erweitern (Bezug: US-3, Design "@arena/bot-contract")
      `packages/bot-contract/src/hazards.ts` – rein additiver Union-Wert, kein eigener Test
      nötig (reine Typ-Deklaration).

- [x] 2. Test für `spikeheadState` (rot) (Bezug: US-3, Design "hazards/behaviors.ts")
      `hazards/behaviors.test.ts`: alle vier Phasen (idle/warning/falling/resting) +
      Rückkehr zu idle nach vollem Zyklus, inkl. Grenzwerte an Phasenübergängen.
- [x] 3. `spikeheadState` implementieren (grün) + `HAZARD_DEFAULTS.spikehead`
      `hazards/behaviors.ts`, `hazards/registry.ts` (Defaults).

- [x] 4. Registry-Erweiterung: `HazardBehaviorKind "trigger"`, `tint`-Feld, `spikehead`-Eintrag
      (Bezug: US-3, Design "hazards/registry.ts")
      `hazards/registry.ts` – reine Konstanten, kein Test nötig (siehe design.md
      Test-Strategie).

- [x] 5. `HazardInstanceDef`-Union um `spikehead`-Variante erweitern (Bezug: US-2/US-3, Design
      "level/types.ts")
      `level/types.ts` – reine Typ-Erweiterung, kein eigener Test.

- [x] 6. Test für `applyHazardTriggered` (rot) (Bezug: US-3, Design "rules/raceRules.ts")
      `rules/raceRules.test.ts`: setzt/überschreibt Zeitstempel für eine Hazard-ID, lässt
      andere IDs unverändert.
- [x] 7. `RacerRuntimeState.hazardTriggeredAtMs` + `applyHazardTriggered` implementieren (grün)
      `rules/racerState.ts` (+Feld, +Init), `rules/raceRules.ts` (+Funktion).

- [x] 8. Test für `isHazardActive`/`buildDynamicTileState` mit Spikehead (rot) (Bezug: US-3,
      Design "level/tiles.ts")
      `level/tiles.test.ts`: Spikehead aktiv/inaktiv je nach `hazardTriggeredAtMs`+`elapsedMs`;
      `tileTypeAt` verortet aktiven Spikehead an `(x, fallToY)`.
- [x] 9. `tiles.ts` anpassen (grün): `DynamicStateSource` (vorher `ResolvedBlocksSource`),
      `isHazardActive` mit drittem Parameter, `tileTypeAt`-Spikehead-Fall.
      Aufrufer (`RaceScene`) entsprechend angepasst (kompiliert weiterhin).

- [x] 10. Test für `LEVEL_TWO`-Struktur (rot) (Bezug: US-2, Design "level/levelTwo.ts")
      `level/levelTwo.test.ts`: Münzen-/Block-/Checkpoint-Anzahl, alle 5 Hazard-Kinds,
      Gegner-Cluster (≥3 Schnetzler auf einer Plattform), mind. eine Lücke >150px, mind. ein
      Spikehead.
- [x] 11. `LEVEL_TWO`-Daten implementieren (grün)
      `level/levelTwo.ts` – vollständiges, spielbares Level gemäß design.md.

- [x] 12. Test für `LEVEL_REGISTRY`/`getLevelById` (rot) (Bezug: US-1, Design
      "Level-Registry")
      `level/levelRegistry.test.ts`: enthält beide Level-IDs mit Labels,
      `getLevelById("level-one")`/`("level-two")` liefert korrektes `LevelDef`,
      `getLevelById("unbekannt")` wirft.
- [x] 13. `LEVEL_REGISTRY`/`getLevelById`/`DEFAULT_LEVEL_ID` implementieren (grün)
      `level/levelRegistry.ts`.

- [x] 14. `hazards/factory.ts` anpassen (Bezug: US-3, Design "hazards/factory.ts")
      `updateHazard`-Signatur (+`hazardTriggeredAtMs`-Parameter), `updateSpikehead`-Funktion,
      `createHazard` wendet `spec.tint` an. Ungetestet (Phaser), aber ruft nur bereits
      getestete `spikeheadState` auf.

- [x] 15. `RaceScene.ts` anpassen (Bezug: US-1/US-3, Design "scenes/RaceScene.ts")
      - `level`-Feld über `init()`/`getLevelById(data.levelId ?? DEFAULT_LEVEL_ID)` setzen
        (Feld-Default `LEVEL_ONE` entfernen, `!`-Deklaration).
      - `RaceSceneInitData.levelId?: string`.
      - Neue Methode `updateSpikeheadTriggers()`, Aufruf in `update()`.
      - `updateHazard(...)`-Aufrufe um `this.racer.hazardTriggeredAtMs` ergänzen.
      - `buildSnapshot()`: Spikehead-Positions-Fall (`x`, `fallToY`) ergänzen.
      Ungetestet (Phaser/Canvas), manuelle Verifikation gemäß design.md.

- [x] 16. `ArenaView.tsx` anpassen (Bezug: US-1, Design "ArenaView.tsx")
      Neue Pflicht-Prop `levelId`, Weitergabe an `game.scene.start(...)`.

- [x] 17. `useArenaControls.ts` erweitern (Bezug: US-4, Design "DevPage.tsx +
      useArenaControls.ts")
      `levelId`/`setLevelId`-State, Default `DEFAULT_LEVEL_ID`. Falls sinnvoll testbar (reiner
      Hook-State ohne Verzweigung): kurzer Test analog zu bestehendem Muster; ansonsten (wie
      `mode` aktuell) ungetestet, da triviale `useState`-Kapselung.

- [x] 18. `.pixel-select`-CSS ergänzen (Bezug: US-4, Design "CSS")
      `theme.css` – additiv, kein Test nötig.

- [x] 19. `DevPage.tsx`: Level-Dropdown einbauen (Bezug: US-4, Design "DevPage.tsx")
      `<select className="pixel-select">` mit `LEVEL_REGISTRY`-Optionen, Änderung setzt
      `levelId` + bumped `runId` (Reset), `mode` bleibt unverändert. Ungetestet
      (Komponentenverdrahtung ohne eigene Verzweigungslogik über Registry-Iteration hinaus).

- [x] 20. Doku-Updates (Bezug: "Begleitende Doku-Updates")
      `docs/08-hazards-und-utilities.md` (Spikehead-Abschnitt),
      `docs/06-level-design.md` (Hinweis auf mehrere Level).

- [x] 21. Vollständiger Testlauf + manuelle Verifikation
      `npm test` (bzw. Workspace-Befehl) grün; manuelle Checkliste aus design.md
      Test-Strategie im Browser durchgehen (`/dev`, Level 1 ↔ Level 2, Spikehead-Zyklus,
      Gegner-Gauntlet, Regressionstest Level 1).
