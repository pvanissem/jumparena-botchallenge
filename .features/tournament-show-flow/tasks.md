# Tournament Show Flow Implementation Plan

> **Für agentische Umsetzung:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development`
> (empfohlen) oder `superpowers:executing-plans`. Checkboxen werden während der
> Umsetzung live aktualisiert.

**Ziel:** Den bestehenden Single-Elimination-Modus als automatisch
fortschreitende, ausfallsichere Pixel-Arena-Show mit echtem Bracket,
Matchup-Intro, Live-Scoreboard und klarer Admin-Steuerung umsetzen.

**Architektur:** `TournamentService` bleibt für Bracket und Gewinner zuständig.
Ein serverseitiger `TournamentSessionService` orchestriert Phasen, Timer und
genau einen Present-Executor pro Match-Attempt. React rendert den atomaren
Session-Snapshot; nur der geleaste `/present`-Client startet Phaser.

**Tech Stack:** TypeScript, React 18, Phaser 4, Node.js, `ws`, Vitest,
Testing Library, CSS/SVG; keine neue Runtime-Abhängigkeit.

## Globale Constraints

- Striktes TDD: Rot → Grün → Refactor für jede Verhaltensänderung.
- Projektsprache Deutsch; Code, Typen und Bezeichner Englisch.
- `/dev`, Bot-API, Scoring-Formel, Physik und Gruppierungsregeln bleiben
  funktional unverändert.
- Phasenzeiten: Intro 5.000 ms, Countdown 3.000 ms, Ergebnis 6.000 ms,
  Bracket 10.000 ms.
- Nach **jedem** Match einschließlich Finale folgt Ergebnis → Bracket;
  Champion erst danach.
- Genau ein bereiter `/present`-Client simuliert einen Match-Attempt.
- Kein künstlicher Sieger, kein serverseitiger Physikzustand, kein neuer
  Turniermodus.
- Keine neue Bracket-, State-Machine-, Animations- oder Audio-Bibliothek.
- Bestehende lokale Änderung an `package-lock.json` nicht überschreiben.
- Commits nur mit den Dateien des jeweiligen Tasks; fremde lokale Änderungen
  bleiben ungestaged.

## Geplante Dateistruktur

```text
packages/shared/src/
  tournament.ts                         # Show-State und Phasentypen
  messages.ts                           # Rollen-, Control-, Attempt-Contracts

server/src/tournament/
  showTiming.ts                         # feste serverseitige Dauern
  showPhaseMachine.ts                   # pure Hold-/Phasenoperationen
  selectNextPendingMatch.ts             # stabile automatische Matchwahl
  validateMatchResult.ts                # Domainvalidierung vor Mutation
  TournamentSessionService.ts           # Application-Service/Orchestrierung
  broadcastTournamentSession.ts         # atomarer Snapshot
  handlers/                              # dünne Message-Adapter

server/src/audio/
  AudioSettingsStore.ts                 # letzter In-Memory-Audiostand

client/src/tournament/
  useTournamentSession.ts               # Snapshot + Clock-Offset
  useShowCountdown.ts                    # lokaler Countdown gegen Serverzeit
  showSelectors.ts                      # reine UI-Ableitungen
  bracketGraph.ts                       # reale + synthetische Bracket-Slots
  liveStandings.ts                      # gemeinsames Live-Ranking

client/src/components/tournament/
  EventChrome.tsx
  TournamentBracket.tsx
  MatchupStage.tsx
  LiveScoreboard.tsx

client/src/components/
  ShowControlPanel.tsx
  RosterAttractView.tsx

client/src/styles/
  tournament.css
  admin-control-room.css
  present-broadcast.css
```

---

### Task 1: Shared Show- und Message-Contracts

**Bezug:** US-1, US-2, US-3, US-10; Design „Schnittstellen und Datenmodelle“.

**Files:**

- Modify: `packages/shared/src/tournament.ts`
- Modify: `packages/shared/src/messages.ts`
- Modify: `packages/shared/src/messages.test.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**

- Produces: `TournamentShowPhase`, `ShowHoldReason`, `TournamentShowState`
- Produces: `ClientRegisterMessage`, `ClientRegisteredMessage`,
  `PresentReadyMessage`, `TournamentShowControlMessage`
- Changes: `TournamentStateMessage` erhält während der Expand-Phase zunächst
  optionale Felder `show?` und `serverNowMs?`; Task 7 härtet beide nach der
  Servermigration auf required
- Changes: `MatchProgressMessage` und `MatchResultMessage` erhalten während
  der Expand-Phase zunächst `matchAttemptId?: string`; Task 13 härtet das Feld
  nach Migration des Senders auf required

- [x] **Step 1: Failing Contract-Tests schreiben**

  Ergänze konkrete Fälle für alle neuen Guards und die Entfernung des alten
  Contracts:

  ```ts
  expect(isClientRegisterMessage({ type: "client-register", role: "present" })).toBe(true);
  expect(isPresentReadyMessage({ type: "present-ready", ready: true })).toBe(true);
  expect(
    isTournamentShowControlMessage({ type: "tournament-show-control", action: "advance" })
  ).toBe(true);
  expect(
    isMatchResultMessage({ type: "match-result", matchId: "m1", matchAttemptId: "a1", result })
  ).toBe(true);
  // Expand-Phase: bestehender Sender bleibt bis Task 13 parsebar.
  expect(isMatchResultMessage({ type: "match-result", matchId: "m1", result })).toBe(true);
  expect(isTournamentStateMessage({ type: "tournament-state", state: null })).toBe(true);
  ```

- [x] **Step 2: Rot verifizieren**

  Run: `npx vitest run packages/shared/src/messages.test.ts`

  Expected: FAIL wegen fehlender Typen/Guards.

