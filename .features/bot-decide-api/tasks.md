# Tasks: Bot-Decide-API (Contract + Sandbox)

Bezug: `requirements.md` (US-1 bis US-6), `design.md`. Arbeitsweise: strikt
Rot-Grün-Refactor (siehe `AGENTS.md`) – jeder Task mit fachlicher Logik beginnt
mit einem fehlschlagenden Test.

## 0. Package-Grundgerüst

- [x] 0.1 Workspace-Eintrag + Grundstruktur `packages/bot-contract` (Bezug:
      Design "Repo-/Modulstruktur")
      `package.json` (Name `@arena/bot-contract`, analog zu `packages/shared`),
      `tsconfig.json`, `vitest.config.ts` (`node`-Environment), leeres
      `src/index.ts`. Root-`package.json` Workspace-Liste um `packages/*`
      (bereits vorhanden, prüfen ob `bot-contract` erfasst ist) ergänzen.
      Trivialer Beweistest (rot → grün), dass `npm test -w @arena/bot-contract`
      läuft, bevor fachlicher Code beginnt.
- [x] 0.2 `client/src/sandbox/`-Ordner + Dependency (Bezug: Design
      "Repo-/Modulstruktur")
      `client/package.json`: Dependency `@arena/bot-contract` (Workspace-Link)
      ergänzen. Leeren Ordner `client/src/sandbox/` anlegen (kein Code, nur
      Vorbereitung für Abschnitt 3).

## 1. Bot-Contract: Typen

- [x] 1.1 Test: `BotState`/`Action`/`ACTIONS`/`TileType`-Typen kompilieren mit
      erwarteten Feldern (Bezug: US-1, Design "state.ts")
      Test (z.B. Objektliteral gegen `BotState` prüfen, `ACTIONS`-Array-Inhalt
      prüfen: exakt `["left","right","jump","idle"]`) schreiben (rot, Typen
      fehlen noch).
- [x] 1.2 `packages/bot-contract/src/state.ts` implementieren (grün)
      `TileType`, `Action`, `ACTIONS`, `NearestCoin`, `NearestHazard`,
      `NearestUtility`, `BotState` gemäß Design anlegen, Test aus 1.1 grün.
- [x] 1.3 `packages/bot-contract/src/hazards.ts` implementieren (Bezug: US-1,
      Design "hazards.ts")
      `HazardKind`, `UtilityKind` als reine Typ-Deklaration (kein Test nötig,
      siehe Design "Test-Strategie": reine Typ-Deklaration ohne Laufzeitlogik).

## 2. Bot-Contract: Modul-Validierung & Static Guard

- [x] 2.1 Test: `validateBotModule` – gültiges Modul (Bezug: US-2, Design
      "botModule.ts")
      Test: Objekt mit `apiVersion: 1`, Funktion `decide` → `{valid: true,
      module}` (rot).
- [x] 2.2 Test: `validateBotModule` – fehlende/falsche `apiVersion` (Bezug: US-2)
      Test: `apiVersion` fehlt, ist String, ist `2` → jeweils `{valid: false,
      reason}` mit sprechendem Grund (rot).
- [x] 2.3 Test: `validateBotModule` – fehlendes/falsches `decide` (Bezug: US-2)
      Test: `decide` fehlt, ist kein Funktionswert → `{valid: false, reason}`
      (rot).
- [x] 2.4 Test: `validateBotModule` – optionale Felder fehlen (Bezug: US-2)
      Test: gültiges Modul ohne `name`/`author`/`color` → weiterhin `{valid:
      true}` (rot).
- [x] 2.5 Test: `validateBotModule` – Nicht-Objekt-Eingabe (Bezug: US-2,
      Fehlerbehandlung)
      Test: `null`, `undefined`, `"string"` als `candidate` → `{valid: false,
      reason: "kein Objekt"}`, kein Crash (rot).
- [x] 2.6 `packages/bot-contract/src/botModule.ts` implementieren (grün)
      `SUPPORTED_API_VERSION`, `BotModule`, `BotModuleValidation`,
      `validateBotModule` als Check-Kette (`isPlainObject`,
      `hasSupportedApiVersion`, `hasDecideFunction`) gemäß Design. Tests aus
      2.1–2.5 grün bekommen.
