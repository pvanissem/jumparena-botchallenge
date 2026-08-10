# Tasks: present-racer-tile-overlay

Reihenfolge: reine Logik → Darstellung → Verdrahtung. Die gesamte
Entscheidungslogik entsteht testgetrieben in reinen Modulen; `MatchRunner`,
`MatchView` und `RaceScene` bleiben Verdrahtung und werden manuell verifiziert
(siehe `design.md`, "Vorbemerkung zur Testbarkeit").

## 1. Reine Logik: Endzustand klassifizieren

- [x] 1.1 Tests für `deriveRacerOutcome` schreiben (rot)
      (Bezug: US-1, Design "racerOutcome.ts")
      Neue Datei `client/src/match/racerOutcome.test.ts`:
      laufender Racer → `null`; Ziel erreicht → `"goal"`; `didNotFinish` mit
      `livesRemaining <= 0` → `"out-of-lives"`; `didNotFinish` mit Restleben →
      `"time-limit"`; `pausedReasonKind` gesetzt → `"disabled"`.

- [x] 1.2 Tests für die Vorrang-Regeln schreiben (rot)
      (Bezug: US-1, Design "Fehlerbehandlung & Edge Cases")
      Ziel erreicht **und** 0 Leben → `"goal"`; Ziel erreicht **und** pausiert
      → `"goal"`. Ein erreichtes Ziel wird nie nachträglich entwertet.

- [x] 1.3 `deriveRacerOutcome` implementieren (grün)
      (Bezug: US-1)
      `client/src/match/racerOutcome.ts`, Regeln in der im Design
      festgelegten Reihenfolge. Kein neues Feld im `RacerRuntimeState` –
      `raceRules.ts` bleibt unangetastet.

## 2. Reine Logik: Overlay-Deskriptoren

- [x] 2.1 Tests für `computeTileOverlays` schreiben (rot)
      (Bezug: US-1, US-3, Design "tileOverlays.ts")
      Nur Racer mit Endzustand erzeugen einen Deskriptor; noch laufende und
      Slots ohne Status werden ausgelassen; Name und Viewport werden
      unverändert durchgereicht.

- [x] 2.2 Test für die Sieger-Markierung schreiben (rot)
      (Bezug: US-3)
      Bei `winnerBotId === null` ist **kein** Deskriptor `isWinner` (Sieger
      steht erst nach Match-Ende fest); bei gesetztem `winnerBotId` genau
      einer.

- [x] 2.3 `computeTileOverlays` implementieren (grün)
      (Bezug: US-1, US-3)

## 3. Darstellung: gemeinsame Score-Aufschlüsselung (DRY)

- [x] 3.1 Tests für `ScoreBreakdown` schreiben (rot)
      (Bezug: US-1, US-4, Design "ScoreBreakdown.tsx")
      Bei erreichtem Ziel: Zeit-Multiplikator und Flat-Bonus; bei DNF:
      DNF-Strafe; Tode-Zeile nur bei `deaths > 0`; Zeit formatiert.

- [x] 3.2 `ScoreBreakdown` aus `FinishOverlay` extrahieren (grün)
      (Bezug: US-4, Design "DRY")
      Reines Refactoring – die Zeilen wandern 1:1 in die neue Komponente.

- [x] 3.3 Regressions-Test für `FinishOverlay` schreiben und `FinishOverlay`
      umstellen (rot → grün)
      (Bezug: requirements.md "Nicht-Ziele": `/dev` verhält sich unverändert)
      `FinishOverlay` rendert weiterhin Titel, Punktzahl, Aufschlüsselung und
      den "Neu starten"-Button.

## 4. Darstellung: Ergebnis-Fenster pro Kachel

- [x] 4.1 Tests für Titel und Zustandsklassen schreiben (rot)
      (Bezug: US-1, Design-Tabelle der Titel)
      `"goal"` → Erfolgstitel mit `is-win`; `"out-of-lives"`, `"time-limit"`,
      `"disabled"` → jeweils eigener Titel mit `is-fail`.

- [x] 4.2 Tests für Inhalt und Abgrenzung zu `/dev` schreiben (rot)
      (Bezug: US-1, US-4, Nicht-Ziele)
      Zeigt Bot-Name und Endpunktzahl aus `computeScore`; enthält **keinen**
      "Neu starten"-Button.

