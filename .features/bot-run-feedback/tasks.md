# Tasks: Bot-Run-Feedback

> **Für agentische Umsetzung:** Vor der Implementierung den Skill
> `superpowers:subagent-driven-development` (empfohlen) oder
> `superpowers:executing-plans` verwenden. Alle fachlichen Schritte laufen strikt
> Rot–Grün–Refactor; Checkboxen werden unmittelbar nach jedem Schritt gepflegt.

**Ziel:** Jeder einzelne Bot-Versuch in `/dev` erzeugt beim Tod, Ziel, Zeitlimit,
Abbruch oder technischer Pause genau eine kompakte, zeitgestempelte JSON-Datei,
die der Bot-Agent für einen kurzen Feedback-Loop lesen kann.

**Architektur:** `RaceScene` liefert Arena-Fakten und korrelierte
Bot-Entscheidungen an einen optionalen, browserseitigen `BotRunRecorder`. Der
Recorder analysiert einen Versuch und liefert beim Abschluss genau ein Artefakt;
`DevPage` sendet es an eine Vite-Middleware, die eine neue Timestamp-Datei unter
`client/src/bot/runs/` schreibt. Ohne explizite `/dev`-Telemetrie bleibt der gesamte
Pfad ein No-op.

**Tech-Stack:** TypeScript, React, Phaser, Vite-Middleware, Vitest, Testing
Library, Node-Dateisystem-APIs.

## Globale Constraints

- Fachliche Quelle: `requirements.md`; technische Quelle: `design.md`.
- Telemetrie ausschließlich bei expliziter Aktivierung im Bot-Modus von `/dev`.
- Ein Run = Start/Respawn bis Tod, Ziel, Zeitlimit, Abbruch oder Bot-Pause.
- Ein Run-Ende = genau ein POST = genau eine neue Timestamp-Datei.
- Keine tickweisen oder periodischen Requests, keine spätere Aktualisierung
  einer Run-Datei.
- Keine zusätzlichen `decide(state)`-Aufrufe und keine Änderung an Physik,
  Action-Auswertung, Wertung, Bot-Takt oder Zeitlimit.
- Produktivcode ausschließlich nach rot bestätigtem Test.
- Nach jedem Task die jeweils betroffenen Tests und am Ende die komplette Suite
  ausführen.

---

## 1. Trace-Datenmodell und kompakte Tick-Samples

**Bezug:** US-3, US-5, Design „Datenmodell“ und „Kompakte Tick-Samples“.

**Dateien:**

- Neu: `client/src/game/trace/types.ts`
- Neu: `client/src/game/trace/compactBotTick.ts`
- Neu: `client/src/game/trace/compactBotTick.test.ts`

**Schnittstellen:**

- `compactBotTick(state: BotState): TraceTickSample`
- `TraceTickSample` enthält zunächst `decision: null`; der Recorder ergänzt das
  Entscheidungsergebnis später anhand von `tick`.
- Listenlimits: drei Coins, vier Plattformen; Tuning liegt separat in den
  Run-Metadaten.

- [x] 1.1 Test-Fixture für einen vollständigen `BotState` und einen roten Test
      schreiben, der Rundung, Listenlimits und das Weglassen redundanter Felder
      prüft.
- [x] 1.2 `npm test -w @arena/client -- compactBotTick.test.ts` ausführen und
      das Fehlschlagen wegen fehlender Implementierung bestätigen.
- [x] 1.3 `types.ts` mit `RunResult`, `BotDecisionTrace`, `TraceTickSample`,
      `TraceEvent`, `TraceFinding`, `TraceWindow`, `BotRunSummary` und
      `BotRunTrace` gemäß `design.md` implementieren.
- [x] 1.4 `compactBotTick()` minimal implementieren: diagnosewichtige Felder
      kopieren, Zahlen runden, Coins/Plattformen begrenzen, keine Mutation des
      Inputs.
- [x] 1.5 Tests ausführen und grün bestätigen.
- [x] 1.6 Negativen Test ergänzen, der `JSON.stringify()` ohne `Infinity`,
      `NaN`, Map, Set oder Phaser-Objekt bestätigt; Implementierung nur soweit
      nötig nachziehen und Tests erneut grün ausführen.