- [x] **Step 3: Minimale Contracts implementieren**

  Verwende exakt:

  ```ts
  export type TournamentShowPhase =
    | "ready"
    | "matchup-intro"
    | "countdown"
    | "match-running"
    | "match-result"
    | "bracket-update"
    | "champion";

  export type ShowHoldReason = "operator" | "present-unavailable";

  export interface TournamentShowState {
    phase: TournamentShowPhase;
    activeMatchId: string | null;
    activeRoundIndex: number | null;
    matchAttemptId: string | null;
    executorClientId: string | null;
    phaseEndsAtMs: number | null;
    heldRemainingMs: number | null;
    holds: ShowHoldReason[];
    presentReady: boolean;
  }
  ```

  Guards prüfen bei vorhandenen Feldern endliche `serverNowMs`, erlaubte
  Literalwerte, Strings und Arrays vollständig. `show`/`serverNowMs` sowie
  `matchAttemptId` sind in dieser Expand-Phase optional; eine vorhandene
  Attempt-ID muss ein nichtleerer String sein. Der alte `match-start`-Contract
  bleibt bis zur atomaren Servermigration in Task 7.

- [x] **Step 4: Grün verifizieren**

  Run: `npx vitest run packages/shared/src/messages.test.ts packages/shared/src/tournament.test.ts`

  Expected: PASS.

- [x] **Step 5: Task-Status aktualisieren und fokussiert committen**

  ```bash
  git add packages/shared/src/tournament.ts packages/shared/src/messages.ts packages/shared/src/messages.test.ts packages/shared/src/index.ts .features/tournament-show-flow/tasks.md
  git commit -m "feat(tournament): add show session contracts"
  ```

---

### Task 2: Rollen und Readiness in der bestehenden ClientRegistry

**Bezug:** US-3, US-10; Design „Client-Rolle und Präsenz“.

**Files:**

- Modify: `server/src/ws/ClientRegistry.ts`
- Modify: `server/src/ws/ClientRegistry.test.ts`
- Modify: `server/src/ws/WebSocketGateway.ts`
- Create: `server/src/ws/WebSocketGateway.test.ts`
- Modify: `server/src/ws/ConnectedClient.ts`

**Interfaces:**

- Produces: `registerRole`, `setPresentReady`, `roleOf`,
  `getReadyPresentClients`
- Produces: `onClientDisconnected(clientId)` Gateway-Callback
- Consumes: `ArenaClientRole` aus Task 1

- [x] **Step 1: Failing Registry- und Disconnect-Tests schreiben**

  ```ts
  registry.add(presentA);
  registry.add(presentB);
  registry.registerRole("present-a", "present");
  registry.registerRole("present-b", "present");
  registry.setPresentReady("present-b", true);

  expect(registry.getReadyPresentClients().map((client) => client.id)).toEqual(["present-b"]);
  registry.remove("present-b");
  expect(registry.getReadyPresentClients()).toEqual([]);
  ```

  Im Gateway-Test muss `close` den Callback genau einmal auslösen, auch wenn
  anschließend `error` feuert.

- [x] **Step 2: Rot verifizieren**

  Run: `npx vitest run server/src/ws/ClientRegistry.test.ts server/src/ws/WebSocketGateway.test.ts`

  Expected: FAIL wegen fehlender Metadatenmethoden/Callback.

- [x] **Step 3: Registry minimal erweitern**

  Rollen/Readiness liegen in derselben Registry wie die Verbindung. `remove`
  löscht Client und Metadaten idempotent. `getReadyPresentClients()` folgt der
  stabilen Einfügereihenfolge der bestehenden `Map`.

- [x] **Step 4: Grün und bestehende WS-Regression verifizieren**

  Run: `npx vitest run server/src/ws`

  Expected: PASS.

- [x] **Step 5: Commit**

  ```bash
  git add server/src/ws .features/tournament-show-flow/tasks.md
  git commit -m "feat(server): track tournament client readiness"
  ```

---

### Task 3: Match-Ergebnisse fachlich validieren

**Bezug:** US-3, US-10; Design „Domainvalidierung des Match-Ergebnisses“.

**Files:**

- Create: `server/src/tournament/validateMatchResult.ts`
- Create: `server/src/tournament/validateMatchResult.test.ts`
- Modify: `server/src/tournament/TournamentStrategy.ts`
- Modify: `server/src/tournament/SingleEliminationStrategy.ts`
- Modify: `server/src/tournament/SingleEliminationStrategy.test.ts`
- Modify: `server/src/tournament/TournamentService.ts`
- Modify: `server/src/tournament/TournamentService.test.ts`

**Interfaces:**

- Produces: `validateMatchResult(match: MatchDef, result: MatchResult): boolean`
- Changes: `advance(state, matchId, result)` statt implizitem running Match

- [x] **Step 1: Failing Validator-Tests schreiben**

  Prüfe gültige vollständige Resultate sowie leere Entries, fremde/fehlende/
  doppelte Bot-IDs, doppelte Ränge, Ranglücken, `NaN`, `Infinity`, negative
  Zählwerte und nicht ganzzahlige Ränge:

  ```ts
  expect(validateMatchResult(match, validResult)).toBe(true);
  expect(validateMatchResult(match, { entries: [] })).toBe(false);
  expect(validateMatchResult(match, duplicateWinnerResult)).toBe(false);
  expect(validateMatchResult(match, resultWithNaNScore)).toBe(false);
  ```

- [x] **Step 2: Rot verifizieren**

  Run: `npx vitest run server/src/tournament/validateMatchResult.test.ts`

  Expected: FAIL, Modul fehlt.

- [x] **Step 3: Validator und explizite Match-ID minimal implementieren**

  Score darf negativ, muss aber endlich sein. `rank`, `fruitScore`,
  `coinsCollected`, `deaths` und `timeElapsedMs` sind nichtnegative ganze
  Zahlen; `rank` beginnt bei 1. `TournamentService.submitResult` validiert vor
  jeder Strategie-Mutation und liefert bei Fehler `false`.

- [x] **Step 4: Grün verifizieren**

  Run: `npx vitest run server/src/tournament/validateMatchResult.test.ts server/src/tournament/SingleEliminationStrategy.test.ts server/src/tournament/TournamentService.test.ts`

  Expected: PASS, inklusive Test „mehrere running Matches ändern nur
  `matchId`“.

