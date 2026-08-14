# Tasks: bot-state-vision

TDD-Reihenfolge (Rot → Grün → Refactor). Jeder Implementierungs-Task beginnt mit
einem fehlschlagenden Test. Bezug in Klammern.

## A. Contract: Multi-Action (`@arena/bot-contract`)

- [x] 1. **Test (rot):** `state.test.ts` – `DecideResult`/`Action[]`-Nutzung,
      `botModule`-Signatur `decide: (state) => Action[]`. (US-9, Design "Breaking Change")
- [x] 2. `state.ts`: `export type DecideResult = Action[];`; `botModule.ts`:
      `decide`-Rückgabetyp `Action[]`. (US-9)

## B. Sandbox: Array-Durchreichung & Normalisierung

- [x] 3. **Test (rot):** `BotRunner.test.ts` – `tick()` liefert `Action[]`;
      gültiges/gemischtes/nicht-Array/leeres Array; Timeout/error → `[]`;
      Fehlversuch-Regeln (leer ≠ Fehlversuch). (US-9)
- [x] 4. `workerLike.ts`: Message `{type:"action", tick, actions: Action[]}`.
      `botWorker.ts`: Ergebnis von `decide` als `actions` senden. (US-9)
- [x] 5. `BotRunner.ts`: `tick(): Promise<Action[]>`, `normalizeActions()`,
      Timeout/error → `[]`, angepasste Fehlversuch-Zählung. (US-9)

## C. Controller-Kette

- [x] 6. **Test (rot):** `KeyboardController.test.ts` + `BotController.test.ts` auf
      `getNextActions(): Action[]` umstellen (Keyboard-Multi-Input → Array). (US-9)
- [x] 7. `RacerController.ts`/`BotController.ts`/`KeyboardController.ts`:
      `getNextActions` liefert `Action[]` (Keyboard aus `getInput()` abgeleitet, DRY). (US-9)

## D. Contract: State-Erweiterung

- [x] 8. **Test (rot):** `state.test.ts` – neue Typen `VisibleCoin/VisibleHazard/
      VisibleUtility`, `GapAhead`, `BotState`-Felder kompilieren; `nearest*` = Alias. (US-1,4,5,6,7)
- [x] 9. `state.ts`: `Visible*`-Typen, `warning`/`stompable` an Hazard, `GapAhead`,
      neue `BotState`-Felder, `Nearest* = Visible*`-Aliasse. (US-1,3,4,5,6,7)

## E. Sichtbereich

- [x] 10. **Test (rot):** `viewport.test.ts` – `withinView` an/innerhalb/außerhalb
      der Grenze je Achse (Grenze eingeschlossen, Ecke sichtbar); Objekte weit
      ober-/unterhalb des Bots sind sichtbar. (US-2)
- [x] 11. `state/viewport.ts`: `VIEW_HALF_WIDTH_PX = 400`,
      `VIEW_HALF_HEIGHT_PX = 540`, `withinView`. (US-2)
- [x] 12. **Test (rot):** `visiblePlatforms.test.ts` – Plattform weit unter-/oberhalb
      sichtbar, horizontale Ausschlussgrenze, große Plattform nicht geclippt. (US-2)
- [x] 13. `visiblePlatforms.ts`: AABB-Overlap gegen das Sicht-Rechteck. (US-2)
- [x] 14. **Test (rot):** `tiles.test.ts` – `buildNearbyTiles` liefert per Default
      11×9 mit dem Bot bei `[4][5]`; vollständiges Zell→Tile-Mapping. (US-2)
- [x] 15. `tiles.ts`: `buildNearbyTiles`-Defaults `width = 11`, `height = 9`. (US-2)

## F. gapAhead

- [x] 16. **Test (rot):** `gapAhead.test.ts` – kein Gap; Gap voraus (distance≥0);
      Gap außerhalb `maxDistancePx`; Richtung left/right; Bot ohne Boden. (US-6)
- [x] 17. `tiles.ts`: kleine pure `isSolidAt(level, col, row)` exportieren (aus
      `tileTypeAt`-Logik, DRY). `state/gapAhead.ts`: `computeGapAhead`. (US-6)

## G. Builder

- [x] 18. **Test (rot):** `botStateBuilder.test.ts` – Listen leer/sortiert/gefiltert;
      `dx/dy`-Vorzeichen; `nearest*=[0]`/null; `stompable` nur schnetzler; `warning`
      durchgereicht; `velocity/isSprinting/justRespawned/tookDamage` aus `extras`;
      `worldBounds`; `goalDirection` unverändert. (US-1,2,3,4,5,7)
- [x] 19. `worldSnapshot.ts`: Hazard-Objekt um `warning`. `botStateBuilder.ts`:
      `BotStateExtras`-Param, `toVisibleList`-Helper, `nearest*`, `stompable` aus
      `HAZARD_REGISTRY`, `gapAhead`, `worldBounds`, neue Felder. (US-1..7)

## H. RaceScene-Verdrahtung (manuell verifiziert, kein Unit-Test)

- [x] 20. `RaceScene.ts`: `BOT_TICK_INTERVAL_MS = 33`. (US-10)
- [x] 21. `RaceScene.ts`: `lastBotActions: Action[]`; `applyBotActions()` (letzte
      horizontale gewinnt, `jump` kombiniert; nutzt `applyMovement`); alten
      `applyBotAction` entfernen; `fireBotTick` reicht `Action[]` durch. (US-9)
- [x] 22. `RaceScene.ts`: `pendingTookDamage`/`pendingJustRespawned` setzen
      (`applyPitFall`, Hazard-`"hit"`), in `fireBotTick` als `extras` übergeben
      (velocity/isSprinting), nach State-Bau zurücksetzen. `buildSnapshot` liefert
      `warning` je spikehead. (US-4,5,7)

## I. Doku (US-8)

- [x] 23. `packages/bot-contract`-Kommentare + `current-bot.template.js`: Array-
      Rückgabe, neue Felder. (US-8)
- [x] 24. `client/src/bot/AGENTS.md`: Multi-Action/Array, 30 Hz, neue State-Felder,
      Sprint/variable Sprunghöhe, spikehead, `warning`/`stompable`/`gapAhead`/
      `velocity`/`isSprinting`, Fallstricke, Code-Skelett. (US-8)
- [x] 25. `docs/02-bot-api.md` + `docs/08-hazards-und-utilities.md`: State-Objekt
      real (Pixel), Array-Rückgabe, 30 Hz, `warning`/`stompable` in Bot-API. (US-8)

## J. Abschluss

- [x] 26. Vollständiger Testlauf (`vitest`), `biome`-Check, `tsc` – alles grün.
- [x] 27. Abgleich aller Akzeptanzkriterien US-1..US-10.
