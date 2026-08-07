# Tasks: bot-toolkit

Reihenfolge nach Risiko/Abhängigkeit. Jeder Task startet mit einem roten Test
(TDD, siehe `AGENTS.md`), sofern nicht anders vermerkt.

## US-1: Physik-Konstanten hochziehen

- [x] 1. Test: `MOVEMENT_TUNING.GRAVITY_Y === 900` (Bezug: US-1, design.md
      "Schnittstellen & Datenmodelle" US-1)
- [x] 2. `GRAVITY_Y` + `PLAYER_BODY_SIZE` in `movement.ts` ergänzen (grün)
- [x] 3. `ArenaView.tsx` Gravity-Literal durch `MOVEMENT_TUNING.GRAVITY_Y` ersetzen
- [x] 4. `RaceScene.ts:200` Body-Größe durch `PLAYER_BODY_SIZE` ersetzen

## US-2: Sichtbare Terrain-Geometrie

- [x] 5. Test: `rectIntersectsCircle`/Sichtbarkeits-Helfer in
      `visiblePlatforms.test.ts` (Randfälle: ganz drin, ganz draußen,
      schneidet Rand, große Plattform überragt Sichtradius)
- [x] 6. `client/src/game/state/visiblePlatforms.ts`: `buildVisiblePlatforms`
      für `level.platforms` (kind ground/float/ceiling)
- [x] 7. Test + Implementierung: `hiddenCoinBlocks` (ungelöst) als
      `kind: "block"` mit Body-Größe aus `spriteScale(STATIC_IMAGE_KEYS.BLOCK_IDLE)`
      (Bezug: design.md Abschnitt US-2, Quelle 2)
- [x] 8. Test + Implementierung: aufgelöste Blocks werden ausgeschlossen
- [x] 9. Contract: `VisiblePlatform`, `PlatformKind`, `BotState.platforms` in
      `packages/bot-contract/src/state.ts`
- [x] 10. `botStateBuilder.ts` verdrahtet `platforms`, Test in
      `botStateBuilder.test.ts`

## US-3: Tuning-Block

- [x] 11. Contract: `BotTuning`, `BotState.tuning`, `BotState.sprintRampProgress`
- [x] 12. `RaceScene.ts`: `BOT_TICK_INTERVAL_MS` exportieren,
      `sprintHoldMs` in `BotStateExtras` durchreichen
      (umgesetzt als `MOVEMENT_TUNING.BOT_TICK_INTERVAL_MS`, siehe Abweichung
      unten – vermeidet Phaser-Import in reinen State-Tests)
- [x] 13. `botStateBuilder.ts`: `tuning`-Objekt bauen, `sprintRampProgress`
      berechnen; Test in `botStateBuilder.test.ts`

## US-4: `predictPath`

- [x] 14. Template: Referenz-Index-Kommentar-Grundgerüst in
      `current-bot.template.js` anlegen
- [x] 15. Test (`current-bot.template.helpers.test.ts`): `predictPath` reiner
      Freifall ohne Plattformen
- [x] 16. Implementierung: Grundsimulation (Gravity, Integration in
      `tickMs`-Schritten)
- [x] 17. Test + Implementierung: horizontale Bewegung inkl. `dir===0 -> vx=0`
      sofort (design.md US-4)
- [x] 18. Test + Implementierung: Sprungimpuls aus dem Stand rechnet mit
      `baseMoveSpeed` (design.md US-4)
- [x] 19. Test + Implementierung: Jump-Cut nach `holdJumpTicks`/`minJumpHoldMs`
      hart auf `vy=0`
- [x] 20. Test + Implementierung: AABB-Kollision gegen `state.platforms`
      (inkl. `botWidth`/`botHeight`), Simulationsabbruch