- [x] **Step 5: Commit**

  ```bash
  git add server/src/tournament .features/tournament-show-flow/tasks.md
  git commit -m "fix(tournament): validate match results before advancing"
  ```

---

### Task 4: Pure Show-Phasenlogik und Matchauswahl

**Bezug:** US-1, US-2, US-3; Design „Zustandsmaschine und Ablauf“.

**Files:**

- Create: `server/src/tournament/showTiming.ts`
- Create: `server/src/tournament/showPhaseMachine.ts`
- Create: `server/src/tournament/showPhaseMachine.test.ts`
- Create: `server/src/tournament/selectNextPendingMatch.ts`
- Create: `server/src/tournament/selectNextPendingMatch.test.ts`

**Interfaces:**

- Produces: `enterTimedPhase`, `enterUntimedPhase`, `addShowHold`,
  `removeShowHold`, `canAdvance`
- Produces: `selectNextPendingMatch(state): { match; roundIndex } | null`

- [x] **Step 1: Failing Zustands- und Selektortests schreiben**

  ```ts
  const intro = enterTimedPhase(base, "matchup-intro", 1_000, 5_000);
  expect(intro.phaseEndsAtMs).toBe(6_000);

  const held = addShowHold(intro, "operator", 2_000);
  expect(held).toMatchObject({ phaseEndsAtMs: null, heldRemainingMs: 4_000 });

  const resumed = removeShowHold(held, "operator", 10_000);
  expect(resumed.phaseEndsAtMs).toBe(14_000);
  ```

  Selektortests überspringen Freilose, finished und running Matches und wählen
  pending Matches in Runden-/Array-Reihenfolge.

- [x] **Step 2: Rot verifizieren**

  Run: `npx vitest run server/src/tournament/showPhaseMachine.test.ts server/src/tournament/selectNextPendingMatch.test.ts`

  Expected: FAIL, Module fehlen.

- [x] **Step 3: Pure Minimalimplementierung schreiben**

  Keine Timer, keine Registry, kein Broadcast und kein `TournamentService` in
  diesen Modulen. Arrays werden ohne Duplikate behandelt; Entfernen eines
  unbekannten Holds ist identischer No-op.

- [x] **Step 4: Grün verifizieren**

  Run: `npx vitest run server/src/tournament/showPhaseMachine.test.ts server/src/tournament/selectNextPendingMatch.test.ts`

  Expected: PASS.

- [x] **Step 5: Commit**

  ```bash
  git add server/src/tournament/showTiming.ts server/src/tournament/showPhaseMachine.ts server/src/tournament/showPhaseMachine.test.ts server/src/tournament/selectNextPendingMatch.ts server/src/tournament/selectNextPendingMatch.test.ts .features/tournament-show-flow/tasks.md
  git commit -m "feat(tournament): add pure show phase logic"
  ```

---

### Task 5: Automatischen Session-Service implementieren

**Bezug:** US-1, US-2, US-7, US-10; Design „Öffentlicher Vertrag des
Session-Service“ und „Gültige Übergänge“.

**Files:**

- Create: `server/src/tournament/TournamentSessionService.ts`
- Create: `server/src/tournament/TournamentSessionService.test.ts`
- Create: `server/src/tournament/broadcastTournamentSession.ts`
- Create: `server/src/tournament/broadcastTournamentSession.test.ts`

**Interfaces:**

- Consumes: Tasks 2–4
- Produces: `configure`, `control`, `acceptProgress`, `acceptResult`,
  `onPresentAvailabilityChanged`, `reset`, `getSnapshot`
- Produces: injizierbare `Clock`, `ShowScheduler`, `createAttemptId`,
  `publishSnapshot`

- [x] **Step 1: Failing Happy-Path- und Timer-Tests schreiben**

  Mit Fake Clock/Scheduler exakt prüfen:

  ```ts
  expect(session.configure(configureMessage)).toBe(true);
  expect(session.getSnapshot().show?.phase).toBe("ready");

  expect(session.control("start")).toBe(true);
  expect(session.getSnapshot().show).toMatchObject({
    phase: "matchup-intro",
    phaseEndsAtMs: 5_000,
  });

  scheduler.fireCurrent();
  expect(session.getSnapshot().show?.phase).toBe("countdown");
  scheduler.fireCurrent();
  expect(session.getSnapshot().show?.phase).toBe("match-running");
  ```

  Weitere rote Fälle: Pause/Resume mit Restzeit, Advance, Ergebnis 6 s,
  Bracket 10 s, Finale Bracket → Champion, Reset und Reconfigure-Ablehnung.

- [x] **Step 2: Rot verifizieren**

  Run: `npx vitest run server/src/tournament/TournamentSessionService.test.ts server/src/tournament/broadcastTournamentSession.test.ts`

  Expected: FAIL, Module fehlen.

- [x] **Step 3: Minimalen Application-Service implementieren**

  Genau eine Timer-Referenz und monotone `scheduleGeneration` halten. Jeder
  planende/löschende/ersetzende Vorgang inkrementiert die Generation. Callback
  prüft Generation, Phase, Match-ID und erwartete Deadline. Jeder erfolgreiche
  Zustandswechsel veröffentlicht genau einen Snapshot mit `serverNowMs`.

- [x] **Step 4: Grün verifizieren**

  Run: `npx vitest run server/src/tournament/TournamentSessionService.test.ts server/src/tournament/broadcastTournamentSession.test.ts`

  Expected: PASS, insbesondere alter Callback nach Pause/Resume bleibt No-op.

- [x] **Step 5: Commit**

  ```bash
  git add server/src/tournament/TournamentSessionService.ts server/src/tournament/TournamentSessionService.test.ts server/src/tournament/broadcastTournamentSession.ts server/src/tournament/broadcastTournamentSession.test.ts .features/tournament-show-flow/tasks.md
  git commit -m "feat(tournament): orchestrate automatic show phases"
  ```

---

### Task 6: Executor-Lease, Attempts und kontrollierten Failover ergänzen

**Bezug:** US-3, US-6, US-10; Design „Client-Rolle und Präsenz“.

**Files:**