- [x] 2.7 Test: `checkStaticGuard` – je ein verbotenes Muster (Bezug: US-3,
      Design "staticGuard.ts")
      Je ein Testfall für `import `, `require(`, `fetch(`, `window.`,
      `document.`, `eval(`, `XMLHttpRequest` → `{allowed: false,
      matchedPattern}` (rot).
- [x] 2.8 Test: `checkStaticGuard` – zulässiger Beispiel-Code (Bezug: US-3)
      Test: ein Beispiel-Bot im Format aus `docs/09-bot-artefakt-und-turnier.md`
      (nur `decide`, einfache Arithmetik/Bedingungen) → `{allowed: true}` (rot).
- [x] 2.9 `packages/bot-contract/src/staticGuard.ts` implementieren (grün)
      Muster-Liste + `checkStaticGuard` gemäß Design. Tests aus 2.7–2.8 grün.
- [x] 2.10 `packages/bot-contract/src/index.ts` – Public API (Bezug: Design
      "Repo-/Modulstruktur")
      Re-Export aller öffentlichen Typen/Funktionen aus `state.ts`,
      `hazards.ts`, `botModule.ts`, `staticGuard.ts`. Kein neuer Test nötig
      (reine Re-Export-Datei ohne eigene Logik).

## 3. Sandbox: `WorkerLike`-Abstraktion & Test-Double

- [x] 3.1 `client/src/sandbox/workerLike.ts` anlegen (Bezug: Design
      "workerLike.ts")
      `WorkerLike`-Interface, `HostToWorkerMessage`, `WorkerToHostMessage`
      gemäß Design. Reine Typ-Deklaration, kein Test nötig.
