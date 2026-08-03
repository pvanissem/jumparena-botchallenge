# Tasks: Arena Hub Server (Basisinfrastruktur)

Bezug: `requirements.md` (US-1 bis US-6), `design.md`. Arbeitsweise: strikt
Rot-Grün-Refactor (siehe `AGENTS.md`) – jeder Task mit fachlicher Logik beginnt
mit einem fehlschlagenden Test.

## 0. Workspace-Grundgerüst

- [ ] 0.1 Root-Workspace aufsetzen (Bezug: Design "Repo-/Modulstruktur")
      `package.json` (Root, `workspaces: ["packages/*", "server", "client"]`),
      `tsconfig.base.json`, `.gitignore`-Ergänzungen (`node_modules`, `dist`),
      Root-Scripts `build`, `dev`, `test`, `test:watch`.
- [ ] 0.2 Vitest-Grundgerüst + trivialer Beweistest (Bezug: Design
      "Test-Tooling-Setup", US-5)
      `vitest.workspace.ts` in Root, `packages/shared`, `server`, `client` als
      Packages mit eigenem `package.json` anlegen (noch ohne fachlichen Code),
      je eine minimale `vitest.config.ts` (server: `node`-Env, client:
      `jsdom`-Env). Einen trivialen Test schreiben, der absichtlich fehlschlägt
      (rot), dann eine triviale Dummy-Assertion ergänzen, die ihn grün macht –
      Nachweis, dass `npm test` über alle Packages hinweg läuft.
