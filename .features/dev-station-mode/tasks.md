# Tasks: Dev-Station-Modus

Bezug: `requirements.md` (US-1 bis US-5), `design.md`. Arbeitsweise: strikt
Rot-Grün-Refactor (siehe `AGENTS.md`) – jeder Task mit fachlicher Logik
beginnt mit einem fehlschlagenden Test. Reine Konfigurations-/Lösch-/Doku-
Tasks ohne testbare Logik sind entsprechend gekennzeichnet.

## 0. Vorbereitung: Bot-Artefakt-Dateien & Reset-Skript

- [x] 0.1 `client/src/bot/current-bot.template.js` anlegen (Bezug: US-2, US-3,
      Design "current-bot.template.js")
      Dokumentiertes Standard-Modul exakt wie in `design.md` beschrieben
      (Kommentar-Kurzreferenz der Bot-API + `decide` gibt `"idle"` zurück).
      Kein Test nötig (statische Datei).
- [x] 0.2 `.gitignore`: Eintrag `client/src/bot/current-bot.js` ergänzen
      (Bezug: US-3). Kein Test nötig.
- [x] 0.3 `scripts/reset-bot.mjs` implementieren (Bezug: US-3, Design
      "scripts/reset-bot.mjs")
      Kein Unit-Test (triviales `copyFileSync`-Skript, siehe Design
      "Test-Strategie"). Manuelle Verifikation direkt im Anschluss (Task 0.4).
- [x] 0.4 Manuelle Verifikation: `node scripts/reset-bot.mjs` im Repo-Root
      ausführen (Bezug: US-3)
      **Ergebnis:** Datei existierte nicht → wurde neu angelegt mit exaktem
      Template-Inhalt. Danach Inhalt manuell verändert, Skript erneut
      ausgeführt → Datei wieder exakt identisch zum Template (per `diff`
      verifiziert). Beide Fälle (Neuanlage + Überschreiben) bestätigt.
- [x] 0.5 root `package.json`: Scripts `dev`, `present`, `reset-bot`
      umbauen/ergänzt (Bezug: US-1, US-3, Design Abschnitt 1)
      `"dev": "npm run dev -w @arena/client"`,
      `"present": "npm run dev -w @arena/server"`,
      `"reset-bot": "node scripts/reset-bot.mjs"`. Verifikation in Task 9.1.

## 1. Existenz-Guard in `client/vite.config.ts`

- [x] 1.1 `client/vite.config.ts` um Existenz-Guard ergänzt (Bezug: US-2,
      Design "Existenz-Guard statt Browser-seitiger Fehlerbehandlung")
      `existsSync`-Check auf `client/src/bot/current-bot.js` vor
      `defineConfig(...)`; bei Fehlen `console.error(...)` mit Hinweis auf
      `npm run reset-bot` + `process.exit(1)`.
- [x] 1.2 Manuelle Verifikation Existenz-Guard (Bezug: US-2)
      **Ergebnis:** `current-bot.js` entfernt, `npm run dev` ausgeführt →
      Meldung "❌ client/src/bot/current-bot.js fehlt. Bitte im Repo-Root
      einmalig ausführen: npm run reset-bot" erscheint, Prozess beendet sich
      mit Exit-Code 1, **kein** Vite-Server startet (kein "VITE ... ready"
      in der Ausgabe). Datei wiederhergestellt, `npm run dev` erneut
      ausgeführt → Server startet normal (`curl` auf `http://localhost:5173/`
      liefert HTTP 200).

## 2. `client/src/bot/currentBotSource.ts`

- [x] 2.1 `client/src/bot/currentBotSource.ts` implementiert (Bezug: US-2,
      Design "currentBotSource.ts")
      `?raw`-Import von `./current-bot.js`, `import.meta.hot.accept(() =>
      window.location.reload())`, Re-Export als `currentBotSource`. Kein
      Unit-Test (Vite-Laufzeit-spezifisch). Manuell verifiziert: Vite-
      Dev-Server transformiert `currentBotSource.ts` korrekt zu
      `import currentBotSource from "/src/bot/current-bot.js?raw"` +
      `import.meta.hot.accept(...)`-Boilerplate (per `curl` auf den
      transformierten Modul-Endpunkt geprüft); `.../current-bot.js?raw`
      liefert den Dateiinhalt korrekt als String-Export. Echtes
      Browser-Reload-Verhalten beim Speichern: siehe Hinweis zu Task 9.2.

## 3. Sandbox-Protokoll-Erweiterung: `module-invalid`

- [x] 3.1 `client/src/sandbox/workerLike.ts`: `WorkerToHostMessage` um
      `{ type: "module-invalid"; reason: string }` erweitert.
- [x] 3.2 Test: `BotRunner` behandelt `module-invalid`-Nachricht – geschrieben
      (rot bestätigt), dann grün nach 3.4.
- [x] 3.3 Test: `module-invalid` unabhängig von `pendingTick` – geschrieben
      (rot bestätigt), dann grün nach 3.4.
