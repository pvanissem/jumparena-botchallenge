# Tasks: Turnier & Match-Ausführung (`tournament-runner`)

Bezug: `requirements.md` (US-1 bis US-8), `design.md`.

Jeder fachliche Task beginnt mit einem fehlschlagenden Test (rot), dann
minimale Implementierung (grün), dann ggf. Refactoring – siehe `AGENTS.md`,
"Test-Driven Development (Pflicht)". Phaser-/Präsentations-Wiring ist laut
Design bewusst ohne Unit-Test und entsprechend markiert.

## A. Contracts & Typen

- [ ] **A1. Turnier-Typen** (US-2, US-4, US-6; Design "Schnittstellen & Datenmodelle")
      Grün (reine Typdatei, kein eigener Test): `packages/shared/src/tournament.ts`
      mit `TournamentMode`, `MatchParticipant`, `MatchStatus`, `MatchDef`,
      `MatchResultEntry`, `MatchResult`, `TournamentState`.
      Bewusst **ohne** `roundIndex` in `MatchDef` und **ohne** `matchId` in
      `MatchResult` (Redundanz-Befund R5 aus dem Review).

- [ ] **A2. Message-Contracts + Typguards** (US-1, US-3, US-5, US-6, US-7)
      Rot: Tests in `packages/shared/src/messages.test.ts` für
      `isTournamentConfigureMessage`, `isMatchStartMessage`,
      `isMatchResultMessage`, `isMatchProgressMessage`,
      `isTournamentResetMessage`, `isTournamentStateMessage`
      (gültige Payload erkannt, fehlende/falsch typisierte Felder abgelehnt).
      Grün: Typen + Guards ergänzen, `InboundMessage`/`OutboundMessage`
      erweitern, Re-Exports in `packages/shared/src/index.ts`.
      Bestehende Ping-/Audio-/Bot-Registry-Tests bleiben unverändert grün.

## B. Server: Turnierlogik

- [ ] **B1. `TournamentStrategy`-Interface** (US-8)
      Grün (reine Schnittstellendatei): `server/src/tournament/TournamentStrategy.ts`
      mit `mode`, `createRounds(participants, levelId)`, `advance(state, result)`.

- [ ] **B2. `SingleEliminationStrategy.createRounds`** (US-2)
      Rot: Gruppengröße nie > 4; Teilnehmerzahlen 1/2/3/4/5/9/16 ergeben die
      erwartete Gruppenaufteilung; Restgruppen bleiben kleiner (kein
      Auffüllen); Gruppe mit genau 1 Bot wird sofort als `finished`-Match mit
      `rank: 1` angelegt (Freilos); injizierte `shuffle`-Funktion macht die
      Zuordnung deterministisch prüfbar.
      Grün: `server/src/tournament/SingleEliminationStrategy.ts` (Teil 1).

- [ ] **B3. `SingleEliminationStrategy.advance`** (US-2, US-4)
      Rot: Ergebnis wird am richtigen Match vermerkt und dessen Status auf
      `finished` gesetzt; nächste Runde entsteht **erst**, wenn alle Matches
      der aktuellen Runde fertig sind; nur Erstplatzierte rücken auf; bleibt
      genau ein Bot übrig → `status: "finished"` + `championBotId`.
      Grün: `advance` implementieren.

- [ ] **B4. `TournamentService`** (US-1, US-3, US-4, US-7)
      Rot: `configure` mit < 2 Teilnehmern → kein Zustand (US-1);
      `configure` erzeugt Zustand mit Teilnehmer-Metadaten aus der
      `BotRegistry`; `startMatch` auf laufendem/beendetem Match → no-op;
      `submitResult` für unbekanntes/nicht laufendes Match → no-op
      (Doppel-`/present`-Schutz, Review-Befund R6); `reset` → Zustand `null`.
      Grün: `server/src/tournament/TournamentService.ts` (einziger Ort, der
      den Zustand mutiert; wählt die Strategie über eine Modus-Registry).

## C. Server: Handler & Anbindung