- Modify: `server/src/tournament/TournamentSessionService.ts`
- Modify: `server/src/tournament/TournamentSessionService.test.ts`

**Interfaces:**

- Consumes: `ClientRegistry.getReadyPresentClients()`
- Produces: `executorClientId`, `matchAttemptId`, Attempt-Validierung

- [ ] **Step 1: Failing Lease-/Failover-Tests schreiben**

  ```ts
  session.control("start");
  scheduler.fireCurrent(); // intro -> countdown
  scheduler.fireCurrent(); // ohne ready present darf kein Match starten
  expect(session.getSnapshot().show).toMatchObject({
    phase: "countdown",
    holds: ["present-unavailable"],
  });
  ```

  Prüfe außerdem: stabil erster ready Client, zweiter Present bleibt Display,
  Progress/Result nur vom Executor mit aktueller Attempt-ID, Disconnect macht
  alten Attempt ungültig, neuer ready Client erhält neue Attempt-ID für
  dasselbe Match.

- [ ] **Step 2: Rot verifizieren**

  Run: `npx vitest run server/src/tournament/TournamentSessionService.test.ts`

  Expected: FAIL bei Lease-/Attempt-Fällen.

- [ ] **Step 3: Minimalen Lease-Mechanismus implementieren**

  `countdown → match-running` verlangt einen ready Client. Während
  `match-running` startet ein Executor-Verlust keinen neuen Bracket-Match,
  sondern erzeugt für dasselbe `activeMatchId` einen neuen Attempt, sobald ein
  ready Client existiert. Alter Progress und alte Resultate bleiben No-ops.

- [ ] **Step 4: Grün verifizieren**

  Run: `npx vitest run server/src/tournament/TournamentSessionService.test.ts`

  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add server/src/tournament/TournamentSessionService.ts server/src/tournament/TournamentSessionService.test.ts .features/tournament-show-flow/tasks.md
  git commit -m "feat(tournament): lease one present match executor"
  ```

---

### Task 7: Server-Handler, Command-Policy, Audio-Snapshot und Wiring

**Bezug:** US-2, US-3, US-8, US-10; Design „Show-Control“ und
„Audio-Cues“.

**Files:**

- Create: `server/src/audio/AudioSettingsStore.ts`
- Create: `server/src/audio/AudioSettingsStore.test.ts`
- Create: `server/src/audio/createAudioSettingsHandler.ts`
- Create: `server/src/audio/createAudioSettingsHandler.test.ts`
- Create: `server/src/tournament/handlers/createClientRegisterHandler.ts`
- Create: `server/src/tournament/handlers/createClientRegisterHandler.test.ts`
- Create: `server/src/tournament/handlers/createPresentReadyHandler.ts`
- Create: `server/src/tournament/handlers/createPresentReadyHandler.test.ts`
- Create: `server/src/tournament/handlers/createTournamentShowControlHandler.ts`
- Create: `server/src/tournament/handlers/createTournamentShowControlHandler.test.ts`
- Create: `server/src/tournament/handlers/createMatchProgressHandler.ts`
- Create: `server/src/tournament/handlers/createMatchProgressHandler.test.ts`
- Create: `server/src/tournament/handlers/tournamentHandlers.integration.test.ts`
- Modify: `server/src/tournament/handlers/createTournamentConfigureHandler.ts`
- Modify: `server/src/tournament/handlers/createTournamentConfigureHandler.test.ts`
- Modify: `server/src/tournament/handlers/createTournamentResetHandler.ts`
- Modify: `server/src/tournament/handlers/createTournamentResetHandler.test.ts`
- Modify: `server/src/tournament/handlers/createMatchResultHandler.ts`
- Modify: `server/src/tournament/handlers/createMatchResultHandler.test.ts`
- Modify: `packages/shared/src/messages.ts`
- Modify: `packages/shared/src/messages.test.ts`
- Modify: `server/src/ws/parseMessage.ts`
- Modify: `server/src/ws/parseMessage.test.ts`
- Modify: `server/src/index.ts`
- Delete: `server/src/tournament/handlers/createMatchStartHandler.ts`
- Delete: `server/src/tournament/handlers/createMatchStartHandler.test.ts`

**Interfaces:**

- Consumes: Task 5/6 Session-Service
- Produces: dünne `senderId + message → service`-Adapter
- Produces: letzter Audio-Stand für Connection-Bootstrap

- [ ] **Step 1: Failing Handler-/Wiring-Tests schreiben**

  Prüfe konkret: Configure/Reset/Control nur Admin, PresentReady nur Present,
  Progress/Result nur validierter Executor, stale Progress wird nicht geroutet,
  `client-registered` geht nur an den Sender und neue Clients erhalten letzte
  Audioeinstellung plus atomaren Tournament-Snapshot.

  ```ts
  handler("not-admin", { type: "tournament-show-control", action: "start" });
  expect(session.control).not.toHaveBeenCalled();

  progressHandler("executor", validProgress);
  expect(routeToAll).toHaveBeenCalledWith(validProgress);
  ```

- [ ] **Step 2: Rot verifizieren**

  Run: `npx vitest run server/src/tournament/handlers server/src/ws/parseMessage.test.ts server/src/audio/AudioSettingsStore.test.ts`

  Expected: FAIL wegen fehlender Handler/Stores und altem `match-start`.

- [ ] **Step 3: Handler und Composition Root minimal verdrahten**

  Keine Show-Logik in Handlern. `AudioSettingsStore` hält nur `{muted,
  volume}` in Memory. Entferne Registrierung, Parser und Imports von
  `match-start` einschließlich Shared-Typ/Guard vollständig.
  Härte `TournamentStateMessage.show` und `serverNowMs` jetzt von optional auf
  required; alle serverseitigen Snapshot-Sender sind in diesem Schritt
  migriert.
  Connection-Bootstrap sendet Registry-Snapshot,
  Audio-Stand und `{type:"tournament-state", state, show, serverNowMs}`.

- [ ] **Step 4: Grün inklusive Integration verifizieren**

  Run: `npx vitest run server/src`

  Expected: PASS, inklusive Parser → Dispatcher → Policy → Session →
  Broadcast-Test.

- [ ] **Step 5: Commit**

  ```bash
  git add server/src packages/shared/src/messages.ts packages/shared/src/messages.test.ts .features/tournament-show-flow/tasks.md
  git commit -m "feat(server): wire tournament show commands"
  ```

---

### Task 8: Client-Verbindung, Bootstrap-Readiness und Session-Hooks

**Bezug:** US-1, US-3; Design „Atomarer Session-Snapshot“ und
„Client-Rolle und Präsenz“.

**Files:**

- Modify: `client/src/ws/WebSocketClient.ts`
- Modify: `client/src/ws/WebSocketClient.test.ts`
- Modify: `client/src/ws/useWebSocketConnection.ts`
- Modify: `client/src/botRegistry/useBotRegistry.ts`
- Modify: `client/src/botRegistry/useBotRegistry.test.ts`
- Modify: `client/src/pages/AdminPage.tsx` (nur Compile-Migration auf neuen Hook-Return)
- Modify: `client/src/pages/PresentPage.tsx` (nur Compile-Migration auf neuen Hook-Return)
- Create: `client/src/tournament/useTournamentSession.ts`
- Create: `client/src/tournament/useTournamentSession.test.ts`
- Create: `client/src/tournament/useShowCountdown.ts`
- Create: `client/src/tournament/useShowCountdown.test.ts`

**Interfaces:**

- Produces: `useWebSocketConnection(role)` mit `clientId`
- Produces: Bot-Registry `{ bots, initialized }`
- Produces: Session `{ tournament, show, clockOffsetMs }`
- Produces: `useShowCountdown(show, clockOffsetMs)`

- [ ] **Step 1: Failing Hook-/Reconnect-Tests schreiben**

  ```ts
  receive({ type: "tournament-state", state, show, serverNowMs: 50_000 });
  expect(session.clockOffsetMs).toBe(50_000 - mockedDateNow);

  disconnect();
  expect(registry.initialized).toBe(false);
  reconnect();
  expect(sent).toContainEqual({ type: "client-register", role: "present" });
  ```

  Countdown testet korrigierte Serverzeit, Hold/Null-Deadline und nie negative
  Sekunden.

- [ ] **Step 2: Rot verifizieren**

  Run: `npx vitest run client/src/ws client/src/botRegistry client/src/tournament/useTournamentSession.test.ts client/src/tournament/useShowCountdown.test.ts`

  Expected: FAIL wegen neuer Hook-Verträge.

- [ ] **Step 3: Minimale Hooks implementieren**

  `clientId` wird separat von `lastMessage` gehalten. Jeder Connection-Zyklus
  setzt Registry-Readiness zurück. `/present` kann erst nach neuem
  `bot-registry-snapshot` `present-ready:true` senden. Passe bestehende
  Seitenaufrufer im selben Schritt mechanisch auf `{ bots, initialized }` an,
  ohne ihre visuelle Phasenlogik vor Task 13/14 umzubauen.

- [ ] **Step 4: Grün verifizieren**

  Run: `npx vitest run client/src/ws client/src/botRegistry client/src/tournament`

  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add client/src/ws client/src/botRegistry client/src/tournament client/src/pages/AdminPage.tsx client/src/pages/PresentPage.tsx .features/tournament-show-flow/tasks.md
  git commit -m "feat(client): synchronize tournament show session"
  ```

