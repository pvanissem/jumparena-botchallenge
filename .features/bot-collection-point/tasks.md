# Tasks: Bot-Sammelstelle (`bot-collection-point`)

Bezug: `requirements.md` (US-1 bis US-6), `design.md`.

Jeder fachliche Task beginnt mit einem fehlschlagenden Test (rot), gefolgt von
minimaler Implementierung (grün) und ggf. Refactoring – siehe `AGENTS.md`,
"Test-Driven Development (Pflicht)". Reine Wiring-/Präsentations-Tasks sind als
solche markiert und laut Design bewusst ohne Unit-Test (manuell verifiziert).

## A. Gemeinsame Contracts

- [x] **A1. Message-Contracts + Typguards** (US-1, US-3, US-4, US-6;
      Design "Schnittstellen & Datenmodelle")
      Rot: Tests in `packages/shared/src/messages.test.ts` für
      `isBotAddMessage`/`isBotRemoveMessage` (gültige Payload erkannt,
      fehlende/falsch typisierte Felder abgelehnt).
      Grün: `BotArtifact`, `BotAddMessage`, `BotRemoveMessage`,
      `BotAddedMessage`, `BotRemovedMessage`, `BotRegistrySnapshotMessage`,
      `MAX_BOT_SOURCE_BYTES` sowie die beiden Typguards ergänzen;
      `InboundMessage`/`OutboundMessage` erweitern.
      Bestehende Ping/Audio-Tests müssen unverändert grün bleiben.

## B. Server: Registry & Persistenz

- [x] **B1. `BotRegistry`** (US-1, US-4; Design "Server: botRegistry/")
      Rot: `BotRegistry.test.ts` – `add`/`list`, Konstruktor mit
      Initialbestand, `remove` bekannte ID → `true` und Eintrag weg,
      `remove` unbekannte ID → `false`.
      Grün: `server/src/botRegistry/BotRegistry.ts` (nur Map-Zustand, keine
      WS-/Dateisystem-Kenntnis).

- [x] **B2. `colorForId`** (US-2)
      Rot: `colorForId.test.ts` – gleiche ID liefert gleiche Farbe
      (deterministisch), Rückgabe ist ein gültiger CSS-Farbwert.
      Grün: `server/src/botRegistry/colorForId.ts`.

- [x] **B3. Persistenz-Port + JSON-Datei-Adapter** (US-5)
      Rot: `JsonFileBotRegistryStore.test.ts` gegen ein Temp-Verzeichnis –
      Roundtrip `save()`→`load()`; fehlende Datei → `[]`; kaputtes JSON → `[]`
      ohne Throw; Schreibfehler (nicht existierendes Verzeichnis) → kein Throw.
      Grün: `BotRegistryStore.ts` (Interface) +
      `JsonFileBotRegistryStore.ts` (synchron, vollständiges Neuschreiben,
      Warnungen statt Exceptions).

## C. Server: Handler

- [x] **C1. `createBotAddHandler`** (US-1, US-2, US-5; Design "Validierung")
      Rot: `createBotAddHandler.test.ts` gegen Fakes für Registry/Store/
      `broadcastAll` und injizierte `createId`/`now` –
      (a) gültige Nachricht → Eintrag mit erwarteter `id`/`uploadedAt`,
      `store.save` aufgerufen, `bot-added` gebroadcastet;
      (b) `color` aus der Nachricht gewinnt, sonst `colorForId`;
      (c) Quelltext mit verbotenem Muster → weder Registry-Eintrag noch
      Speichern noch Broadcast;
      (d) Quelltext über `MAX_BOT_SOURCE_BYTES` → ebenfalls keine Wirkung.
      Grün: Handler gemäß Design (nutzt `checkStaticGuard` aus
      `@arena/bot-contract`, führt **keinen** Bot-Code aus).

- [x] **C2. `createBotRemoveHandler`** (US-4, US-5)
      Rot: bekannte ID → entfernt + gespeichert + `bot-removed` gebroadcastet;
      unbekannte ID → keine dieser drei Wirkungen.
      Grün: Handler gemäß Design.

## D. Server: Transport-Anbindung

- [x] **D1. `parseInboundMessage` erweitern** (US-1, US-4)
      Rot: Tests für `bot-add`/`bot-remove` (gültig → typisiert zurück,
      ungültige Payload → `null`); bestehende Fälle bleiben grün.
      Grün: zwei Typguard-Zweige ergänzen.

- [x] **D2. Broadcast an alle inkl. Sender** (US-3; Design "Warum routeToAll")
      Rot: `BroadcastRouter.test.ts` – `routeToAll` erreicht **alle** Clients
      einschließlich des Senders; bestehender `route`-Test (Sender
      ausgeschlossen) bleibt unverändert grün.
      Grün: `ClientSource.getAll()`, `ClientRegistry.getAll()`,
      `BroadcastRouter.routeToAll()`.

- [x] **D3. Snapshot für neu verbundene Clients** (US-3)
      Wiring-Task (laut Design ohne Unit-Test): optionaler
      `onClientConnected?(client)`-Callback in `WebSocketGateway`, aufgerufen
      direkt nach `registry.add(client)`. Gateway bleibt inhaltsagnostisch.