- [x] 3.4 `pausedReasonKind`-Typ + `pause(kind, reason)` + `module-invalid`-
      Handling implementiert. Alle bestehenden Aufrufstellen angepasst
      (`"guard-rejected"`, `"too-many-failures"`, `"disposed"`). Tests 3.2–3.3
      sowie alle bestehenden `BotRunner`-Tests (inkl. ergänzter
      `pausedReasonKind`-Prüfungen in den Guard-/Kill-/Dispose-Tests) grün.
- [x] 3.5 `client/src/sandbox/botWorker.ts`: sendet `module-invalid` bei
      ungültigem Modul (statt nur `decide = null` zu setzen).
- [x] 3.6 `client/src/sandbox/botWorker.ts`: Try/Catch um `import(blobUrl)`
      selbst ergänzt, sendet bei Fehlschlag ebenfalls `module-invalid`.

## 4. `BotRunner`: Laufzeitfehler sichtbar machen

- [x] 4.1 Test: `lastRuntimeError` bei `error`-Nachricht – geschrieben (rot
      bestätigt), dann grün nach 4.4.
- [x] 4.2 Test: `lastRuntimeError`-Reset nach Erfolg – geschrieben (rot
      bestätigt), dann grün nach 4.4.
- [x] 4.3 Test: `consecutiveFailureCount`-Getter – geschrieben (rot
      bestätigt), dann grün nach 4.4.
- [x] 4.4 `lastRuntimeError`, `consecutiveFailureCount` + `registerSuccess()`
      implementiert. Alle 8 neuen Tests (3.2/3.3/4.1/4.2/4.3 + ergänzte
      Prüfungen) sowie alle 8 bestehenden `BotRunner`-Tests grün (16/16
      insgesamt in `BotRunner.test.ts`).
- [x] 4.5 `FakeWorker` erweitern – **entfällt ersatzlos**: `FakeWorker.emit()`
      ist bereits generisch für jede `WorkerToHostMessage` (inkl.
      `module-invalid`) nutzbar, keine Anpassung nötig.

## 5. `useArenaControls` vereinfachen