---

### Task 9: Vollständigen Bracket-Darstellungsgraphen erzeugen

**Bezug:** US-4, US-7; Design „Bracket-Visualisierung – Datenmodell“.

**Files:**

- Create: `client/src/tournament/bracketGraph.ts`
- Create: `client/src/tournament/bracketGraph.test.ts`
- Create: `client/src/tournament/showSelectors.ts`
- Create: `client/src/tournament/showSelectors.test.ts`

**Interfaces:**

- Produces: `buildBracketGraph(rounds, groupSize)`
- Produces: `selectVisibleRoundRange`, `countRemainingBots`,
  `countCompletedMatches`, `selectActiveMatch`

- [ ] **Step 1: Failing Graph-/Selector-Tests schreiben**

  Für Gruppengröße 4 und fünf Erstrunden-Matches müssen Slotzahlen
  `[5, 2, 1]` entstehen. Nach Sieg in erstem Match muss die Kante zum noch
  synthetischen Zielslot hervorgehoben sein:

  ```ts
  const graph = buildBracketGraph([firstRound], 4);
  expect(roundCounts(graph.nodes)).toEqual([5, 2, 1]);
  expect(graph.edges.find((edge) => edge.sourceNodeId === "round-0-slot-0"))
    .toMatchObject({ targetNodeId: "round-1-slot-0", highlighted: true });
  ```

- [ ] **Step 2: Rot verifizieren**

  Run: `npx vitest run client/src/tournament/bracketGraph.test.ts client/src/tournament/showSelectors.test.ts`

  Expected: FAIL, Module fehlen.

- [ ] **Step 3: Pure Graph-/Selektorlogik implementieren**

  Slot-ID immer `round-<r>-slot-<i>`, unabhängig davon, ob ein reales Match
  existiert. Keine React-/DOM-/Phaser-Imports. Present-Rundenausschnitt enthält
  höchstens drei Spalten um die aktive Runde.

- [ ] **Step 4: Grün verifizieren**

  Run: `npx vitest run client/src/tournament/bracketGraph.test.ts client/src/tournament/showSelectors.test.ts`

  Expected: PASS für Gruppengröße 2/4, Freilose, ungerade Gruppen und
  teilabgeschlossene Runden.

- [ ] **Step 5: Commit**

  ```bash
  git add client/src/tournament/bracketGraph.ts client/src/tournament/bracketGraph.test.ts client/src/tournament/showSelectors.ts client/src/tournament/showSelectors.test.ts .features/tournament-show-flow/tasks.md
  git commit -m "feat(client): build complete tournament bracket graph"
  ```

---

### Task 10: Gemeinsame visuelle Bracket-Komponente