- [x] **D4. Composition Root verdrahten** (US-1, US-3, US-4, US-5)
      Wiring-Task (ohne Unit-Test): `config.botRegistryFile` ergänzen; in
      `server/src/index.ts` Store laden → `BotRegistry` mit Initialbestand →
      beide Handler registrieren → `onClientConnected` mit
      `bot-registry-snapshot` verdrahten. `.gitignore` um das Registry-
      Datenverzeichnis ergänzen.

## E. Client: Sandbox-Validierung

- [x] **E1. Worker meldet Modul-Metadaten** (US-2; Design "Protokoll-Erweiterung")
      Grün (Protokoll/Worker-Runtime, laut Design ohne Unit-Test):
      `workerLike.ts` um `module-ready` erweitern **inklusive Aktualisierung
      der dortigen YAGNI-Notiz** (Begründung: US-2 fordert die Metadaten);
      `botWorker.ts` sendet nach gültiger Validierung `module-ready` mit
      `name`/`author`/`color`.

- [x] **E2. `BotRunner` bleibt unverändert im Verhalten** (Regressionsschutz)
      Rot: Test in `BotRunner.test.ts` – eine eintreffende
      `module-ready`-Nachricht ändert weder `status` noch `pausedReasonKind`
      noch laufende Ticks.
      Grün: expliziter Frühausstieg für `"module-ready"` in
      `handleWorkerMessage`.

- [x] **E3. `validateBotArtifact`** (US-1, US-2)
      Rot: `validateBotArtifact.test.ts` gegen `testUtils/FakeWorker.ts` –
      (a) gültiges Modul → `name`/`author`/`color` übernommen;
      (b) fehlender Name → Dateiname-Fallback, fehlender Autor → `"unbekannt"`;
      (c) `module-invalid` → `{ valid: false, reason }`;
      (d) verbotenes Muster → Ablehnung **ohne** dass ein Worker erzeugt wird;
      (e) keine Antwort → Timeout-Ablehnung;
      (f) in allen Pfaden wird `terminate()` aufgerufen.
      Grün: `client/src/sandbox/validateBotArtifact.ts` mit injizierbarem
      `createWorker`/`timeoutMs`.

## F. Client: Registry-Zustand & UI

- [x] **F1. `useBotRegistry`** (US-3)
      Rot: `useBotRegistry.test.ts` – `bot-registry-snapshot` ersetzt die
      Liste vollständig, `bot-added` hängt an, `bot-removed` filtert nach
      `id`, fremde Message-Typen (z.B. `ping-broadcast`) ändern nichts.
      Grün: `client/src/botRegistry/useBotRegistry.ts` (nur Registry-Zustand,
      keine Upload-Fehler – siehe Design/SRP).

- [x] **F2. `BotRegistryList`** (US-3, US-4)
      Präsentations-Task (ohne Unit-Test): Liste mit Name/Autor/Farbe;
      `onRemove` **optional** – `/present` übergibt es nicht und zeigt daher
      keine Löschfunktion.

- [x] **F3. `BotUploadForm`** (US-1, US-2)
      Präsentations-Task (ohne Unit-Test): Datei-Input (`multiple`, `.js`) +
      Drag&Drop; pro Datei unabhängig: Größenprüfung gegen
      `MAX_BOT_SOURCE_BYTES` → `file.text()` → `validateBotArtifact` → bei
      Gültigkeit `bot-add` senden, sonst Eintrag in eine **lokale**
      Fehlerliste (kein Alles-oder-Nichts).

- [x] **F4. `/admin` und `/present` anbinden** (US-1, US-3, US-4)
      Wiring-Task (ohne Unit-Test): `AdminPage` erhält Upload-Formular und
      Liste mit Löschen (`bot-remove` senden); `PresentPage` erhält die Liste
      ohne Löschfunktion. Beide beziehen den Zustand aus `useBotRegistry`.

## G. Abschluss

- [ ] **G1. Manueller End-to-End-Durchlauf** (Design "Test-Strategie")
      Die sieben dort beschriebenen Schritte durchspielen – insbesondere
      Schritt 6 (Server-Neustart, Bot-Stand bleibt erhalten) und Schritt 7
      (`while(true){}` im Modul-Top-Level → Timeout-Ablehnung, `/admin` bleibt
      bedienbar).

- [x] **G2. Doku nachziehen**
      `docs/03-architektur.md`: Abschnitt "Bot-Sammelstelle" auf den
      umgesetzten Stand bringen (dreigeteilte Validierung, Persistenz als
      JSON-Datei) – ersetzt die pauschalen Draft-Aussagen „Server führt nichts
      aus" und „keine Persistenz".
      `docs/07-offene-punkte.md`: Umsetzungsstand ergänzen.

- [x] **G3. Gesamtabgleich gegen `requirements.md`**
      Alle Akzeptanzkriterien aus US-1 bis US-6 einzeln durchgehen und
      bestätigen; `npm test` und `npx tsc --noEmit` (bzw. Build) grün.