- [x] 5.1 Test: nur noch `mode`/`setMode` – Test angepasst (alter
      `selectedBot`/`selectBot`-Test entfernt, neuer Test "does not expose
      bot selection anymore" ergänzt, rot bestätigt vor 5.2).
- [x] 5.2 `useArenaControls.ts` auf `mode`/`setMode` reduziert. Alle 3 Tests
      grün.

## 6. `DevPage.tsx` umbauen

- [x] 6.1 `client/src/game/control/exampleBots.ts` gelöscht.
- [x] 6.2 `DevPage.tsx`: WS-Abhängigkeiten entfernt (`useWebSocketConnection`,
      `ConnectionStatusBadge`, `BroadcastFeed` nicht mehr importiert/gerendert
      – per Grep auf `DevPage.tsx`-Imports verifiziert). `AudioControls`
      bleibt.
- [x] 6.3 `DevPage.tsx`: Bot-Auswahl durch festen `currentBotSource`-Import
      ersetzt, kein Dropdown, keine `fetch`-Ladelogik mehr.
- [x] 6.4 `DevPage.tsx`: Diagnose-Anzeige (`renderBotDiagnosis`) ergänzt,
      schaltet typsicher über `pausedReasonKind`.
- [x] 6.5 `ArenaView`/`RaceScene`-`onStatusChange`-Payload um
      `pausedReasonKind`, `lastRuntimeError`, `consecutiveFailureCount`
      ergänzt. Zusätzlich (über den ursprünglichen Task-Zuschnitt hinaus,
      beim Abgleich in 9.4 identifiziert): `RaceScene.create()` ruft
      `notifyStatus()` jetzt direkt nach `createController()` auf, damit eine
      Guard-Ablehnung sofort sichtbar ist (US-4 "bevor ein Testlauf
      gestartet wird"), statt erst mit dem ersten Bot-Tick (~150ms später).
      `npx tsc --noEmit` (client) fehlerfrei, alle Client-Tests weiterhin
      grün nach dieser Änderung.

## 7. Beispiel-Bots entfernen

- [x] 7.1 `client/public/example-bots/` gelöscht.
- [x] 7.2 `examples/bots/` (inkl. `README.md`) gelöscht; danach leerer
      `examples/`-Ordner ebenfalls entfernt.
- [x] 7.3 Grep-Kontrolle: **Ergebnis:** keine Referenzen mehr in
      Produktivcode. Verbleibende Treffer ausschließlich in
      `docs/09-bot-artefakt-und-turnier.md` (durch Task 8.5 aktualisiert) und
      in historischen, bereits abgeschlossenen Feature-Specs
      (`.features/bot-decide-api/`, `.features/level-one-arena/`) – bleiben
      laut `AGENTS.md` als Änderungshistorie unangetastet.

## 8. Begleitende Doku-Updates

- [x] 8.1 `docs/01-konzept.md`: Hinweis auf Ablösung durch Turniermodus
      ergänzt.
- [x] 8.2 `docs/05-scoring-und-heats.md`: gleiche Markierung ergänzt
      (Scoring-Formel/Leben/Zeitlimit bleiben inhaltlich gültig, nur das
      Heat-System selbst als überholt markiert).
- [x] 8.3 `docs/03-architektur.md`: neuer Abschnitt "Startbefehle: /dev vs.
      Präsentationsrechner" ergänzt, `/dev`-Klarstellung aktualisiert.
- [x] 8.4 `docs/07-offene-punkte.md`: 4 Punkte aktualisiert/ergänzt
      (Stand-Setup, Validierung vor Export, 16er-Heat vs. Turnier,
      Bot-Artefakt-Datei-Ansatz).
- [x] 8.5 `docs/09-bot-artefakt-und-turnier.md`: Abschnitt "Import" komplett
      überarbeitet (kein Datei-Picker mehr, feste Datei + Reload-on-Change),
      "Testmodus"-Abschnitt aktualisiert, Verweis auf `examples/bots/`
      ersetzt durch Verweis auf `current-bot.template.js`.

## 9. Abschluss & End-to-End-Verifikation

- [x] 9.1 Root-Skripte verifiziert (Bezug: US-1)
      **Ergebnis:** `npm run dev` → Log zeigt ausschließlich
      `@arena/client`/`vite`, keine "Arena hub server listening"-Meldung;
      `curl http://localhost:5173/` → HTTP 200, kein Server-Prozess.
      `npm run present` → Log zeigt `@arena/server`/`tsx watch` +
      "Arena hub server listening on http://localhost:3000"; `curl` auf
      `/admin` und `/present` → je HTTP 200. Zusätzlich `npm run build`
      (kompletter Root-Build inkl. Existenz-Guard) erfolgreich durchlaufen.
- [x] 9.2 End-to-End-Durchlauf – **teilweise automatisiert verifiziert**
      (Bezug: US-2, US-4, US-5). In dieser Umgebung steht kein
      Browser-Automatisierungswerkzeug zur Verfügung; daher wurde
      stellvertretend verifiziert:
      - reset-bot → Datei korrekt erzeugt (Task 0.4).
      - Fehlende Datei → Guard greift, klare Meldung (Task 1.2).
      - `?raw`-Import + `import.meta.hot.accept`-Wiring vom Vite-Dev-Server
        korrekt transformiert/ausgeliefert (Task 2.1).
      - Guard-Ablehnung, ungültiges Modul, Laufzeitfehler,
        Kill-Schwelle: vollständig durch `BotRunner`-Unit-Tests abgedeckt
        (Abschnitt 3+4, 16/16 grün).
      - **Offen für dich (manueller Schritt im echten Browser):** den
        tatsächlichen automatischen Seiten-Reload beim Speichern von
        `current-bot.js` sowie die visuelle Diagnose-Anzeige in `/dev` einmal
        selbst gegenzuprüfen (`npm run reset-bot`, `npm run dev`, `/dev`
        öffnen, Bot-Modus wählen, `current-bot.js` bearbeiten/speichern).
- [x] 9.3 Vollständigen Testlauf verifiziert
      **Ergebnis:** `npm test` (Root) → 29 Testdateien, 170 Tests, alle grün.
      Zusätzlich verifiziert: `npm test` bleibt grün, auch wenn
      `current-bot.js` (temporär entfernt) nicht existiert – bestätigt die
      Design-Annahme, dass `vitest.config.ts` den `vite.config.ts`-Guard
      nicht mitlädt.
- [x] 9.4 Abgleich gegen Akzeptanzkriterien
      Alle Akzeptanzkriterien aus US-1 bis US-5 wurden geprüft (Tests,
      manuelle Verifikation oder Code-Review) – siehe Zusammenfassung im
      Chat. Eine Lücke wurde dabei gefunden und behoben: die
      Diagnose-Anzeige war ohne den in 6.5 ergänzten `notifyStatus()`-Aufruf
      bei einer Guard-Ablehnung erst nach ~150ms statt sofort sichtbar.

## 10. Bugfix (nach realem Testlauf): Default-Bot durch eigenen Guard blockiert

- [x] 10.1 Test (rot): `current-bot.template.test.ts` – prüft
      `checkStaticGuard(templateSource).allowed === true`. Bestätigt rot: das
      Wort "import" im Dokumentationskommentar von
      `current-bot.template.js` ließ den statischen Guard (der naiv per
      Regex über den gesamten Quelltext inkl. Kommentare prüft) das eigene
      Standard-Template ablehnen (`🔴 Bot blockiert: statischer Guard
      abgelehnt: import`).
- [x] 10.2 Fix (grün): `current-bot.template.js`-Kommentar umformuliert ohne
      die wörtlichen verbotenen Schlüsselwörter. Test 10.1 grün.
      `current-bot.js` (Arbeitsdatei) per `npm run reset-bot` neu erzeugt.
      Gleicher Snippet in `design.md` synchronisiert; Bugfix-Notiz in
      `design.md` ergänzt.