**Bezug:** US-4, US-7, US-8, US-9; Design „Bracket-Rendering“.

**Files:**

- Create: `client/src/components/tournament/TournamentBracket.tsx`
- Create: `client/src/components/tournament/TournamentBracket.test.tsx`

**Interfaces:**

- Consumes: `buildBracketGraph`, `selectVisibleRoundRange`
- Produces: `<TournamentBracket state show variant="admin" | "present" />`

- [ ] **Step 1: Failing semantische Komponententests schreiben**

  Teste Round-/Level-Headings, pending/running/finished, Sieger,
  ausgeschiedene Teilnehmer, synthetische Slots, Next-Match-Markierung und
  Present-Ausschnitt. SVG ist `aria-hidden="true"`; Matchdaten bleiben als
  semantische Artikel lesbar.

- [ ] **Step 2: Rot verifizieren**

  Run: `npx vitest run client/src/components/tournament/TournamentBracket.test.tsx`

  Expected: FAIL, Komponente fehlt.

- [ ] **Step 3: React-/SVG-Rendering minimal implementieren**

  Runde als Spalte, Match als Artikel. Ein `ResizeObserver` misst nur
  Knotenmittelpunkte; Kantenlogik bleibt in `bracketGraph.ts`. Keine externe
  Diagrammbibliothek und keine Start-Buttons in Knoten.

- [ ] **Step 4: Grün verifizieren**

  Run: `npx vitest run client/src/components/tournament/TournamentBracket.test.tsx client/src/tournament/bracketGraph.test.ts`

  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add client/src/components/tournament .features/tournament-show-flow/tasks.md
  git commit -m "feat(ui): render adaptive tournament bracket"
  ```

---

### Task 11: Gemeinsame Live-Standings und Scoreboard

**Bezug:** US-6, US-7, US-10; Design „Live-Standings und Score“.

**Files:**

- Create: `client/src/tournament/liveStandings.ts`
- Create: `client/src/tournament/liveStandings.test.ts`
- Create: `client/src/components/tournament/LiveScoreboard.tsx`
- Create: `client/src/components/tournament/LiveScoreboard.test.tsx`

**Interfaces:**

- Produces: `buildLiveStandings(match, entries, livesPerRun)`
- Produces: `<LiveScoreboard standings variant="admin" | "present" />`

- [ ] **Step 1: Failing Ranking-/Rendering-Tests schreiben**

  ```ts
  const standings = buildLiveStandings(match, entries, 3);
  expect(standings.map((entry) => entry.botId)).toEqual(["leader", "chaser"]);
  expect(standings[0]).toMatchObject({ rank: 1, status: "racing" });
  ```

  Sortierung exakt: Score absteigend, Fortschritt absteigend, Zeit
  aufsteigend, Bot-ID stabil. Ohne Progress entstehen neutrale Zeilen für alle
  Teilnehmer. Rendering zeigt Rang, Farbe, Name, Score, Fortschritt, Leben,
  Restzeit und Status.

- [ ] **Step 2: Rot verifizieren**

  Run: `npx vitest run client/src/tournament/liveStandings.test.ts client/src/components/tournament/LiveScoreboard.test.tsx`

  Expected: FAIL, Module fehlen.

- [ ] **Step 3: Minimal implementieren und `computeScore` wiederverwenden**

  Keine zweite Scoring-Formel. Status ist genau `racing | finished | dnf |
  disabled`. Führungswechsel werden nur über Klassen/Datenattribute
  vorbereitet; Animation folgt in Task 14.

- [ ] **Step 4: Grün verifizieren**

  Run: `npx vitest run client/src/tournament/liveStandings.test.ts client/src/components/tournament/LiveScoreboard.test.tsx client/src/game/scoring.test.ts`

  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add client/src/tournament/liveStandings.ts client/src/tournament/liveStandings.test.ts client/src/components/tournament/LiveScoreboard.tsx client/src/components/tournament/LiveScoreboard.test.tsx .features/tournament-show-flow/tasks.md
  git commit -m "feat(ui): add shared live tournament scoreboard"
  ```

---

### Task 12: MatchRunner auf serverautoritative Ergebnisphase umstellen

**Bezug:** US-1, US-6, US-7; Design „Entfernung der doppelten
Ergebnisverzögerung“.

**Files:**

- Modify: `client/src/match/MatchRunner.ts`
- Create: `client/src/match/MatchRunner.test.ts`

**Interfaces:**

- Removes: `WINNER_SHOWCASE_MS` und lokalen Showcase-Timer

- [ ] **Step 1: Failing MatchRunner-Test schreiben**

  Fake Racer-Endzustände auslösen und prüfen, dass `onFinished` genau einmal
  synchron/nächster Microtask gerufen wird, ohne 10-Sekunden-Timer. Einzelne
  Kachel-Outcomes bleiben vor Abschluss aller Racer erhalten.

- [ ] **Step 2: Rot verifizieren**

  Run: `npx vitest run client/src/match/MatchRunner.test.ts client/src/match/tileOverlays.test.ts`

  Expected: FAIL wegen bestehendem `WINNER_SHOWCASE_MS`.

- [ ] **Step 3: Lokale Verzögerung minimal entfernen**

  Progress-Timer bleibt 500 ms. `reportedFinished` verhindert weiterhin
  Doppelresultate. Keine Änderung an Ranking oder Phaser-Spielregeln.