## 2. Relevante Diagnosefenster auswählen

**Bezug:** US-3, US-5, Design „Diagnosefenster“.

**Dateien:**

- Neu: `client/src/game/trace/selectTraceWindows.ts`
- Neu: `client/src/game/trace/selectTraceWindows.test.ts`

**Schnittstelle:**

- `selectTraceWindows(samples, anchors, options?): TraceWindow[]`
- Default: 45 Ticks davor, 10 danach, maximal acht zusammengeführte Fenster.

- [x] 2.1 Rote Tests für Vor-/Nachlauf, Clamping am Run-Anfang/-Ende,
      Vereinigung überlappender Fenster und Obergrenze acht schreiben.
- [x] 2.2 Gezielten Vitest-Aufruf ausführen und Rot bestätigen.
- [x] 2.3 Minimale Intervallauswahl und Merge-Logik implementieren.
- [x] 2.4 Tests grün ausführen.
- [x] 2.5 Refactor: Intervallberechnung und Sample-Projektion in kleine pure
      Funktionen trennen; Tests erneut ausführen.

## 3. Konservative Findings ableiten

**Bezug:** US-4, Design „Diagnose-Regeln“.

**Dateien:**

- Neu: `client/src/game/trace/analyzeBotRun.ts`
- Neu: `client/src/game/trace/analyzeBotRun.test.ts`

**Schnittstelle:**

- `analyzeBotRun(samples: readonly TraceTickSample[], events: readonly TraceEvent[], tuning: TraceTuning): TraceFinding[]`
- Findings: `stuck`, `oscillating`, `missed-gap`, `jump-cut-short`,
  `hazard-not-avoided`.

- [x] 3.1 Für `stuck` und `oscillating` jeweils einen positiven und einen
      negativen synthetischen Run als roten Test schreiben.
- [x] 3.2 Tests ausführen und Rot bestätigen.
- [x] 3.3 Beide Detektoren mit benannten Schwellenwert-Konstanten minimal
      implementieren; Findings referenzieren ihre Beleg-Ticks.
- [x] 3.4 Tests grün ausführen.
- [x] 3.5 Für `missed-gap`, `jump-cut-short` und `hazard-not-avoided` jeweils
      positive und negative Tests schreiben; insbesondere kein Finding ohne
      sichtbare Lücke beziehungsweise sichtbaren Hazard.
- [x] 3.6 Tests ausführen und Rot bestätigen.
- [x] 3.7 Die drei ereignisbezogenen Detektoren minimal implementieren und klar
      als `derived` kennzeichnen.
- [x] 3.8 Tests grün ausführen und anschließend alle Trace-Analyse-Tests
      gemeinsam ausführen.

## 4. Einen Run aufnehmen und genau einmal abschließen

**Bezug:** US-1, US-3, US-5, Design „BotRunRecorder“.

**Dateien:**

- Neu: `client/src/game/trace/BotRunRecorder.ts`
- Neu: `client/src/game/trace/BotRunRecorder.test.ts`

**Schnittstelle:**

```ts
class BotRunRecorder {
  recordState(state: BotState): void;
  recordDecision(result: BotDecisionTrace): void;
  recordEvent(event: TraceEventInput): void;
  finish(result: RunResult, reason: string, final: RacerSummaryInput): BotRunTrace | null;
}
```

- [x] 4.1 Rote Tests für State-/Action-Korrelation anhand der Tick-ID,
      beobachtete Events und Run-Deltas für Früchte/Fruchtpunkte schreiben.
- [x] 4.2 Gezielten Test ausführen und Rot bestätigen.
- [x] 4.3 Recorder-Grundgerüst und minimale Korrelation implementieren.
- [x] 4.4 Tests grün ausführen.
- [x] 4.5 Rote Tests schreiben: Todesposition bleibt vor Respawn erhalten,
      `finish()` liefert beim ersten Aufruf genau ein Artefakt, weitere Aufrufe
      liefern `null`, leerer Abbruch liefert `null`.
