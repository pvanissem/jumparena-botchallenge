# Tasks: tournament-stage-levels

Reihenfolge: von innen nach außen (shared → server → client-Logik →
client-UI), damit jede Ebene auf grün getesteten Bausteinen aufsetzt. Jeder
Implementierungs-Task beginnt mit einem fehlschlagenden Test (TDD, siehe
AGENTS.md).

> **Voraussetzung:** Die Features `.features/admin-match-group-size/` und
> `.features/present-racer-tile-overlay/` sind abgeschlossen und gemerged.
> Dieses Feature ändert dieselben Dateien (`TournamentState`,
> `TournamentConfigureMessage`, `TournamentSetup.tsx`, `TournamentService`,
> `selectMatchStage`) und setzt `groupSize` im `TournamentState` voraus.

## 1. Shared: Level-IDs

- [ ] 1.1 Test für `isValidLevelId` schreiben (rot)
      (Bezug: US-6, Design "packages/shared/src/levels.ts")
      Akzeptiert jede ID aus `LEVEL_IDS`; lehnt unbekannte IDs, Leerstring,
      Nicht-Strings, `null`/`undefined` ab.

- [ ] 1.2 `LEVEL_IDS` und `isValidLevelId` implementieren (grün)
      (Bezug: US-6)
      Neue Datei `packages/shared/src/levels.ts`, Export über `index.ts`.

- [ ] 1.3 Konsistenztest Registry ↔ `LEVEL_IDS` schreiben (rot → grün)
      (Bezug: Design "Review", Absatz zur bewussten Duplikation)
      In `client/src/game/level/levelRegistry.test.ts`: Jede ID aus
      `LEVEL_IDS` ist über `getLevelById` auflösbar **und** jede
      `LEVEL_REGISTRY`-ID ist in `LEVEL_IDS` enthalten. Dieser Test ist die
      Gegenleistung für die zweite Wahrheitsquelle – nicht überspringen.

## 2. Shared: Stage-Zuordnung und Rundenvorschau

- [ ] 2.1 Tests für `resolveStageLevelId` schreiben (rot)
      (Bezug: US-3, Design "Architektur-Überblick")
      Index 0 → erste Stage; Index 1 → zweite Stage; Index jenseits der Länge
      → letzte Stage (Clamp); Ein-Element-Liste → immer dasselbe Level.

- [ ] 2.2 `resolveStageLevelId` implementieren (grün)
      (Bezug: US-3)

- [ ] 2.3 Tests für `estimateRoundCount` schreiben (rot)
      (Bezug: US-5)
      4 Bots/Größe 4 → 1; 8 Bots/Größe 4 → 2; 4 Bots/Größe 2 → 2;
      3 Bots/Größe 2 → 2 (Freilos); 2 Bots → 1.

- [ ] 2.4 `estimateRoundCount` implementieren (grün)
      (Bezug: US-5)
      Bildet die Gruppenbildung iterativ nach (`ceil(n / groupSize)`), damit
      die Vorschau auch bei Freilosen zum echten Bracket passt.

- [ ] 2.5 Kreuztest gegen das echte Bracket schreiben (rot → grün)
      (Bezug: US-5, Design "Bewusste Logik-Duplikation")
      Serverseitiger Test: für 4/4, 8/4, 16/4, 4/2, 3/2, 2/4 und 5/4 ein echtes
      Turnier durchspielen und die entstandene Rundenzahl mit
      `estimateRoundCount` vergleichen. Gegenleistung für die Duplikation der
      Gruppenbildungs-Logik – nicht überspringen.

## 3. Shared: Nachricht und Zustand umstellen

- [ ] 3.1 Typguard-Tests schreiben (rot)
      (Bezug: US-1, US-6)
      `isTournamentConfigureMessage` akzeptiert `stageLevelIds: ["level-one"]`,
      lehnt fehlendes Feld und `[1, 2]` ab; `isTournamentState` lehnt einen
      State ohne `stageLevelIds` ab.

- [ ] 3.2 `levelId` → `stageLevelIds` umstellen (grün)
      (Bezug: US-1, US-3)
      In `TournamentState` und `TournamentConfigureMessage`; beide Typguards
      prüfen **nur die Struktur**, nicht den Wertebereich (Ablehnung samt Log
      gehört in den Service). Exporte in `index.ts` ergänzen.