- [ ] **Step 4: Grün verifizieren**

  Run: `npx vitest run client/src/match`

  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add client/src/match .features/tournament-show-flow/tasks.md
  git commit -m "refactor(match): hand result timing to show session"
  ```

---

### Task 13: `/present` als phasengesteuerte Event-Bühne integrieren

**Bezug:** US-3, US-5, US-6, US-7, US-8; Design „`/present`-Stages“.

**Files:**

- Create: `client/src/components/tournament/EventChrome.tsx`
- Create: `client/src/components/tournament/EventChrome.test.tsx`
- Create: `client/src/components/tournament/MatchupStage.tsx`
- Create: `client/src/components/tournament/MatchupStage.test.tsx`
- Create: `client/src/components/RosterAttractView.tsx`
- Create: `client/src/components/RosterAttractView.test.tsx`
- Modify: `client/src/components/MatchResultView.tsx`
- Create: `client/src/components/MatchResultView.test.tsx`
- Modify: `client/src/components/ChampionView.tsx`
- Create: `client/src/components/ChampionView.test.tsx`
- Modify: `client/src/pages/PresentPage.tsx`
- Create/Modify: `client/src/pages/PresentPage.test.tsx`
- Create: `client/src/game/audio/useShowAudioCue.ts`
- Create: `client/src/game/audio/useShowAudioCue.test.ts`
- Modify: `packages/shared/src/messages.ts`
- Modify: `packages/shared/src/messages.test.ts`
- Modify: `server/src/ws/parseMessage.test.ts`

**Interfaces:**

- Consumes: Tasks 8–12
- Produces: genau eine Stage je `TournamentShowPhase`
- Produces: Phaser-Mount nur bei lokalem Executor

- [ ] **Step 1: Failing Stage-/Page-Tests schreiben**

  Prüfe 2/3/4 Teilnehmer, Countdown, Result, Bracket, Champion und Roster.
  Zentraler Executor-Test:

  ```tsx
  renderPresent({ phase: "match-running", clientId: "display", executorClientId: "exec" });
  expect(screen.queryByTestId("match-view")).toBeNull();

  renderPresent({ phase: "match-running", clientId: "exec", executorClientId: "exec" });
  expect(screen.getByTestId("match-view")).toBeTruthy();
  ```

  Prüfe außerdem, dass Progress/Result immer die aktuelle `matchAttemptId`
  senden, Nachrichten ohne Attempt-ID nach der Contract-Phase abgelehnt
  werden und `present-ready` erst nach Registry-Bootstrap gesendet wird.

- [ ] **Step 2: Rot verifizieren**

  Run: `npx vitest run client/src/pages/PresentPage.test.tsx client/src/components/tournament client/src/game/audio/useShowAudioCue.test.ts`

  Expected: FAIL wegen fehlender Stages/Executor-Abgleich.

- [ ] **Step 3: Present-Komposition minimal implementieren**

  `PresentPage` switcht ausschließlich auf `show.phase`; keine parallele
  `selectMatchStage`-Logik. `MatchView`-Key enthält Match- und Attempt-ID.
  `useShowAudioCue` spielt bestehende `boingo`/`complete`-Assets einmal pro
  Phasen-/Matchwechsel und respektiert `audioSettings` sowie Play-Rejections.
  Härte anschließend `matchAttemptId` in Progress-/Result-Contract und Guard
  von optional auf required; alle Sender sind in diesem Schritt migriert.

- [ ] **Step 4: Grün verifizieren**

  Run: `npx vitest run client/src/pages/PresentPage.test.tsx client/src/components client/src/game/audio client/src/tournament`

  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add client/src/pages/PresentPage.tsx client/src/pages/PresentPage.test.tsx client/src/components client/src/game/audio client/src/tournament packages/shared/src/messages.ts packages/shared/src/messages.test.ts server/src/ws/parseMessage.test.ts .features/tournament-show-flow/tasks.md
  git commit -m "feat(present): add pixel arena tournament broadcast"
  ```

---

### Task 14: `/admin` als Show-Control-Room integrieren

**Bezug:** US-2, US-7, US-9; Design „`/admin`-Control-Room“.

**Files:**

- Create: `client/src/components/ShowControlPanel.tsx`
- Create: `client/src/components/ShowControlPanel.test.tsx`
- Modify: `client/src/pages/AdminPage.tsx`
- Create: `client/src/pages/AdminPage.test.tsx`
- Modify: `client/src/components/TournamentSetup.tsx`
- Modify: `client/src/components/TournamentSetup.test.tsx`
- Delete: `client/src/components/BracketView.tsx`
- Delete: `client/src/components/BracketView.test.tsx`
- Delete: `client/src/components/MatchLiveStandings.tsx`
- Delete: `client/src/tournament/useTournamentState.ts`
- Delete: `client/src/tournament/useTournamentState.test.ts`
- Delete: `client/src/tournament/selectMatchStage.ts`
- Delete: `client/src/tournament/selectMatchStage.test.ts`

**Interfaces:**

- Consumes: Session, Countdown, Bracket, LiveScoreboard
- Produces: Start/Pause/Resume/Advance/Reset-Commands

- [ ] **Step 1: Failing Control-Room-Tests schreiben**

  Prüfe gültige Aktionen je Phase, Restzeit, Present-Warnung, Next Match,
  letztes Ergebnis und Reset-Bestätigung:

  ```ts
  await user.click(screen.getByRole("button", { name: "Show starten" }));
  expect(send).toHaveBeenCalledWith({ type: "tournament-show-control", action: "start" });

  renderControl({ phase: "match-running" });
  expect(screen.queryByRole("button", { name: "Sofort weiter" })).toBeNull();
  ```

- [ ] **Step 2: Rot verifizieren**

  Run: `npx vitest run client/src/components/ShowControlPanel.test.tsx client/src/pages/AdminPage.test.tsx client/src/components/TournamentSetup.test.tsx`

  Expected: FAIL wegen fehlender Control-Komponente/Session-Integration.

- [ ] **Step 3: Minimalen Control Room implementieren**

  Entferne Match-Startbuttons vollständig. Danger-Zone nutzt bewusst
  `window.confirm`; bei Abbruch kein Reset-Command. Vorbereitungsansicht zeigt
  Bot-Sammelstelle + Setup, laufende Ansicht Control + vollständiges Bracket +
  Live/letzten Stand.