- [x] 4.6 Tests ausführen und Rot bestätigen.
- [x] 4.7 Abschlusslogik implementieren: Summary, `analyzeBotRun()`, Anker und
      `selectTraceWindows()` zusammensetzen.
- [x] 4.8 Tests grün ausführen; mit `JSON.stringify()` die vollständige
      Serialisierbarkeit des Artefakts testen.

## 5. `BotRunner` beobachtbar machen

**Bezug:** US-2, US-3, US-7, Design „Technische Bot-Diagnose“.

**Dateien:**

- Ändern: `client/src/sandbox/BotRunner.ts`
- Ändern: `client/src/sandbox/BotRunner.test.ts`

**Schnittstelle:**

```ts
interface BotRunnerObserver {
  onDecision(result: BotDecisionTrace): void;
  onPaused(reason: BotRunnerPauseReasonKind, message: string | null): void;
}
```

- [x] 5.1 Rote Tests schreiben, dass ein optionaler Observer genau ein
      `ok`-Ergebnis mit den bereits normalisierten Actions erhält, ohne den
      Rückgabewert von `tick()` zu verändern.
- [x] 5.2 Test ausführen und Rot bestätigen.
- [x] 5.3 Observer-Option und Erfolgsemission minimal implementieren.
- [x] 5.4 Test und bestehende `BotRunner`-Tests grün ausführen.
- [x] 5.5 Rote Tests für `runtime-error`, Timeout und einmalige Pausenmeldung
      schreiben; Guard-/Modulfehler vor dem ersten Tick einschließen.
- [x] 5.6 Tests ausführen und Rot bestätigen.
- [x] 5.7 Emissionen in den bestehenden Fehler-/Timeout-/Pausepfad integrieren,
      ohne Timer, Normalisierung oder Failure-Zähler zu verändern.
- [x] 5.8 Alle `BotRunner`-Tests grün ausführen und per Test sicherstellen, dass
      ohne Observer keine zusätzlichen sichtbaren Effekte entstehen.

## 6. `RaceScene`: Fakten erfassen und nach Tod neu beginnen

**Bezug:** US-1 bis US-3, US-7, Design „Fakten aus RaceScene“.

**Dateien:**

- Neu: `client/src/game/trace/runLifecycle.ts`
- Neu: `client/src/game/trace/runLifecycle.test.ts`
- Ändern: `client/src/game/scenes/RaceScene.ts`

**Schnittstellen:**

- `RaceSceneInitData.telemetry?: { onTrace: (trace: BotRunTrace) => void }`
- Pure Lifecycle-Hilfe kapselt `startRun()`, `finishRun()` und das Erzeugen des
  nächsten Recorders nach `death`, damit die Semantik ohne Phaser testbar ist.

- [x] 6.1 Rote Lifecycle-Tests schreiben: Start erzeugt Recorder, Tod emittiert
      genau einen Trace und startet einen neuen Recorder, Ziel/Abbruch emittiert
      und startet keinen neuen, fehlende Telemetrie ist No-op.
- [x] 6.2 Tests ausführen und Rot bestätigen.
- [x] 6.3 Pure Lifecycle-Hilfe minimal implementieren.
- [x] 6.4 Tests grün ausführen.
- [x] 6.5 `RaceScene` ausschließlich bei vorhandenem `telemetry` mit Lifecycle
      und `BotRunnerObserver` verdrahten; ohne Flag keine Recorder-Instanz und
      kein Observer.
- [x] 6.6 Fakten an den bestehenden Regelstellen erfassen:
      `pit-fall`, `hazard-hit`, `hazard-stomped`, `coin-collected`, `block-hit`,
      `checkpoint-reached`, `goal-reached`, Zeitlimit und Runner-Pause.
- [x] 6.7 Tod jeweils vor dem Respawn abschließen und danach einen neuen Run
      starten; Ziel, Zeitlimit, Shutdown und Bot-Pause endgültig abschließen.
- [x] 6.8 Trace-/RaceScene-nahe Tests sowie Typecheck ausführen; bestehende
      RaceScene-Tests müssen unverändert grün bleiben.