- [ ] **C1. Broadcast-Helfer** (US-6; Review-Befund R4/DRY)
      Rot: Test, dass der Helfer den aktuellen Service-Zustand als
      `tournament-state` an **alle** Clients sendet (auch `null` nach Reset).
      Grün: `server/src/tournament/broadcastTournamentState.ts`.

- [ ] **C2. Vier Handler** (US-1, US-3, US-4, US-7)
      Rot: je ein Test gegen Fakes für Service + Broadcaster –
      `createTournamentConfigureHandler`, `createMatchStartHandler`,
      `createMatchResultHandler`, `createTournamentResetHandler`:
      korrekter Service-Aufruf, Broadcast nur nach erfolgreicher Mutation,
      kein Broadcast bei No-op.
      Grün: Handler in `server/src/tournament/handlers/`.

- [ ] **C3. `parseInboundMessage` erweitern** (US-1, US-3, US-4, US-7)
      Rot: neue Inbound-Typen werden typisiert zurückgegeben, ungültige
      Payloads ergeben `null`; bestehende Fälle bleiben grün.
      Grün: Typguard-Zweige ergänzen.

- [ ] **C4. Composition Root** (US-6)
      Wiring-Task (ohne Unit-Test): Service + Handler in `server/src/index.ts`
      verdrahten; `match-progress` über den **bestehenden**
      `createBroadcastRelayHandler` weiterreichen (kein neuer Handler nötig);
      `onClientConnected` zusätzlich den `tournament-state`-Snapshot senden
      lassen (neben dem bestehenden Bot-Registry-Snapshot).

## D. Client: reine Match-Logik

- [ ] **D1. `computeGridViewports`** (US-3)
      Rot: 1 → 1×1, 2 → nebeneinander, 3 und 4 → 2×2; Rechtecke überlappen
      sich nicht und decken das Canvas ab; Randfall `count = 0`.
      Grün: `client/src/match/gridViewports.ts`.

- [ ] **D2. `rankMatchResults`** (US-4)
      Rot: Sortierung nach Score absteigend; Gleichstand → kürzere Zeit
      gewinnt; `rank` fortlaufend ab 1; DNF- und `disabled`-Racer werden
      gewertet (kein Ausschluss); nutzt `computeScore` aus `game/scoring.ts`
      (keine eigene Formel, US-8/DRY).
      Grün: `client/src/match/rankMatchResults.ts`.

- [ ] **D3. `matchProgress`** (US-5)
      Rot: `progress` liegt immer zwischen 0 und 1; erreichtes Ziel → 1;
      Startposition → 0.
      Grün: `client/src/match/matchProgress.ts`.

## E. Client: Szene mehrfach instanziierbar machen

- [ ] **E1. Parametrisierbarer Scene-Key** (US-8; Review-Befund R1 – Blocker)
      Rot: `new RaceScene()` trägt den Key `"RaceScene"` (Default unverändert),
      `new RaceScene("abc")` trägt `"abc"`.
      Grün: `constructor(key = "RaceScene") { super(key); }` in
      `client/src/game/scenes/RaceScene.ts`.
      Ohne diesen Task scheitert die Multi-Instanz-Architektur zur Laufzeit mit
      `Cannot add Scene with duplicate key` (im Phaser-Quellcode verifiziert).

- [ ] **E2. Optionen `viewport` und `audio`** (US-3; Review-Befund R2)
      Wiring-Task (ohne Unit-Test, Phaser-abhängig): `RaceSceneInitData` um
      `viewport?` und `audio?` erweitern; bei gesetztem `viewport`
      `cameras.main.setViewport(...)`; bei `audio: false` weder Musik starten
      noch Soundeffekte abspielen. **Defaults = heutiges Verhalten** (`/dev`
      unverändert).
      Manuell verifizieren: `/dev` in beiden Modi (Tastatur/Bot) unverändert.

## F. Client: Match-Ausführung

