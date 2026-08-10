# Tasks: Einstellbare Leben & Ausscheiden bei 0 Leben (`tournament-lives`)

Bezug: `requirements.md` (US-1 bis US-3), `design.md`.

Jeder fachliche Task beginnt mit einem fehlschlagenden Test (rot), dann
minimale Implementierung (grün), dann ggf. Refactoring – siehe `AGENTS.md`.
Phaser-/Präsentations-Wiring ist laut Design bewusst ohne Unit-Test.

## A. Shared: Contract & Validierung

- [x] **A1. Konstanten + `isValidLivesPerRun`** (US-1; Design "Schnittstellen")
      Rot: Tests in `packages/shared/src/tournament.test.ts` – 1 und 99 gültig;
      0, 100, 2.5, `NaN`, `Infinity`, `"3"`, `null`, `undefined` ungültig.
      Grün: `DEFAULT_LIVES_PER_RUN`, `MIN_LIVES_PER_RUN`, `MAX_LIVES_PER_RUN`,
      `isValidLivesPerRun` in `packages/shared/src/tournament.ts`.

- [x] **A2. `TournamentState.livesPerRun` + Message-Feld** (US-1)
      Rot: `isTournamentConfigureMessage` akzeptiert mit UND ohne
      `livesPerRun`, lehnt nicht-numerische Werte ab; `isTournamentStateMessage`
      verlangt `livesPerRun`.
      Grün: Typen + Typguards erweitern, Re-Exports in `index.ts`.
      Bestehende Test-Fixtures um `livesPerRun` ergänzen.

## B. Server: Validierung & Default

- [x] **B1. `TournamentService.configure`** (US-1, US-3)
      Rot: gültiger Wert landet im State; fehlender Wert → `DEFAULT_LIVES_PER_RUN`;
      ungültiger Wert (0, 100, 2.5) → `configure` gibt `null` zurück, State
      bleibt unverändert.
      Grün: Validierung + Default in `TournamentService.configure`.

- [x] **B2. `parseInboundMessage`** (US-1)
      Rot: `tournament-configure` mit und ohne `livesPerRun` wird typisiert
      zurückgegeben.
      Grün: ergibt sich aus A2 – Test absichern, bestehende Fälle grün halten.

## C. Client: reine Regel-Logik

- [x] **C1. `LIVES_PER_RUN` aus Shared** (US-3; Design "Auswirkungen")
      Grün (reine Konstanten-Umstellung): `racerState.ts` re-exportiert
      `DEFAULT_LIVES_PER_RUN`. Bestehende Tests bleiben unverändert grün.

- [x] **C2. `isRacerTerminal`** (US-2)
      Rot: `false` im Normalzustand, `true` bei `finished`, `true` bei
      `didNotFinish`.
      Grün: pure Funktion in `client/src/game/rules/racerState.ts`.

## D. Client: Szene & Wiring

- [x] **D1. `RaceScene.haltRacer()`** (US-2)
      Wiring-Task (ohne Unit-Test, Phaser-abhängig): einmaliger Stopp beim
      Erreichen eines Endzustands – Velocity 0, Gravitation aus, Bot-Worker
      freigeben, Kamera-Follow stoppen; bei Ausscheiden zusätzlich abdunkeln
      und „AUS"-Markierung. `isRacerTerminal` ersetzt die Inline-Bedingung.
      Manuell verifizieren: `/dev` unverändert.

- [x] **D2. `MatchRunner` mit `MatchStartOptions`** (US-1)
      Wiring-Task: `start(options)` statt vier Positions-Parameter,
      `livesPerRun` als `startingLives` in die `RaceSceneInitData`.

- [x] **D3. `MatchView` + `PresentPage`** (US-1)
      Wiring-Task: `livesPerRun` aus dem Turnierzustand durchreichen.

## E. Client: Admin-UI

- [x] **E1. `TournamentSetup`-Eingabefeld** (US-1)
      Präsentations-Task: Zahlenfeld für Leben pro Lauf, vorbelegt mit
      `DEFAULT_LIVES_PER_RUN`, Validierung über `isValidLivesPerRun`,
      Start-Button deaktiviert + Hinweis bei ungültiger Eingabe.

- [x] **E2. `AdminPage`** (US-1)
      Wiring-Task: `livesPerRun` in die `tournament-configure`-Nachricht.

## F. Abschluss

- [ ] **F1. Manuelle Verifikation** (Design "Test-Strategie", Schritte 1–5)
      Leben auf 1 → schnelles Match; ungültige Eingaben blockiert;
      ausgeschiedener Racer bleibt abgedunkelt stehen und tickt nicht mehr;
      Racer im Ziel driftet nicht; `/dev` unverändert.

- [x] **F2. Doku** – `docs/05-scoring-und-heats.md`: Leben pro Lauf als
      konfigurierbar (1–99, Default 3) dokumentieren.

- [x] **F3. Gesamtabgleich** – alle Akzeptanzkriterien aus US-1 bis US-3
      durchgehen; `npm test` und `npm run build` grün.