## 7. Browser-Übertragung und `/dev`-Aktivierung

**Bezug:** US-2, US-5, US-7.

**Dateien:**

- Neu: `client/src/game/trace/writeBotTrace.ts`
- Neu: `client/src/game/trace/writeBotTrace.test.ts`
- Ändern: `client/src/game/ArenaView.tsx`
- Ändern: `client/src/pages/DevPage.tsx`
- Ändern: `client/src/pages/DevPage.test.tsx`

**Schnittstellen:**

- `writeBotTrace(trace: BotRunTrace): Promise<void>` sendet genau einen POST an
  `/__bot-traces/runs`.
- `ArenaViewProps.telemetry?: { onTrace: (trace: BotRunTrace) => void }`.

- [x] 7.1 Roten Test für Methode, Endpoint, JSON-Body und `keepalive` von
      `writeBotTrace()` schreiben.
- [x] 7.2 Test ausführen und Rot bestätigen.
- [x] 7.3 Minimalen Writer implementieren und Test grün ausführen.
- [x] 7.4 Abdeckung auf testbare Grenzen verteilt: `runLifecycle.test.ts` prüft
      den vollständigen No-op ohne Telemetrie; `writeBotTrace.test.ts` prüft
      Erfolg/Fehler. Ein React-Test würde hier nur ein gemocktes `ArenaView`-Prop
      statt reales Verhalten prüfen und entfällt gemäß `writing-good-tests.md`.
      sendet erhaltene Traces; Tastaturmodus übergibt kein Telemetrie-Prop;
      Erfolg und Fehler werden knapp angezeigt.
- [x] 7.5 Lifecycle-/Writer-Tests ausgeführt und grün bestätigt.
- [x] 7.6 Telemetrie-Prop durch `ArenaView` an `RaceScene` reichen und in
      `DevPage` ausschließlich im Bot-Modus aktivieren.
- [x] 7.7 Tests grün ausführen; Typecheck ausführen und prüfen, dass Match-/
      Present-Aufrufer kein Telemetrie-Prop erhalten.

## 8. Vite-Endpunkt: ein POST, eine Timestamp-Datei

**Bezug:** US-5, Design „Vite-Persistenz“.

**Dateien:**

- Neu: `client/vite/botTracePlugin.ts`
- Neu: `client/vite/botTracePlugin.test.ts`
- Ändern: `client/vite.config.ts`
- Ändern: `.gitignore`

**Schnittstelle:**

- `botTracePlugin(options?): Plugin` registriert
  `POST /__bot-traces/runs`.
- Dateiformat: `YYYY-MM-DDTHH-mm-ss-SSSZ.json`; bei Kollision `-2`, `-3`, ….

- [x] 8.1 Node-environment-Test schreiben: gültiger POST erzeugt genau eine
      neue Datei mit erwartetem Timestamp-Namen und unverändertem JSON-Inhalt.
- [x] 8.2 Test ausführen und Rot bestätigen.
- [x] 8.3 Plugin-Middleware mit festem Zielordner und Grundstrukturprüfung
      minimal implementieren; Erfolgsstatus 201.
- [x] 8.4 Test grün ausführen.
- [x] 8.5 Rote Tests ergänzen: zweiter POST mit anderem Startzeitpunkt erzeugt
      zweite Datei; Timestamp-Kollision nutzt Suffix; ungültiges JSON ergibt
      400; Schreibfehler ergibt 500.
- [x] 8.6 Tests ausführen, Implementierung ergänzen und alle Plugin-Tests grün
      ausführen.
- [x] 8.7 Plugin in `vite.config.ts` registrieren, `src/bot/runs/` vom Watcher
      ausschließen und in `.gitignore` aufnehmen.
- [x] 8.8 Client-Build/Typecheck ausführen; manueller Vite-End-to-End-Test folgt in 11.4.

## 9. `reset-bot`: Bot und Trace-Dateien zurücksetzen

**Bezug:** US-6, Design „Reset“.

**Dateien:**

- Neu: `scripts/reset-bot.test.ts`
- Ändern: `scripts/reset-bot.mjs`