- [ ] **F1. `MatchRunner`** (US-3, US-4, US-5)
      Wiring-Task (ohne Unit-Test): startet pro Teilnehmer
      `game.scene.add(key, new RaceScene(key), true, initData)` mit eindeutigem
      Key, Viewport aus D1 und `audio: false`; sammelt `onStatusChange`;
      feuert alle 500 ms `onProgress`; beendet das Match, sobald alle Racer
      `finished || didNotFinish || disabled` sind, meldet `onFinished` mit
      `rankMatchResults` und räumt alle Szenen ab; `stop()` räumt ebenfalls ab.

- [ ] **F2. `MatchView`** (US-3; Review-Befund R3)
      Wiring-Task (ohne Unit-Test): erzeugt genau eine `Phaser.Game`-Instanz
      mit `physics.arcade.debug: **false**`, hält den `MatchRunner`, spielt die
      Hintergrundmusik **einmal** fürs ganze Match, räumt beim Unmount auf.

## G. Client: Turnier-Zustand & UI

- [ ] **G1. `useTournamentState`** (US-6)
      Rot: `tournament-state` setzt den Zustand; `state: null` (Reset) leert
      ihn; fremde Message-Typen ändern nichts.
      Grün: `client/src/tournament/useTournamentState.ts`.

- [ ] **G2. `useMatchProgress`** (US-5)
      Rot: letzter `match-progress` je `matchId` wird gehalten; fremde
      Message-Typen ändern nichts; Wechsel auf ein anderes Match überschreibt
      nicht den falschen Eintrag.
      Grün: `client/src/tournament/useMatchProgress.ts`.

- [ ] **G3. `/admin`-UI** (US-1, US-3, US-5, US-7)
      Präsentations-Task (ohne Unit-Test): `TournamentSetup` (Bot-Auswahl mit
      Default „alle", Level-Auswahl aus `LEVEL_REGISTRY`, Modus, Start-Button
      mit Hinweis bei < 2 Teilnehmern), `BracketView`, `MatchLiveStandings`,
      „Nächstes Match starten"- und „Turnier zurücksetzen"-Aktionen.

- [ ] **G4. `/present`-UI** (US-3, US-6)
      Präsentations-Task (ohne Unit-Test): rendert abgeleitet aus
      `TournamentState` genau einen von vier Zuständen – kein Turnier →
      heutige Bot-Liste; Turnier läuft ohne aktives Match → `BracketView`;
      Match `running` → `MatchView`; Turnier `finished` → `ChampionView`.
      Zusätzlich `MatchResultView` nach Match-Ende (US-6).

## H. Abschluss

- [ ] **H1. Manueller End-to-End-Durchlauf** (Design "Test-Strategie")
      Die acht dort beschriebenen Schritte durchspielen – insbesondere
      Schritt 5 (Bot mit `while(true){}` blockiert das Match nicht),
      Schritt 6 (`/present`-Reload zeigt denselben Bracket-Stand),
      Schritt 7 (Reset lässt die Bot-Registry unangetastet) und
      Schritt 8 (**Performance mit 4 Bots** auf der Stand-Hardware – offene
      Frage aus `requirements.md`).

- [ ] **H2. `/dev`-Regressionsprüfung** (US-8)
      `npm run dev`, `/dev` in beiden Modi (Tastatur und Bot) prüfen:
      Kamera, Audio und Verhalten unverändert gegenüber vorher.

- [ ] **H3. Doku nachziehen**
      `docs/09-bot-artefakt-und-turnier.md`: Abschnitt „Ablauf-Komponenten" an
      die tatsächliche Umsetzung angleichen (N parallele Szenen-Instanzen
      statt der ursprünglich skizzierten geteilten Szene mit mehreren Kameras,
      inkl. Begründung „geteilte Welt wäre unfair").
      `docs/07-offene-punkte.md`: Turnier-Umsetzungsstand ergänzen.

- [ ] **H4. Gesamtabgleich**
      Alle Akzeptanzkriterien aus US-1 bis US-8 einzeln durchgehen und
      bestätigen; `npm test` und Typecheck (`tsc --noEmit`) grün.