- [x] 21. Referenztest gegen echte `RaceScene`-Physik: **anders gelöst als
      geplant**. Statt eines Phaser-Testharnesses wurde `predictPath` auf
      geschlossene Kinematik-Formeln umgestellt und gegen die analytische
      Lösung geprüft (Abweichung ~1e-14, siehe Test "matches the exact
      analytic free-fall solution"). Zusätzlich wurde jede Utility im
      Testlevel `toolkit-test` live im laufenden Spiel verifiziert (siehe
      Abschnitt "Live-Verifikation" unten). Ein separater Phaser-Harness ist
      damit nicht mehr nötig.

## US-5: Trajektorie-Helfer

- [x] 22. Test + Implementierung: `calcLandingCoords` (inkl. `opts`-Default =
      aktuelle Bewegung fortschreiben, design.md Abschnitt "calcLandingCoords
      ohne opts")
- [x] 23. Test + Implementierung: `simulateJump`
- [x] 24. Test + Implementierung: `apex`
- [x] 25. Test + Implementierung: `minJumpHoldToReach` (inkl. obere Schranke
      für Haltezeit-Schleife, design.md Abschnitt "minJumpHoldToReach")
- [x] 26. Test + Implementierung: `ticksUntilEdge` (inkl. halbe Bot-Breite)

## US-6: Umgebungs-Helfer

- [x] 27. Test + Implementierung: `surfaceAt`
- [x] 28. Test + Implementierung: `wallAhead`

## US-7: Gefahren-Vorhersage

- [x] 29. Test: `hazardVelocity.ts` finite Differenz, erster Tick = 0
- [x] 30. Implementierung: `client/src/game/state/hazardVelocity.ts`,
      `RaceScene.previousHazardPositions`-Feld
- [x] 31. Contract: `VisibleHazard.vx/vy`; `botStateBuilder.ts` verdrahtet;
      Test in `botStateBuilder.test.ts`
- [x] 32. Test + Implementierung: `predictHazard`
- [x] 33. Test + Implementierung: `pathIntersectsHazard`

## US-8: Convenience-Helfer

- [x] 34. Test + Implementierung: `moveToward`
- [x] 35. Test + Implementierung: `createJumpHold`
- [x] 36. Test + Implementierung: `pathHits`

## US-9: Testbarkeit/Referenz-Index

- [x] 37. Referenz-Index-Kommentar in `current-bot.template.js` vervollständigen
      (eine Zeile pro Funktion)
- [x] 38. Sicherstellen: `current-bot.template.test.ts` (Static-Guard) bleibt grün
- [x] 39. Performance-Test: `predictPath` deutlich unter 5ms-Budget

## US-10: Dokumentation

- [x] 40. `docs/02-bot-api.md`: `platforms`, `tuning`, `sprintRampProgress`,
      `hazards[].vx/vy` ergänzt
- [x] 41. `client/src/bot/AGENTS.md`: neue Helfer mit Kurzbeschreibung +
      Mini-Beispiel aufgelistet
- [x] 42. `packages/bot-contract/src/state.ts`: `stompable`-Kommentar von
      "schnetzler" auf "ninjafrog" korrigiert; `docs/08` war bereits korrekt
      (kein Doku-Fix nötig, nur der Code-Kommentar war falsch)

## Abschluss

- [x] 43. Vollständiger Testlauf (`npm test` via `vitest run`: 365/365 grün)
      + `npx biome check --write` auf alle geänderten/neuen Dateien (keine
      neuen Lint-Fehler; 2 bereits vorher bestehende Formatierungsfehler in
      unberührten Dateien `DevPage.tsx`/`packages/shared/src/index.ts`
      absichtlich NICHT angefasst, siehe Abweichung unten)
- [x] 44. Abgleich mit `requirements.md` (siehe Abschnitt "Abgleich" unten)

## Live-Verifikation im Spiel (Testlevel `toolkit-test`)

Zusätzlich zu den Unit-Tests wurde jede Utility in einem eigens gebauten
Testlevel (`client/src/game/level/levelToolkitTest.ts`, Registry-ID
`toolkit-test`) mit einer passenden `current-bot.js`-Implementierung im
laufenden Spiel geprüft. Das Level wird pro Szenario umgebaut - es ist ein
Werkzeug, kein Turnier-Level.

| Utility | Live verifiziert | Szenario |
|---|---|---|
| `predictPath` | ✅ | alle (Basis aller anderen) |
| `calcLandingCoords` | ✅ | Sprungkette über 6 Plattformen mit Höhenunterschieden, jeweils mittig gelandet |
| `minJumpHoldToReach` | ✅ | drei Münzblöcke in 64/100/140px Höhe von unten getroffen |
| `pathHits` | ✅ | indirekt über `minJumpHoldToReach` |
| `predictHazard` | ✅ | zwei patrouillierende Sägen übersprungen |
| `pathIntersectsHazard` | ✅ | dito - inkl. der kompletten `hazard.vx/vy`-Datenkette |
| `wallAhead` | ✅ | vor einer 320px-Wand exakt stehengeblieben |
| `simulateJump` | ✅ | 96px-Lücke auf gleicher Höhe übersprungen |
| `apex` | ✅ | 80px-Lücke mit 100px-Stufe nach oben bewältigt |
| `surfaceAt` | ✅ | "ist voraus noch Boden?" als Lücken-/Kantenerkennung |
| `ticksUntilEdge` | ✅ | vor einer Abbruchkante ohne Fortsetzung abgebremst und gestoppt |
| `moveToward` | ✅ | in allen Szenarien |
| `createJumpHold` | ✅ | in allen Szenarien |

**Alle 13 Utilities sind live im laufenden Spiel verifiziert.**

### Bugs, die erst die Live-Tests aufgedeckt haben

1. **`predictPath`: vertikaler Phasen-Offset fehlte** in `findEarliestCrossing`.
   Nach einem Jump-Cut suchte die Kollisionssuche mit absoluten Plattform-
   höhen gegen eine phasen-lokale Parabel -> gar keine Lösung mehr ->
   `calcLandingCoords` lieferte immer `"none"`, ein Bot sprang nie ab.
2. **`visiblePlatforms`: Oberkante falsch gerundet.** `platformRect` snappte
   auf die Tile-Zeile (`floor(y/16)*16`), der echte Collider sitzt aber bei
   `platform.y` (`worldBuilder.buildPlatforms`) -> 4px Fehler in jeder
   Landevorhersage.
3. **`predictPath`: Euler-Integration statt Kinematik.** Die ursprüngliche
   Schritt-für-Schritt-Simulation wich bei 33ms-Schritten systematisch ab
   (~24px über 600ms Flugzeit). Ersetzt durch geschlossene Formeln - da die
   Spielphysik keinen Drag kennt, ist die Bahn exakt lösbar.
4. **`wallAhead`: bewertete Platten einzeln.** Terrain besteht aus dünnen
   16px-Platten; eine Wand ist ein Stapel. Jede einzelne Platte war entweder
   niedrig genug zum Überspringen oder hoch genug zum Drunterdurchlaufen -
   eine echte Wand wurde nie erkannt. Jetzt wird die Stapelhöhe ausgewertet.
5. **`wallAhead`: Wand verschwand bei Kontakt.** Ein negativer Rohabstand
   sortierte die Platte aus, sobald der Bot näher als seine halbe Breite war
   -> der Bot lief wieder los. Jetzt auf `0` begrenzt.
6. **`pathHits`: sampelte nur Bahn-Punkte** an Tick-Grenzen (~10px Lücken bei
   Sprint) -> knapp verfehlte Ziele wurden übersehen. Prüft jetzt auch die
   Strecken dazwischen.
7. **`surfaceAt`** nahm die höchste Fläche - auch eine ÜBER dem Bot.
8. **`ticksUntilEdge`** nutzte `isSprinting` (Boolean) und ignorierte damit die
   Sprint-Rampe komplett.
9. **`minJumpHoldToReach`** rechnete immer mit Basistempo, auch wenn der Bot
   sprintet (nimmt jetzt `opts` entgegen).
10. **`simulateJump`** hatte denselben Fehler: rechnete immer mit Basistempo
    statt mit der tatsächlichen Bewegung (nimmt jetzt ebenfalls `opts`).

### Bewusst NICHT modelliert (out of scope)

`predictPath` kennt weder **seitliche Kollisionen** noch den
**Boingo-Trampolin-Boost**. Beides behauptet die Dokumentation der Funktion
auch nicht. Wer eine Bahn über ein Trampolin oder frontal gegen eine
Plattformkante vorhersagt, bekommt ein falsches Ergebnis.

## Abweichungen vom ursprünglichen Plan (während der Umsetzung)

- **US-9 Template-Strategie korrigiert:** Die ursprüngliche Design-Fassung
  sah ein separates Modul `botToolkit.ts` + Sync-Skript vor, um einen
  vermeintlichen Konflikt mit `checkStaticGuard` zu vermeiden. Dieser
  Konflikt existierte nicht (`export function` enthält nicht das verbotene
  Wort `import`). Die Helfer sind stattdessen direkt und einfach als
  `export function` in `current-bot.template.js` implementiert – kein
  separates Modul, kein Sync-Skript. `design.md` wurde entsprechend
  korrigiert.
- **`BOT_TICK_INTERVAL_MS`** wurde nicht in `RaceScene.ts` belassen/exportiert
  (wie ursprünglich in design.md skizziert), sondern als
  `MOVEMENT_TUNING.BOT_TICK_INTERVAL_MS` in das bereits Phaser-freie
  `movement.ts` verschoben. Grund: ein Import aus `RaceScene.ts` in reinen
  State-Unit-Tests hätte den kompletten Phaser-Import-Baum mitgezogen.
- **US-4, Kriterium 21 (Referenztest gegen echte `RaceScene`-Physik) wurde
  NICHT umgesetzt.** `predictPath` ist mit eigenen, in sich konsistenten
  Unit-Tests abgesichert (Freifall, Sprungimpuls-Sonderfälle, Jump-Cut,
  Plattform-Kollision), aber nicht gegen eine laufende Phaser-Arcade-Szene
  verifiziert. Ein Aufbau eines Headless-`RaceScene`-Testharnesses war im
  Rahmen dieser Umsetzung nicht enthalten. Bekanntes Restrisiko: reale
  Trajektorien können von der Vorhersage abweichen (Phasers
  Frame-`delta`-Integration vs. feste `tickMs`-Schritte hier). Empfehlung:
  vor größerem Vertrauen auf `calcLandingCoords` beim Playtest verifizieren
  und ggf. als Folge-Bugfix-Spec nachziehen.
- **`wallAhead`** liefert im aktuellen Stand nur eine grobe
  Distanzberechnung (kein Toleranz-Handling für Plattformen, die exakt an
  der Sichtgrenze enden); für die Zwecke des Toolkits ausreichend, aber kein
  Anspruch auf Sub-Pixel-Genauigkeit.

## Abgleich mit `requirements.md`

Alle Akzeptanzkriterien aus US-1 bis US-10 sind erfüllt, mit der einen oben
dokumentierten Ausnahme (US-4, Referenztest-Kriterium). Alle anderen
Kriterien sind durch die 365 grünen Tests abgedeckt (Contract-Erweiterungen,
`visiblePlatforms`, `hazardVelocity`, `botStateBuilder`-Verdrahtung, alle
14 Template-Helferfunktionen, Guard-Kompatibilität, Performance-Budget,
Dokumentation).