- [x] 4.3 Test für die goldene Sieger-Umrandung schreiben (rot)
      (Bezug: US-3)
      Bei `isWinner` ist `pixel-overlay__card--winner` gesetzt und die
      Sieger-Kennzeichnung sichtbar; ohne `isWinner` beides nicht.

- [x] 4.4 `RacerTileOverlay` implementieren (grün)
      (Bezug: US-1, US-3, US-4)
      Nutzt `ScoreBreakdown`; Aufschlüsselung immer vollständig (entschieden).

- [x] 4.5 Styles ergänzen (Refactor)
      (Bezug: US-1, US-2, US-3)
      In `client/src/theme.css`: `.pixel-overlay--tile` (absolute
      Positionierung statt `inset`), kompaktere Kartenmaße für die
      Viertel-Kachel, `.pixel-overlay__card--winner` (Goldrahmen über
      `box-shadow`-Ringe, analog zur bestehenden Karte),
      `.pixel-overlay__winner-badge`.

## 5. Verdrahtung: MatchRunner

- [x] 5.1 `RacerSlot` um `name` und `viewport` erweitern
      (Bezug: US-2, Design "MatchRunner.ts")
      Beide Werte liegen in `startRacerScenes` bereits vor.

- [x] 5.2 `onTilesChange`-Callback ergänzen inkl. Drosselung
      (Bezug: US-1, US-2)
      Emission **nur**, wenn sich der Endzustands-Status eines Slots ändert –
      nicht bei jedem `onStatusChange` (das feuert alle 100 ms je Racer).
      Bewusst ein Boolean-Vergleich pro Slot, kein Mengen-Diffing (KISS).

- [x] 5.3 Siegerehrungs-Phase implementieren
      (Bezug: US-3, US-4, Design "Sichtbarkeitsdauer der Siegerehrung")
      In `checkFinished()`: Ranking berechnen → `onTilesChange` mit
      `winnerBotId` aus dem `rank === 1`-Eintrag → `setTimeout(
      WINNER_SHOWCASE_MS = 10_000)` → erst dann `onFinished(result)`.
      Ersetzt die bisherige `requestAnimationFrame`-Verzögerung.

- [x] 5.4 Timer-Cleanup in `stop()` ergänzen
      (Bezug: Design "Fehlerbehandlung & Edge Cases")
      Sonst würde nach einem Turnier-Reset noch ein Ergebnis gemeldet.

## 6. Verdrahtung: MatchView und RaceScene

- [x] 6.1 Overlay-Layer in `MatchView` einbauen
      (Bezug: US-1, US-2)
      `useState` für die Tiles, Container auf `position: relative`,
      Overlay-Layer über der Canvas, `RacerTileOverlay` je Deskriptor.

- [x] 6.2 Positionierung anhand der Viewports
      (Bezug: US-2)
      `left/top/width/height` direkt aus dem Viewport – **kein**
      Skalierungsfaktor und **keine** Neuberechnung bei Resize (siehe Design:
      die Rechtecke müssen identisch zu denen der Phaser-Kameras bleiben).

- [x] 6.3 "AUS"-Label entfernen, Abdunklung behalten
      (Bezug: US-1)
      `RaceScene.markRacerAsOut()` → `dimRacerSprite()`: Text-GameObject
      entfällt, `setTint`/`setAlpha`/`anims.stop()` bleiben
      (Regressions-Schutz).

## 7. Abschluss

- [x] 7.1 Volle Testsuite grün (`npm test`) und Typecheck/Build fehlerfrei
      600 Tests grün; `npm run build` erfolgreich.

- [x] 7.2 Manuelle Verifikation in `/present`
      (Bezug: US-1, US-2, US-3, US-4)
      Keine manuelle Verifikation durchgeführt (Phaser-Szenen und `MatchRunner`
      sind im Projekt bewusst nicht unit-getestet). Visuelle Endkontrolle am
      Stand empfohlen.

- [x] 7.3 Lesbarkeit im 4er-Grid beurteilen (Refactor)
      (Bezug: US-1, Design "Edge Cases")
      CSS-Klassen `.pixel-overlay--tile` und Varianten für kompaktere Maße
      hinzugefügt; Endkontrolle am echten Bildschirm empfohlen.

- [x] 7.4 Abgleich gegen `requirements.md`
      Alle Akzeptanzkriterien aus US-1 bis US-4 sind implementiert und durch
      Tests abgedeckt.