- [ ] 3.3 Bestehende Fixtures/Tests anpassen (grün)
      (Bezug: Design "Bewusste Brüche")
      Jedes `TournamentState`-Literal (u. a. `selectMatchStage.test.ts`,
      `messages.test.ts`, Server-Tests) auf `stageLevelIds` umstellen.

## 4. Server: Validierung und Signaturbereinigung

- [ ] 4.1 Tests für die Stage-Validierung schreiben (rot)
      (Bezug: US-6, Design "TournamentService")
      Zwei Stages → `state.stageLevelIds` wie übergeben; leere Liste → `null`
      und unveränderter Zustand; unbekannte Level-ID → `null`.

- [ ] 4.2 Regressions-Tests der bestehenden Ablehnungsgründe prüfen (grün)
      (Bezug: US-6)
      Teilnehmerzahl, `livesPerRun` und `groupSize` lehnen weiterhin
      unverändert ab. Die neue Prüfung kommt **zuletzt**.

- [ ] 4.3 Validierung in `TournamentService.configure` implementieren (grün)
      (Bezug: US-6)
      Unbekannte IDs im `console.warn` namentlich nennen.

- [ ] 4.4 `levelId` aus `CreateRoundsOptions` entfernen (Refactor)
      (Bezug: Design "TournamentStrategy")
      Räumt den `_levelId`-Smell aus dem Review von `admin-match-group-size`
      auf. Verhalten bleibt unverändert; nur Signatur und Aufrufer anpassen.

## 5. Client: reine Logik

- [ ] 5.1 Tests für `computeRoundStatus` schreiben (rot)
      (Bezug: US-4, Design "roundStatus.ts")
      Ein laufendes Match → `"running"`; alle beendet → `"finished"`;
      einige beendet und keines laufend → `"running"` (angefangene Runde);
      kein Match begonnen → `"pending"`; leere Runde → `"pending"`.

- [ ] 5.2 `computeRoundStatus` implementieren (grün)
      (Bezug: US-4)

- [ ] 5.3 Tests für `stageLevelList` schreiben (rot)
      (Bezug: US-1, US-2, Design "stageLevelList.ts")
      `addStage` hängt das zuletzt gewählte Level erneut an; `removeStage`
      entfernt an Position und ist **No-op bei Länge 1**; `moveStage` tauscht
      nur mit dem Nachbarn und ist **No-op an den Rändern**; `setStage` ändert
      ausschließlich den adressierten Index.

- [ ] 5.4 `stageLevelList` implementieren (grün)
      (Bezug: US-1, US-2)
      Rein, unveränderlich (neue Arrays, keine Mutation der Eingabe).

- [ ] 5.5 Test für `roundIndex` in `selectMatchStage` schreiben (rot)
      (Bezug: US-3)
      `"running"` und `"result"` liefern den korrekten `roundIndex`,
      inklusive eines Matches aus der zweiten Runde.

- [ ] 5.6 `selectMatchStage` um `roundIndex` erweitern (grün)
      (Bezug: US-3)
      Achtung: Die heutige Implementierung arbeitet auf `rounds.flat()` und
      verliert dabei den Rundenindex – besonders im `"result"`-Zweig
      (`.filter(…).at(-1)`). Suche auf eine index-erhaltende Variante
      umstellen, statt den Index nachträglich zu rekonstruieren.

## 6. Client: Stage-Editor

- [ ] 6.1 Tests für Zeilenrendering und Randfälle schreiben (rot)
      (Bezug: US-1, US-2)
      Eine Zeile je Stage; `↑` in der ersten und `↓` in der letzten Zeile
      deaktiviert; `✕` deaktiviert, solange nur eine Stage existiert.

- [ ] 6.2 Tests für die Interaktionen schreiben (rot)
      (Bezug: US-1, US-2)
      Klick auf `↑`/`↓`/`✕`, Level-Auswahl und "Stage hinzufügen" rufen
      `onChange` jeweils mit der erwarteten Liste auf.