- [ ] **Step 4: Grün verifizieren**

  Run: `npx vitest run client/src/components/ShowControlPanel.test.tsx client/src/pages/AdminPage.test.tsx client/src/components/TournamentSetup.test.tsx`

  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add client/src/components/ShowControlPanel.tsx client/src/components/ShowControlPanel.test.tsx client/src/components/TournamentSetup.tsx client/src/components/TournamentSetup.test.tsx client/src/components/BracketView.tsx client/src/components/BracketView.test.tsx client/src/components/MatchLiveStandings.tsx client/src/pages/AdminPage.tsx client/src/pages/AdminPage.test.tsx client/src/tournament/useTournamentState.ts client/src/tournament/useTournamentState.test.ts client/src/tournament/selectMatchStage.ts client/src/tournament/selectMatchStage.test.ts .features/tournament-show-flow/tasks.md
  git commit -m "feat(admin): add tournament show control room"
  ```

---

### Task 15: Responsive Pixel-Arena-Visuals, Motion und Accessibility

**Bezug:** US-4, US-5, US-6, US-8, US-9; Design „UX- und Visual-Design“.

**Files:**

- Create: `client/src/styles/tournament.css`
- Create: `client/src/styles/admin-control-room.css`
- Create: `client/src/styles/present-broadcast.css`
- Modify: `client/src/main.tsx` für Style-Imports
- Modify: `client/src/components/tournament/TournamentBracket.test.tsx`
- Modify: `client/src/components/tournament/LiveScoreboard.test.tsx`
- Modify: `client/src/components/tournament/MatchupStage.test.tsx`
- Modify: `client/src/components/ShowControlPanel.test.tsx`
- Modify: `client/src/pages/PresentPage.test.tsx`
- Modify: `client/src/pages/AdminPage.test.tsx`

**Interfaces:**

- Consumes: semantische Komponentenklassen aus Tasks 10–14
- Produces: responsive Varianten und `prefers-reduced-motion`

- [ ] **Step 1: Failing Struktur-/Accessibility-Assertions ergänzen**

  Prüfe stabile Zustandsattribute statt Pixelwerte:

  ```ts
  expect(bracket).toHaveAttribute("data-variant", "present");
  expect(activeMatch).toHaveAttribute("aria-current", "step");
  expect(leader).toHaveAttribute("data-leader", "true");
  ```

- [ ] **Step 2: Rot verifizieren**

  Run: `npx vitest run client/src/components client/src/pages`

  Expected: FAIL bei fehlenden ARIA-/Datenattributen.

- [ ] **Step 3: Drei fokussierte Stylesheets implementieren**

  Bestehende Tokens wiederverwenden. `clamp()` für Event-Typografie;
  Matchup 3/4 bei schmaler Breite als 2×2; Present-Bracket ohne manuelles
  Scrollen; Admin-Bracket horizontal navigierbar; Control-Bereiche unter
  Desktop-Breakpoint stapeln. `prefers-reduced-motion: reduce` deaktiviert
  Einflug, Pfadzeichnung, Konfetti und Rangwechselbewegung.

- [ ] **Step 4: Tests, Build und manuelle Viewport-Matrix**

  Run: `npx vitest run client/src/components client/src/pages`

  Run: `npm run build -w @arena/client`

  Manuell: 1920×1080, 1366×768 und 1024×768; Matchups mit 2/3/4 Bots;
  Admin gestapelt; Reduced Motion. Expected: keine abgeschnittenen
  Pflichtinformationen, keine Überlagerung der Phaser-Ansicht.

- [ ] **Step 5: Commit**

  ```bash
  git add client/src/styles client/src/main.tsx client/src/components client/src/pages .features/tournament-show-flow/tasks.md
  git commit -m "feat(ui): polish responsive tournament broadcast"
  ```

---

### Task 16: Gesamtabgleich, Betriebsdoku und Abschlussverifikation

**Bezug:** US-1 bis US-10; Design „Test-Strategie“.

**Files:**

- Modify: `docs/09-bot-artefakt-und-turnier.md`
- Modify: `docs/03-architektur.md`
- Modify: `.features/tournament-show-flow/tasks.md`

**Interfaces:**

- Consumes: alle vorherigen Tasks
- Produces: dokumentierter, vollständig verifizierter Event-Flow

- [ ] **Step 1: Automatisierten Gesamtlauf ausführen**

  ```bash
  npm test
  npm run build
  npm run check
  ```

  Expected: alle Befehle Exit 0. Bei Fehler zuerst Ursache beheben und den
  betroffenen Task erneut Rot–Grün durchlaufen.

- [ ] **Step 2: Manuellen End-to-End-Ablauf durchführen**

  Prüfe in dieser Reihenfolge:

  1. Turnier mit Gruppengröße 2, Freilos und mehreren Runden aufstellen.
  2. Show einmal starten; Intro 5 s, Countdown 3 s.
  3. Match mit Live-Score auf `/present` und `/admin` verfolgen.
  4. Ergebnis 6 s, Bracket 10 s, nächstes Intro automatisch.
  5. Pause/Resume und Advance in jeder erlaubten Phase.
  6. Countdown ohne ready Present bleibt gehalten.
  7. Executor während Match trennen; neuer Attempt startet dasselbe Match.
  8. Zweiter Present bleibt Display-only und simuliert nicht.
  9. Finale zeigt Ergebnis → Bracket → Champion.
  10. Reset lässt Bot-Registry unverändert.

- [ ] **Step 3: `/dev`-Regressionsprüfung durchführen**

  Tastatur- und Bot-Modus in `/dev` starten; Levelwechsel, Audio, ScoreHud,
  FinishOverlay und Neustart prüfen. Expected: funktional und visuell
  unverändert.

- [ ] **Step 4: Architektur- und Betriebsdoku aktualisieren**

  Dokumentiere serverautoritative Show-Phasen, Executor-Attempts,
  `/admin`-Control-Room, `/present`-Stages und den Wegfall manueller
  Matchstarts. Keine zukünftigen Möglichkeiten als bereits implementiert
  darstellen.

- [ ] **Step 5: Requirements einzeln abhaken und Abschluss committen**

  US-1 bis US-10 gegen die konkreten Tests/manuellen Schritte prüfen, danach
  alle erledigten Checkboxen in dieser Datei auf `[x]` setzen.

  ```bash
  git add docs/03-architektur.md docs/09-bot-artefakt-und-turnier.md .features/tournament-show-flow/tasks.md
  git commit -m "docs: document automatic tournament show flow"
  ```