- [x] 3.2 Test-Fake `FakeWorker` für Tests bauen (Bezug: Design "Test-Strategie
      BotRunner")
      Kein Produktivcode – ein Test-Helper (`client/src/sandbox/testUtils/
      FakeWorker.ts` o.ä.), der `WorkerLike` implementiert und von Testcode aus
      gesteuert werden kann (verzögert/nie/mit Fehler antworten, `terminate()`-
      Aufrufe zählen). Wird selbst nicht "getestet" (ist Test-Infrastruktur),
      aber Grundlage für alle folgenden `BotRunner`-Tests.

## 4. Sandbox: `BotRunner` (Kernlogik)

- [x] 4.1 Test: `init()` mit von `checkStaticGuard` abgelehntem Code (Bezug:
      US-3, US-4, Design "Fehlerbehandlung")
      Test: Code mit `"fetch("` → `status === "paused"`, `pausedReason`
      gesetzt, `FakeWorker.postMessage` wurde nicht aufgerufen (rot).
- [x] 4.2 Test: `init()` mit zulässigem Code (Bezug: US-4)
      Test: zulässiger Code → genau ein `postMessage({type:"init", code})` an
      den `FakeWorker`, `status === "running"` (rot).
- [x] 4.3 `BotRunner.init()` implementieren (grün)
      Guard-Prüfung + bedingtes `postMessage` gemäß Design. Tests 4.1–4.2 grün.
- [x] 4.4 Test: `tick()` – gültige, rechtzeitige Antwort (Bezug: US-4, US-5)
      `FakeWorker` antwortet synchron/schnell mit gültiger Action → `tick()`
      resolved mit dieser Action, interner Fehlerzähler bleibt 0 (rot; Zähler-
      Verhalten indirekt über nachfolgenden Test 4.9 verifizierbar).
- [x] 4.5 Test: `tick()` – Timeout (Bezug: US-4)
      `FakeWorker` antwortet nie; mit Vitest Fake Timers `timeoutMs`
      vorspulen → `tick()` resolved mit `"idle"` (rot).
- [x] 4.6 Test: `tick()` – Worker liefert `error` (Bezug: US-4)
      `FakeWorker` sendet `{type:"error", tick, message}` → `tick()` resolved
      mit `"idle"` (rot).
- [x] 4.7 Test: `tick()` – ungültige Action außerhalb `ACTIONS` (Bezug: US-4)
      `FakeWorker` sendet `{type:"action", tick, action:"fly"}` → `tick()`
      resolved mit `"idle"` (rot).
- [x] 4.8 `BotRunner.tick()` implementieren (Kernpfad, grün)
      Tick-Zähler, `postMessage`, Timeout-Race, Action-Validierung gemäß
      Design-Schritte 1–7. Tests 4.4–4.7 grün bekommen.
- [x] 4.9 Test: Zähler-Reset nach Erfolg zwischen Fehlversuchen (Bezug: US-4)
      Sequenz: mehrere Fehlversuche, dann ein Erfolg, dann wieder
      Fehlversuche unterhalb der Schwelle → kein `terminate()`-Aufruf (rot).
- [x] 4.10 Test: harter Kill nach `maxConsecutiveFailures` (Bezug: US-4)
      `maxConsecutiveFailures` aufeinanderfolgende Timeouts → genau ein
      `worker.terminate()`-Aufruf, `status === "paused"`,
      `pausedReason` gesetzt (rot).
- [x] 4.11 Zähler-/Kill-Logik implementieren (grün)
      Zähler-Reset bei Erfolg + Schwellenwert-Kill gemäß Design. Tests 4.9–4.10
      grün.
- [x] 4.12 Test: `tick()` im `"paused"`-Zustand (Bezug: US-4, US-5)
      Nach Kill (oder direkt nach abgelehntem Guard) → weiterer `tick()`-Aufruf
      liefert sofort `"idle"` **ohne** `postMessage`-Aufruf (rot).
- [x] 4.13 Test: verspätete Antwort zu bereits per Timeout abgeschlossenem Tick
      wird ignoriert (Bezug: US-4, Design "Fehlerbehandlung")
      Tick N läuft in Timeout (→ idle); danach trifft eine späte Antwort zu
      Tick N ein; ein nachfolgender Tick N+1 darf davon nicht beeinflusst
      werden (rot).
- [x] 4.14 Tick-Korrelation implementieren (grün)
      Nur Antworten mit passender, aktuell erwarteter `tick`-Nummer werden
      verarbeitet. Test 4.13 grün.
- [x] 4.15 Test: `dispose()` (Bezug: US-5, Design "Fehlerbehandlung")
      `dispose()` ruft `worker.terminate()` auf, `status` wird `"paused"` mit
      `pausedReason === "disposed"` (rot).
- [x] 4.16 `BotRunner.dispose()` implementieren (grün)
      Tests 4.15 grün. Anschließend Refactor-Pass über die gesamte
      `BotRunner`-Klasse (Duplikation zwischen Guard-Pause und Kill-Pause
      konsolidieren, sofern sinnvoll – Clean Code).

## 5. Sandbox: Echter Browser-Worker (nicht unit-testbar, siehe Design)

- [x] 5.1 `client/src/sandbox/botWorker.ts` implementieren (Bezug: Design
      "botWorker.ts")
      Modul-Worker-Einstiegspunkt gemäß Design (Blob-URL + `import()`,
      `validateBotModule`, `try/catch` um `decide`-Aufruf). Kein Unit-Test
      (siehe Design "Bewusst nicht unit-getestet").
- [x] 5.2 `client/src/sandbox/createBrowserWorker.ts` implementieren (Bezug:
      Design "createBrowserWorker.ts")
      Fabrikfunktion, die einen echten `Worker` (`new URL("./botWorker.ts",
      import.meta.url)`, `type: "module"`) erzeugt und als `WorkerLike`
      zurückgibt. Kein Unit-Test (dünner Adapter ohne Verzweigungslogik).
- [x] 5.3 Manueller Browser-Verifikationsschritt (Bezug: Design "Manueller
      Verifikationsschritt")
      Kleine, temporäre Testseite/Skript (nicht Teil des Produktivcodes, z.B.
      lokal im Dev-Server ausgeführt) lädt einen Beispiel-Bot aus
      `examples/bots/` über `createBrowserWorker` + `BotRunner`, führt mehrere
      `tick()`-Aufrufe durch, verifiziert plausible Actions. Danach: Testbot
      mit `while(true){}` in `decide` einschleusen, verifizieren, dass nach
      `maxConsecutiveFailures` Ticks `status` auf `"paused"` wechselt und der
      Tab dabei nicht einfriert. Ergebnis hier als Kommentar/Notiz
      festhalten (Nachweis, kein automatisierter Test).

## 6. Abschluss

- [x] 6.1 Vollständigen Testlauf verifizieren
      `npm test` (Root) läuft grün für `packages/bot-contract` und `client`
      (neue Sandbox-Tests inklusive).
- [x] 6.2 Abgleich gegen Akzeptanzkriterien
      Jede Akzeptanzkriterium aus `requirements.md` (US-1 bis US-6) einem Test
      oder einer expliziten Design-Entscheidung zuordnen; Lücken benennen und
      schließen, bevor das Feature als abgeschlossen gilt.
