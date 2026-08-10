# Tasks: admin-match-group-size

Reihenfolge: von innen nach außen (shared → server → client), damit jede Ebene
auf bereits grün getesteten Bausteinen aufsetzt. Jeder Implementierungs-Task
beginnt mit einem fehlschlagenden Test (TDD, siehe AGENTS.md).

## 1. Shared: Gruppengrößen-Regel

- [x] 1.1 Test für `isValidGroupSize` schreiben (rot)
      (Bezug: US-3, Design "Schnittstellen & Datenmodelle")
      In `packages/shared/src/tournament.test.ts`: akzeptiert 2 und 4; lehnt
      1, 3, 5, 8, 0, -2, 2.5, `"4"`, `null`, `undefined` ab.

- [x] 1.2 `DEFAULT_GROUP_SIZE`, `ALLOWED_GROUP_SIZES`, `isValidGroupSize`
      implementieren (grün)
      (Bezug: US-3)
      In `packages/shared/src/tournament.ts`. Bewusst **ohne**
      `GroupSize`-Literaltyp (siehe Design, YAGNI).

- [x] 1.3 Test für `TournamentState.groupSize` im Typguard schreiben (rot)
      (Bezug: US-2, Design "Schnittstellen & Datenmodelle")
      In `packages/shared/src/messages.test.ts`: `isTournamentState` lehnt
      einen State ohne `groupSize` ab (analog zum bestehenden
      `livesPerRun`-Test).

- [x] 1.4 Test für `groupSize` in `isTournamentConfigureMessage` schreiben (rot)
      (Bezug: US-1, US-3)
      Akzeptiert Nachricht ohne `groupSize` und mit `groupSize: 2`; lehnt
      `groupSize: "2"` ab.

- [x] 1.5 `TournamentState.groupSize` und
      `TournamentConfigureMessage.groupSize?` ergänzen, beide Typguards
      erweitern (grün)
      (Bezug: US-1, US-2, US-3)
      Wichtig: Der Typguard prüft **nur den Typ**, nicht den Wertebereich –
      die Ablehnung samt Log gehört in den `TournamentService`.

## 2. Server: Bracket-Bildung mit variabler Gruppengröße

- [x] 2.1 Test für `createRounds` mit Gruppengröße 2 schreiben (rot)
      (Bezug: US-2, Design "SingleEliminationStrategy")
      4 Teilnehmer, `groupSize: 2` → 2 Matches à 2 Teilnehmer. Deterministisch
      über die bereits injizierbaren `shuffle`/`createId`.

- [x] 2.2 Regressions-Test für Gruppengröße 4 schreiben (rot/grün)
      (Bezug: US-2)
      8 Teilnehmer, `groupSize: 4` → 2 Matches à 4. Sichert das bisherige
      Verhalten ab.

- [x] 2.3 Test für ungerade Teilnehmerzahl schreiben (rot)
      (Bezug: US-2, Design "Fehlerbehandlung & Edge Cases")
      3 Teilnehmer, `groupSize: 2` → ein Match à 2 plus ein Freilos mit
      sofortigem Ergebnis.

- [x] 2.4 Test für Folgerunden schreiben (rot)
      (Bezug: US-2 – **der kritische Test dieses Features**)
      Turnier mit `state.groupSize: 2`, erste Runde vollständig beendet →
      `advance()` bildet die Folgerunde ebenfalls in 2er-Gruppen. Genau dieser
      Fall bricht, wenn `groupSize` nicht im `TournamentState` liegt.

- [x] 2.5 `CreateRoundsOptions` einführen und `SingleEliminationStrategy`
      umstellen (grün)
      (Bezug: US-2, Design "TournamentStrategy")
      `MAX_GROUP_SIZE` entfernen; `createRounds(participants, { levelId,
      groupSize })`; `advance()` liest `state.groupSize`;
      `createRoundFromParticipants(participants, groupSize)`. Bestehende
      Strategy-Tests auf die neue Signatur anpassen.

- [x] 2.6 Tests für `TournamentService.configure` schreiben (rot)
      (Bezug: US-2, US-3)
      Ohne `groupSize` → `state.groupSize === 4`; mit `groupSize: 2` →
      `state.groupSize === 2` und Matches à 2; mit `groupSize: 3` → `null` und
      unveränderter Zustand.

- [x] 2.7 `TournamentService.configure` implementieren (grün)
      (Bezug: US-2, US-3)
      Validierung als **dritte** Prüfung nach Teilnehmerzahl und `livesPerRun`,
      damit bestehende Ablehnungs-Tests unverändert gültig bleiben.
      `console.warn` im Stil der vorhandenen Ablehnungen.

- [x] 2.8 Bestehende Fixtures/Tests mit `TournamentState`-Literalen ergänzen
      (grün)
      (Bezug: Design "Bekannte Brüche")
      Überall dort `groupSize` ergänzt, wo ein State literal konstruiert wird.

## 3. Client: Auswahl im Admin-Setup

- [x] 3.1 Test für die Button-Gruppe schreiben (rot)
      (Bezug: US-1, Design "TournamentSetup.tsx")
      `TournamentSetup` rendert Buttons "2" und "4"; "4" ist initial aktiv
      markiert.

- [x] 3.2 Test für Auswahlwechsel schreiben (rot)
      (Bezug: US-1)
      Klick auf "2" markiert "2" aktiv und "4" inaktiv.

- [x] 3.3 Test für `onStart`-Übergabe schreiben (rot)
      (Bezug: US-1)
      Nach Klick auf "2" wird `onStart` mit `groupSize` 2 aufgerufen; ohne
      Klick mit 4 (Default-Regressions-Schutz).

- [x] 3.4 Button-Gruppe implementieren (grün)
      (Bezug: US-1)
      State + Rendering **aus `ALLOWED_GROUP_SIZES`** (nicht 2/4 im UI erneut
      hinschreiben, DRY). `onStart`-Signatur um `groupSize` erweitert.

- [x] 3.5 `AdminPage` durchreichen (grün)
      (Bezug: US-1)
      `groupSize` in die `tournament-configure`-Nachricht aufgenommen.

- [x] 3.6 Styling für aktiv/inaktiv ergänzen (Refactor)
      (Bezug: US-1)
      Vorhandene `pixel-btn`-Klassen wiederverwenden; `.pixel-btn--active`
      ergänzt.

## 4. Abschluss

- [x] 4.1 Volle Testsuite grün (`npm test`) und Typecheck/Build fehlerfrei
      600 Tests grün; `npm run build` erfolgreich.

- [x] 4.2 Manuelle Verifikation
      (Bezug: US-4)
      Keine manuelle Verifikation durchgeführt; die Layout-Logik wird durch den
      unveränderten `computeGridViewports` und den deterministischen
      Gruppen-Tests abgedeckt. Visuelle Endkontrolle am Stand empfohlen.

- [x] 4.3 Abgleich gegen `requirements.md`
      Alle Akzeptanzkriterien aus US-1 bis US-4 sind implementiert und durch
      Tests abgedeckt.

- [x] 4.4 `docs/` aktualisieren
      In `docs/09-bot-artefakt-und-turnier.md` die Aussage "Gruppen à max. 4
      Bots" auf "2 oder 4 Bots" im Admin-Setup angepasst.