- [ ] 0.3 `packages/shared` Grundstruktur (Bezug: Design "Schnittstellen &
      Datenmodelle")
      Leeres `src/index.ts`, Package-Export-Konfiguration, sodass `server` und
      `client` es als Workspace-Dependency referenzieren können.

## 1. Shared Message-Contract

- [ ] 1.1 Test: `PingBroadcastMessage`/`InboundMessage`/`OutboundMessage`-Typen
      kompilieren mit erwarteten Feldern (Bezug: US-1, Design "messages.ts")
      Ein Typ-Test (z.B. via `expectTypeOf` oder ein einfacher Vitest-Test, der
      ein Objektliteral gegen den Typ prüft) schreiben (rot, da Typen noch
      fehlen).
- [ ] 1.2 `packages/shared/src/messages.ts` implementieren (grün)
      `PingBroadcastMessage`, `InboundMessage`, `OutboundMessage` gemäß Design
      anlegen, Test aus 1.1 grün bekommen.

## 2. Server: Parsing & Registry (Kernbausteine, unabhängig von echtem WS)

- [ ] 2.1 Test für `parseInboundMessage` – gültige Nachricht (Bezug: US-1,
      Design "parseMessage.ts")
      Test: gültiges `ping-broadcast`-JSON wird korrekt typisiert
      zurückgegeben (rot).
- [ ] 2.2 Test für `parseInboundMessage` – ungültige Nachricht (Bezug:
      Fehlerbehandlung "Ungültige/kaputte Nachricht")
      Test: kaputtes JSON und unbekannter `type` ergeben `null` (rot).
- [ ] 2.3 `server/src/ws/parseMessage.ts` implementieren (grün)
      Minimale Implementierung, die 2.1 und 2.2 grün macht.
- [ ] 2.4 Test für `ClientRegistry.add`/`remove`/`getOthers` (Bezug: US-1,
      Design "ClientSource"/"ClientRegistry")
      Tests: hinzugefügter Client erscheint in `getOthers` für andere Sender,
      nicht für sich selbst; nach `remove` erscheint er nicht mehr (rot).
- [ ] 2.5 `server/src/ws/ClientSource.ts` + `ClientRegistry.ts` implementieren
      (grün)
      `ClientSource`-Interface + `ClientRegistry`-Klasse gemäß Design, Tests aus
      2.4 grün bekommen.

## 3. Server: Routing & Dispatch

- [ ] 3.1 Test für `BroadcastRouter.route` (Bezug: US-1, Design
      "BroadcastRouter")
      Test gegen ein Fake, das nur `ClientSource` implementiert: Nachricht von
      Sender A geht an B und C, nicht an A (rot).
- [ ] 3.2 `server/src/ws/BroadcastRouter.ts` implementieren (grün)
- [ ] 3.3 Test für `MessageDispatcher.register`/`dispatch` (Bezug: US-5
      Open/Closed, Design "MessageDispatcher")
      Tests: registrierter Handler wird bei passendem `type` aufgerufen; bei
      unbekanntem `type` kein Fehler/kein Aufruf eines falschen Handlers (rot).
- [ ] 3.4 `server/src/ws/MessageDispatcher.ts` implementieren (grün)
- [ ] 3.5 Test für `createPingBroadcastHandler` (Bezug: Design
      "handlePingBroadcast.ts")
      Test: Handler ruft `BroadcastRouter.route` mit korrekten Argumenten auf
      (rot, Router als Mock/Fake).
- [ ] 3.6 `server/src/ws/handlers/handlePingBroadcast.ts` implementieren (grün)

## 4. Server: Gateway, HTTP & Composition Root

- [ ] 4.1 `server/src/ws/ConnectedClient.ts` (Interface) anlegen (Bezug: Design
      "ConnectedClient") – kein eigener Test nötig (siehe design.md,
      Begründung "bewusst ohne eigene Unit-Tests").
- [ ] 4.2 `server/src/ws/WebSocketGateway.ts` implementieren (Bezug: US-1,
      US-2, US-3, US-4, Design "WebSocketGateway kennt nur Verbindungs-
      Lifecycle")
      Verdrahtet `ws`-Library-Events mit `ClientRegistry` und
      `MessageDispatcher` gemäß Design. Manuell gegen Task 5 (Client) verifiziert
      (kein isolierter Unit-Test, siehe Design-Begründung).
- [ ] 4.3 `server/src/http/createStaticServer.ts` implementieren (Bezug: US-6)
      Liefert `client/dist` aus, SPA-Fallback auf `index.html` für
      `/dev`, `/present`, `/admin`.
- [ ] 4.4 `server/src/config.ts` implementieren (Bezug: Design
      "Test-Tooling-Setup" – kein eigener Test, triviales Env-Parsing mit
      Defaults, siehe Design-Begründung).
- [ ] 4.5 `server/src/index.ts` (Composition Root) implementieren (Bezug:
      US-1–US-6)
      Verdrahtet HTTP-Server, WebSocketGateway, ClientRegistry,
      BroadcastRouter, MessageDispatcher (inkl. Registrierung des
      Ping-Broadcast-Handlers), startet auf konfiguriertem Port.

## 5. Client: WebSocket-Infrastruktur

- [ ] 5.1 Test für `WebSocketClient`-Statusübergänge (Bezug: US-1, Design
      "WebSocketClient")
      Test gegen ein Mock-WebSocket: `connecting` → `connected` →
      `disconnected` → automatischer Reconnect-Versuch (rot).
- [ ] 5.2 `client/src/ws/WebSocketClient.ts` implementieren (grün)
      Inkl. fixem Retry-Intervall (kein Backoff, siehe Design/YAGNI).
- [ ] 5.3 `client/src/ws/useWebSocketConnection.ts` implementieren (Bezug: US-1
      – kein eigener Test, dünner Adapter, siehe Design-Begründung)
      React-Hook, der `WebSocketClient` kapselt und `status`, `lastMessage`,
      `send` liefert.

## 6. Client: UI – Present & Dev (Broadcast-Empfang)

- [ ] 6.1 `client/src/components/ConnectionStatusBadge.tsx` implementieren
      (Bezug: US-1 – Statusanzeige, kein eigener Test)
- [ ] 6.2 `client/src/components/BroadcastFeed.tsx` implementieren (Bezug:
      US-3, US-4 – Anzeige eingehender Broadcasts, kein eigener Test, reine
      Präsentation)
- [ ] 6.3 `client/src/pages/PresentPage.tsx` implementieren (Bezug: US-3)
      Nutzt `useWebSocketConnection` + `ConnectionStatusBadge` +
      `BroadcastFeed`.
- [ ] 6.4 `client/src/pages/DevPage.tsx` implementieren (Bezug: US-4)
      Gleiche Bausteine wie Present; zusätzlich Hinweistext, dass Bot-Dev-Logik
      noch nicht Teil dieses Features ist.

## 7. Client: UI – Admin (Ping-Broadcast auslösen)

- [ ] 7.1 `client/src/pages/AdminPage.tsx` implementieren (Bezug: US-2)
      Ping-Button, der beim Klick eine `PingBroadcastMessage` mit aktuellem
      Zeitstempel über `send(...)` verschickt und lokal eine
      "gesendet"-Bestätigung anzeigt.

## 8. Client: Routing & Bootstrap

- [ ] 8.1 `client/src/App.tsx` implementieren (Bezug: US-6)
      React-Router-Setup mit Routen `/dev`, `/present`, `/admin` (plus einfache
      Startseite/Redirect für `/`).
- [ ] 8.2 `client/src/main.tsx` implementieren (Bootstrap, Vite-Entry-Point).
- [ ] 8.3 `client/vite.config.ts` konfigurieren (Build-Output nach
      `client/dist`, passend zu `createStaticServer.ts`).

## 9. End-to-End-Verdrahtung & Dry-Run

- [ ] 9.1 Build-Pipeline verifizieren (Bezug: Design "Build-/Startreihenfolge")
      `npm run build` baut `shared` → `client` → `server` in korrekter
      Reihenfolge; `npm run dev`/Start liefert Server auf einem Port aus.
- [ ] 9.2 Manueller Dry-Run gemäß `design.md` → "Test-Strategie" durchführen
      (Bezug: US-1–US-4, US-6)
      Drei Tabs (`/admin`, `/present`, `/dev`) öffnen, Ping auslösen,
      Broadcast-Empfang und Verbindungsstatus nach Tab-Reload verifizieren.
      Ergebnis (bestanden/Auffälligkeiten) hier kurz vermerken.

## 10. Begleitende Doku-Updates

- [ ] 10.1 `docs/03-architektur.md` ergänzen (Bezug: requirements.md
      "Begleitende Doku-Updates")
      Abschnitt zur Server-Entscheidung für `/present`/`/admin`/Broadcast an
      `/dev` hinzufügen, Simulation bleibt clientseitig.
- [ ] 10.2 `docs/09-bot-artefakt-und-turnier.md` ergänzen
      Hinweis, dass der Bot-Artefakt-Transfer weiterhin offen/t.b.d. ist und
      nicht über den neuen Broadcast-Server läuft.
- [ ] 10.3 `docs/07-offene-punkte.md` aktualisieren
      Punkt "Zentrales Leaderboard über mehrere Stationen/Rechner hinweg" als
      entschieden markieren, Verweis auf `.features/arena-hub-server/`.
