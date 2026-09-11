# Tasks: Selber spielen mit Gamepad (`play-mode`)

Bezug: `requirements.md` (US-1 … US-8), `design.md`.

Jeder Task folgt dem Rot-Grün-Refactor-Zyklus (`AGENTS.md`): zuerst der
fehlschlagende Test, dann der minimale Produktivcode, dann Aufräumen.

## A. Eingabe-Grundlagen

- [x] 1. `play/input/bindings.ts` – Typen & `resolveBinding` (Bezug: US-1, Design
      „Gamepad-Bindings")
      Tests für Button-Bindings (`pressed`/`value > 0.5`), Achsen-Bindings in
      beide Richtungen, Werte unterhalb der Schwelle, fehlende Indizes.
      Danach `PLAY_INPUTS`, `InputBinding`, `GamepadMapping`, `GamepadLike`,
      `ACTIVATION_THRESHOLD`, `DEFAULT_MAPPING_BINDINGS`.
- [x] 2. `play/input/readGamepad.ts` – Snapshot aus Pad + Mapping (US-1/US-3)
      Tests: alle acht logischen Eingaben, gemischte Button-/Achsen-Mappings,
      gleichzeitige Eingaben.
- [x] 3. `play/input/risingEdges` – Flankenerkennung (US-2)
      Tests: erster Snapshot ohne Vorgänger, gehaltene Taste erzeugt genau eine
      Flanke, Loslassen erzeugt keine.
- [x] 4. `play/input/GamepadPoller.ts` – Adapter um `PadReader` (US-1/US-3)
      Tests mit Fake-Reader: `connectedPads()`, `raw()`, `snapshot()` bei
      fehlendem/getrenntem Pad.

## B. Kalibrierung

- [x] 5. `play/input/calibration.ts` – `detectBinding` (US-1)
      Tests: Button-Änderung gegenüber Baseline, Achsen-Änderung inkl. Richtung,
      Ruhe-Achse ≠ 0 als Baseline, keine Änderung → `null`.
- [x] 6. `calibrationReducer` – Pad-Zuordnung & Schrittfolge (US-1)
      Tests: `await-pad` bindet erstes reagierendes Pad, ignoriert bereits
      belegte Indizes, `skip-pad`.
- [x] 7. `calibrationReducer` – Erfassen, Entprellen, Doppelbelegung (US-1)
      Tests: Binding übernehmen, erst nach Loslassen weiter, belegte Eingabe →
      `error: "already-bound"` ohne Schrittwechsel, `restart`, `accept` → `done`.
- [x] 8. `play/input/mappingStore.ts` – Persistenz je `padId` (US-1)
      Tests mit Fake-`StorageLike`: speichern/lesen, baugleiches Pad
      wiederverwenden, kaputtes JSON, fehlendes Storage, Versionsfeld.

## C. Steuerung in der Arena

- [x] 9. `HumanInputSource`/`DirectionalInput` in `control/RacerController.ts`
      (US-3, US-8)
      Test: `KeyboardController` erfüllt das Interface; bestehende
      `KeyboardController.test.ts` bleibt unverändert grün.
- [x] 10. `play/input/GamepadController.ts` (US-3)
      Tests mit Fake-Poller: `getInput()` (dir/jump/sprint, Links vor Rechts),
      `getNextActions()` mit Sprint-/Sprung-Kombination (Parität zu
      `KeyboardController`), `isConnected()`, `dispose()`.
- [x] 11. `RaceScene`: `controllerMode: "gamepad"` + injizierter `humanInput`
      (US-3, US-8)
      Tests über `createController`-Pfad: Gamepad-Modus nutzt die injizierte
      Quelle, Fail-Fast ohne `humanInput`; Tastatur-/Bot-Pfad unverändert.
- [x] 12. `RaceScene`: `audio` granular (`boolean | {music, sfx}`) (US-5, US-8)
      Tests der Normalisierung inkl. Rückwärtskompatibilität
      (`undefined`/`true`/`false`).

## D. Run-Logik

- [x] 13. `play/nameEntry.ts` (US-2)
      Tests: Startzustand (8 Plätze), Zeichen vor/zurück umlaufend,
      Cursorbewegung mit Randverhalten, `finalizeName` inkl. Leername.
- [x] 14. `play/highscore.ts` (US-6)
      Tests: Sortierung, Gleichstand (älter oben), Top-10-Grenze,
      Rang-Ermittlung, Eintrag außerhalb der Top 10.
- [x] 15. `play/highscoreStore.ts` (US-6)
      Tests mit Fake-Storage: Persistenz über Reload, Begrenzung auf 50
      gespeicherte Einträge, kaputtes JSON, fehlendes Storage.
- [x] 16. `play/station.ts` – Phasen `attract` → `name-entry` → `countdown`
      (US-2, US-7)
      Tests: Start per BESTÄTIGEN, Namenseingabe über Flanken, ZURÜCK bricht ab,
      Countdown-Ablauf über `tick`.
- [x] 17. `play/station.ts` – Levelablauf & Score-Kumulation (US-4)
      Tests: Leben-Übertrag zwischen Leveln, Score-Summe über
      `computeScore`, Level-Ergebnis-Phase, Wechsel zum nächsten Level.
- [x] 18. `play/station.ts` – Ende eines Runs (US-4, US-6)
      Tests: 0 Leben → `game-over` unabhängig vom Level, Timeout-Level ohne
      Lebensverlust führt weiter, letztes Level → `game-over`,
      Rückkehr nach `attract` per BESTÄTIGEN/Timeout.
- [x] 19. `play/station.ts` – Abbruch & Gamepad-Verlust (US-3, US-5)
      Tests: ZURÜCK im Spiel → `attract`, `gamepad-lost` → `disconnected`,
      `gamepad-found` → zurück zu `playing`.

## E. Phaser-Anbindung

- [x] 20. `play/StationSceneHost.ts` – Szenen je Station (US-4, US-5)
      Tests mit Fake-`Phaser.Game` (Muster `MatchRunner.test.ts`):
      Szenenschlüssel, Viewport aus `computeGridViewports(2,…)`, Init-Daten
      (`startingLives`, `audio`, `assetsPreloaded`, `humanInput`),
      Szenen-Austausch beim Levelwechsel ohne die andere Station zu berühren,
      `pause`/`resume`, `destroy`.
- [x] 21. `play/PlayBootScene.ts` – Assets + einzelne Musikspur (US-5)
      Tests: `assetsReady`-Event, Musik einmalig, Lautstärke folgt
      `audioSettings`, Aufräumen bei `shutdown`.

## F. UI

- [x] 22. `play/useGamepadEdges.ts` (US-2)
      Test: liefert Flanken aus aufeinanderfolgenden Frames, meldet rAF ab.
- [x] 23. `play/input/CalibrationWizard.tsx` (US-1)
      Tests: Schrittanzeige, Fehlermeldung bei Doppelbelegung, Testbild mit
      Live-Anzeige, Speichern beim Bestätigen, „ohne zweites Pad fortfahren".
- [x] 24. `play/StationOverlay.tsx` (US-7)
      Tests: HUD-Werte (Name, Leben, Level n/6, Punkte, Restzeit), Overlay je
      Phase, Tastenlegende, „Controller getrennt".
- [x] 25. `play/HighscorePanel.tsx` (US-6)
      Tests: Sortierung, Hervorhebung des neuen Eintrags, Leerzustand.
- [x] 26. `play/PlayArena.tsx` – Phaser-Host (US-5)
      Test: erzeugt/zerstört das Game, reicht Größenänderungen durch.
- [x] 27. `play/useStation.ts` – Verdrahtung Reducer ↔ Szenen (US-4, US-5)
      Tests: startet Level bei Phasenwechsel, stoppt bei Runende, pausiert bei
      Gamepad-Verlust.
- [x] 28. `pages/PlayPage.tsx` + Route `/play` (US-1, US-5, US-6)
      Tests: Kalibrierungs-Gate mit/ohne gespeichertes Mapping, zwei unabhängige
      Stationen, Highscore-Panel, Hinweis „kein Gamepad erkannt".
- [x] 29. `styles/play-arcade.css` + Feinschliff der Optik (US-7)
      Kein eigener Test (rein visuell); Abnahme manuell am Stand.

## G. Abschluss

- [x] 30. Gesamtlauf `npm test`, `npm run check`, `npm run build`
      Alle bestehenden Suites (insbesondere `/dev`, `/present`, Turnier) müssen
      unverändert grün sein.
- [x] 31. Abgleich der Akzeptanzkriterien aus `requirements.md`
      Tabelle „Abdeckung" aus `design.md` gegen den Ist-Stand prüfen, offene
      Punkte dokumentieren.

---

## Abgleich der Akzeptanzkriterien (Task 31)

Stand: alle 31 Tasks umgesetzt, 1168 Tests grün (davon ~250 neu), `npm run check`
ohne neue Befunde gegenüber der Baseline, `npm run build` erfolgreich.

| Story | Abgedeckt durch | Tests |
|---|---|---|
| US-1 Kalibrierung | `play/input/{bindings,calibration,mappingStore,CalibrationWizard}` | 14 + 23 + 11 + 11 |
| US-2 Start & Name | `play/{nameEntry,station}`, `useGamepadEdges` | 18 + 33 + 6 |
| US-3 Steuerung | `play/input/GamepadController`, `game/scenes/raceSceneOptions`, `RaceScene` | 19 + 11 |
| US-4 Kampagne | `play/station`, `play/useStation`, `play/StationSceneHost` | 33 + 12 + 15 |
| US-5 Unabhängigkeit | zwei Reducer-Instanzen, `StationSceneHost`, `PlayBootScene`, `PlayPage` | 15 + 5 + 7 |
| US-6 Highscore | `play/{highscore,highscoreStore,HighscorePanel}` | 12 + 13 + 6 |
| US-7 Aufmachung | `play/StationOverlay`, `styles/play-arcade.css` | 17 |
| US-8 NFR | additive `RaceScene`-Erweiterung, pure Module, keine Server-Abhängigkeit | bestehende Suiten unverändert grün |

### Offene Punkte für die Abnahme am Stand

- **Echte Hardware**: Kalibrierung mit den konkreten USB-SNES-Adaptern
  verifizieren (Button- vs. Achsen-D-Pad wird beides unterstützt, ist aber nur
  mit Fake-Pads getestet).
- **Audio-Freigabe**: Der AudioContext wird von Gamepad-Eingaben NICHT
  entsperrt; am Stand muss einmal per Maus/Tastatur interagiert werden (die
  Seite weist mit „🔇 Klicken für Ton" darauf hin).
- **Lesbarkeit/Latenz**: HUD-Größe aus Zuschauerentfernung und gefühlte
  Eingabelatenz sind nur am Stand beurteilbar.
- **Reset der Bestenliste**: `highscoreStore.clear()` existiert, ist aber
  bewusst nicht in der Oberfläche verlinkt (siehe requirements, offene Frage
  „anstößige Namen").