- [ ] 6.3 Tests für die Hinweistexte schreiben (rot)
      (Bezug: US-5)
      Weniger Stages als erwartete Runden → Hinweis auf Wiederverwendung der
      letzten Stage; mehr Stages als Runden → Hinweis auf ungenutzte Stages.

- [ ] 6.4 `StageLevelEditor` implementieren (grün)
      (Bezug: US-1, US-2, US-5)
      Controlled Component ohne eigenen State; Listenoperationen ausschließlich
      über `stageLevelList`. Hoch/Runter statt Drag&Drop (siehe Design,
      "UX-Entscheidung").

- [ ] 6.5 Styles für die Stage-Zeilen ergänzen (Refactor)
      (Bezug: US-1, US-2)
      Vorhandene `pixel-*`-Klassen wiederverwenden; nur ergänzen, was fehlt.

## 7. Client: Setup, Bracket, Present

- [ ] 7.1 Tests für `TournamentSetup` schreiben (rot)
      (Bezug: US-1, US-5)
      Startet mit genau einer Stage; übergibt `stageLevelIds` an `onStart`;
      zeigt die erwartete Rundenzahl passend zu Teilnehmerauswahl und
      Gruppengröße.

- [ ] 7.2 `TournamentSetup` umstellen (grün)
      (Bezug: US-1, US-5)
      Einzel-Level-Auswahl durch `StageLevelEditor` ersetzen;
      `onStart`-Signatur auf `stageLevelIds` umstellen; `estimateRoundCount`
      aus Teilnehmerzahl und Gruppengröße berechnen.

- [ ] 7.3 `AdminPage` durchreichen (grün)
      (Bezug: US-1)
      `stageLevelIds` in die `tournament-configure`-Nachricht aufnehmen.

- [ ] 7.4 Tests für `BracketView` schreiben (rot)
      (Bezug: US-4)
      Je Runde wird der Levelname angezeigt; Statuskennzeichnung
      läuft/abgeschlossen/ausstehend; eine Runde jenseits der konfigurierten
      Stages zeigt den Namen des wiederverwendeten Levels – ohne Zusatzhinweis
      (entschieden).

- [ ] 7.5 `BracketView` erweitern (grün)
      (Bezug: US-4)
      Levelname über `resolveStageLevelId` + Client-Registry (Label);
      Status über `computeRoundStatus`.

- [ ] 7.6 `PresentPage` auf das Rundenlevel umstellen (grün)
      (Bezug: US-3)
      `tournament.levelId` durch
      `resolveStageLevelId(tournament.stageLevelIds, stage.roundIndex)`
      ersetzen und an `MatchView` übergeben.

## 8. Abschluss

- [ ] 8.1 Volle Testsuite grün (`npm test`), Typecheck und Build fehlerfrei
      Besonders auf verbliebene `levelId`-Referenzen achten – das Feld ist
      ersatzlos entfallen.

- [ ] 8.2 Manuelle Verifikation
      (Bezug: US-3, US-4)
      - 8 Bots, Gruppengröße 4, zwei Stages (Level 1, Level 2): Runde 1 läuft
        sichtbar auf Level 1, Runde 2 auf Level 2.
      - Nur eine Stage → alle Runden auf demselben Level
        (Regressions-Schutz gegen das bisherige Verhalten).
      - Drei Runden bei zwei Stages → Runde 3 läuft auf dem Level der zweiten
        Stage; das Bracket zeigt dessen Namen ohne Fehler.
      - Bracket während eines laufenden Turniers: die aktuelle Runde ist als
        "läuft" erkennbar, frühere als "abgeschlossen", spätere als
        "ausstehend".

- [ ] 8.3 Abgleich gegen `requirements.md`
      Alle Akzeptanzkriterien aus US-1 bis US-6 durchgehen und bestätigen.

- [ ] 8.4 `docs/` aktualisieren
      - `docs/07-offene-punkte.md`: Punkt *"Ein Level für alle Heats oder
        mehrere Level-Varianten"* auf erledigt setzen, mit Verweis auf
        `.features/tournament-stage-levels/`.
      - `docs/06-level-design.md`: offene Frage in Zeile 49 entsprechend
        auflösen.
      - `docs/09-bot-artefakt-und-turnier.md`: Turnierablauf um die
        Stage-Level je Runde ergänzen.