- [x] 9.1 Roten Test mit temporärem Workspace schreiben: Standardvorlage wird
      kopiert; mehrere `.json`-/`.tmp`-Trace-Dateien werden entfernt; Dateien
      außerhalb des festen `src/bot/runs`-Verzeichnisses bleiben unverändert.
- [x] 9.2 Test ausführen und Rot bestätigen.
- [x] 9.3 Reset-Logik so extrahieren beziehungsweise parametrisierbar machen,
      dass sie testbar bleibt; ausschließlich Inhalte des festen
      `client/src/bot/runs/` entfernen und Ordner anschließend sicherstellen.
- [x] 9.4 Test grün ausführen.
- [x] 9.5 `npm run reset-bot` manuell ausführen und Bot-Inhalt sowie leeren
      Trace-Ordner verifizieren.

## 10. Bot-Steering für Trace-Feedback

**Bezug:** US-6, Design „Steering“.

**Dateien:**

- Ändern: `client/src/bot/AGENTS.md`
- Ändern: `client/src/bot/current-bot.template.test.ts` oder neuer statischer
  Steering-Test
- Ändern: `docs/04-devkcode-profil.md`
- Ändern: `docs/09-bot-artefakt-und-turnier.md`

- [x] 10.1 Entfällt: Nach `writing-good-tests.md` wird menschliche Prompt-Prosa nicht per Text-Grep getestet.
      Leseposition `./runs/*.json`, den Befehl zum Ermitteln der letzten
      fünf Dateien, Fakten-vs.-Findings und das Zustimmungsgate verlangt.
- [x] 10.2 Entfällt zusammen mit 10.1; Verifikation erfolgt über Template-Guard und manuellen Agenten-Dialog in 11.
- [x] 10.3 `client/src/bot/AGENTS.md` anpassen: weiterhin nur
      `current-bot.js` bearbeiten, Trace-Dateien nur lesen, Schema erklären,
      letzte Runs ermitteln, höchstens zwei Beobachtungen, genau eine Änderung
      vorschlagen und erst nach Zustimmung umsetzen.
- [x] 10.4 Die absichtlich schwache Startstrategie „immer rechts“ aus dem
      Ablauf entfernen und direkt eine vollständige einfache Grundnavigation
      verlangen; Navigations-Utilities selbst unverändert lassen.
- [x] 10.5 Template-Guard-Test im vollständigen Client-Testlauf grün bestätigt.
- [x] 10.6 Profil- und Testmodus-Dokumentation mit dem tatsächlichen
      Ein-Run-pro-Datei-Ablauf und `reset-bot`-Bereinigung aktualisieren.

## 11. End-to-End-Verifikation und Requirements-Abgleich

**Bezug:** US-1 bis US-7.

- [x] 11.1 Alle Trace-, BotRunner-, DevPage- und Vite-Plugin-Tests gemeinsam
      ausführen und grün bestätigen.
- [x] 11.2 Client-Typecheck und Root-Build ausführen.
- [x] 11.3 Vollständige Root-Test-Suite ausführen und alle Tests grün bestätigen.
- [x] 11.4 Manuell in `/dev` geprüft: Mehrere Tode erzeugen unterschiedliche
      Timestamp-Dateien; Ziel oder „Neu“ erzeugt eine weitere Datei; jede Datei
      enthält genau einen Versuch. Weitere Abschlussgründe sind durch Lifecycle-
      und Recorder-Tests abgedeckt.
- [x] 11.5 Geprüft: Tastaturmodus und `/present` erhalten keine Telemetrie;
      der Lifecycle-No-op-Test bestätigt fehlende Recorder-/Request-Effekte.
      Der Vite-Watcher ignoriert den Trace-Ordner, sodass Schreiben kein HMR
      auslöst.
- [x] 11.6 `npm run reset-bot` ausführen: Bot entspricht der Vorlage und
      `src/bot/runs/` ist leer.
- [x] 11.7 Alle Akzeptanzkriterien aus `requirements.md` einzeln gegen Test,
      Code oder manuelle Evidenz abhaken und verbleibende Lücken vor Abschluss
      schließen.
