# Requirements: Arena Hub Server (Basisinfrastruktur)

## Kontext

Beim Messestand-Betrieb gibt es 4–5 unabhängige `/dev`-Stationsrechner, auf denen
Besucher mit Hilfe von `devkcode` einen Bot entwickeln (siehe `docs/01-konzept.md`,
`docs/04-devkcode-profil.md`). Auf einem zentralen Rechner sollen zusätzlich zwei
weitere Ansichten laufen: `/present` (großer Screen, Übersicht mehrerer
Gamesessions/Leaderboard) und `/admin` (Kontrollansicht: Bots einlesen, Turnier
konfigurieren, Runden starten).

`docs/03-architektur.md` und `docs/09-bot-artefakt-und-turnier.md` legten bisher
eine "kein Server, alles clientseitig"-Entscheidung fest. `docs/07-offene-punkte.md`
führte den Mehr-Stationen-/Zentral-Leaderboard-Fall explizit als offenen Punkt.
Dieses Feature trifft dazu die Entscheidung: Für den **Betrieb von `/present` und
`/admin`** (inkl. eines Broadcast-Kanals, den auch `/dev` empfangen kann) wird ein
zentraler Node.js-Server als reiner **WebSocket-Router** eingeführt. Die eigentliche
Spielsimulation (Phaser, Bot-Sandbox, Scoring) bleibt davon unberührt und weiterhin
clientseitig – das wird in Folge-Features umgesetzt.

Explizit **nicht** Teil dieses Features: Übertragung des Bot-Artefakts (`decide.js`)
von einer `/dev`-Station zum Präsentationsrechner. Dieser Weg ist weiterhin offen
(t.b.d.) und wird in einem eigenen späteren Feature-Spec behandelt.

Scope dieses Features ist ausschließlich die **Basisinfrastruktur**: TypeScript,
Node-Server (WS-Router + Static-Hosting des Frontends), React-Frontend mit den
Routen `/dev`, `/present`, `/admin` und einem Ende-zu-Ende-PoC-Datenfluss
(Admin-Broadcast wird von `/present` und `/dev` empfangen). Kein Phaser, keine
Bot-Sandbox, keine Persistenz, keine Authentifizierung.

## User Stories

### US-1: Zentraler Broadcast-Kanal zwischen Admin, Present und Dev

Als Standbetreuer möchte ich, dass `/admin`, `/present` und `/dev` über einen
zentralen Server per WebSocket verbunden sind, damit Nachrichten in Echtzeit
zwischen den Ansichten fließen können.

Akzeptanzkriterien:
- WHEN eine Client-Route (`/admin`, `/present` oder `/dev`) im Browser geladen wird
  SHALL DAS SYSTEM automatisch eine WebSocket-Verbindung zum zentralen Server
  aufbauen.
- WHEN die WebSocket-Verbindung erfolgreich aufgebaut wurde SHALL DAS SYSTEM den
  Verbindungsstatus ("verbunden") sichtbar in der jeweiligen UI anzeigen.
- WHEN die WebSocket-Verbindung getrennt wird SHALL DAS SYSTEM den Verbindungsstatus
  auf "getrennt" aktualisieren und automatisch einen Wiederverbindungsversuch
  unternehmen.
- WHEN der Server eine Nachricht von einem Client empfängt, die für andere Clients
  bestimmt ist, SHALL DAS SYSTEM diese Nachricht an alle anderen verbundenen Clients
  weiterleiten (Broadcast), ohne den Inhalt zu interpretieren oder zu verändern.

### US-2: Admin kann eine Test-Broadcast-Nachricht senden

Als Standbetreuer möchte ich über `/admin` eine Ping-Nachricht auslösen können,
damit ich nachweisen kann, dass mein Kommando bei allen anderen Ansichten ankommt.

Akzeptanzkriterien:
- WHEN der Nutzer auf `/admin` den "Ping"-Button klickt SHALL DAS SYSTEM eine
  Broadcast-Nachricht mit einem Zeitstempel und einem festen Ping-Text über den
  Server an alle anderen verbundenen Clients senden.
- WHEN der Ping-Button geklickt wurde SHALL DAS SYSTEM in der `/admin`-Ansicht selbst
  eine Bestätigung anzeigen, dass die Nachricht gesendet wurde.

### US-3: Present zeigt eingehende Broadcasts an

Als Standbetreuer möchte ich auf `/present` eingehende Broadcast-Nachrichten sehen,
um den Datenfluss vom Admin-Rechner zum Präsentations-Screen zu verifizieren.

Akzeptanzkriterien:
- WHEN `/present` eine Broadcast-Nachricht vom Server empfängt SHALL DAS SYSTEM den
  Inhalt der Nachricht (inkl. Zeitstempel) in der UI anzeigen.
- WHEN mehrere Broadcast-Nachrichten nacheinander eintreffen SHALL DAS SYSTEM
  mindestens die letzte(n) Nachricht(en) sichtbar machen (kein stillschweigendes
  Verwerfen ohne Anzeige).

### US-4: Dev empfängt denselben Broadcast-Kanal

Als Standbetreuer möchte ich, dass auch `/dev` (obwohl inhaltlich unabhängig von
Bot-Entwicklung in diesem Feature) den Admin-Broadcast empfängt und anzeigt, damit
der vollständige Roundtrip (Admin → Server → alle Stationen) nachweisbar ist.

Akzeptanzkriterien:
- WHEN `/dev` eine Broadcast-Nachricht vom Server empfängt SHALL DAS SYSTEM den
  Inhalt der Nachricht in der UI anzeigen.
- WHEN `/dev` geladen wird, ohne dass bereits eine Bot-Entwicklungslogik existiert,
  SHALL DAS SYSTEM dennoch eine funktionsfähige WebSocket-Verbindung samt
  Broadcast-Empfang bereitstellen (unabhängig von zukünftigem Bot-Dev-Feature-Code).

### US-5 (NFR): Saubere, modulare, erweiterbare Architektur

Als Entwicklerteam möchten wir, dass Server und Client nach SOLID-Prinzipien,
Clean-Code-Standards und YAGNI/DRY/KISS strukturiert sind, damit spätere Features
(Bot-Artefakt-Transfer, Leaderboard, Turniersteuerung, Phaser-Integration) ohne
Umbau der Basisinfrastruktur andocken können.

Akzeptanzkriterien:
- WHEN neuer Code für WebSocket-Transport, Message-Routing oder UI-Darstellung
  geschrieben wird SHALL DAS SYSTEM diese Verantwortlichkeiten in getrennten
  Modulen/Dateien abbilden (Single Responsibility, keine Monolith-Datei, die
  Transport, Routing-Logik und UI-Rendering vermischt).
- WHEN Nachrichtentypen zwischen Client und Server definiert werden SHALL DAS
  SYSTEM diese als benannte, typisierte Contracts (TypeScript-Typen/Interfaces)
  zentral definieren, sodass sie nicht dupliziert werden (DRY).
- WHEN eine Komponente/ein Modul erstellt wird, das aktuell nicht für den
  PoC-Scope benötigt wird (z.B. Auth, Persistenz, Reconnect-Backoff-Strategien mit
  komplexer Konfiguration) SHALL DAS SYSTEM auf diese Funktionalität verzichten
  (YAGNI), bis ein konkreter Bedarf/Folge-Feature-Spec sie einführt.
- WHEN das Server-Modul erweitert wird (z.B. neue Route oder neuer Message-Typ)
  SHALL DAS SYSTEM dies ermöglichen, ohne bestehende Module inhaltlich verändern
  zu müssen, die mit der neuen Funktionalität nichts zu tun haben (Open/Closed,
  skalierbares Design).
- WHEN dieses Feature umgesetzt wird SHALL DAS SYSTEM strikt testgetrieben
  (Rot-Grün-Refactor, siehe `AGENTS.md` → "Test-Driven Development") entwickelt
  werden; produktiver Code ohne vorher geschriebenen, fehlschlagenden Test gilt
  als nicht konform.
- WHEN dieses Feature begonnen wird SHALL DAS SYSTEM als allererste Maßnahme ein
  einheitliches Test-Framework (Vitest) für alle Packages (`server`, `client`,
  `packages/shared`) einrichten, bevor fachlicher Produktivcode entsteht.

### US-6: Server hostet das gebaute Frontend

Als Standbetreuer möchte ich nur einen einzigen Prozess/Port starten müssen, damit
der Aufbau am Stand möglichst einfach bleibt.

Akzeptanzkriterien:
- WHEN der Node-Server gestartet wird SHALL DAS SYSTEM sowohl den WebSocket-Endpoint
  als auch die gebauten statischen React-Frontend-Dateien über denselben HTTP-Port
  ausliefern.
- WHEN im Browser eine der Routen `/dev`, `/present` oder `/admin` direkt
  aufgerufen wird (z.B. per Reload oder Lesezeichen) SHALL DAS SYSTEM die
  entsprechende React-Ansicht korrekt ausliefern (Client-Side-Routing-Fallback).

## Nicht-Ziele

- Keine Phaser-Integration, keine Spielsimulation, keine Bot-Sandbox in diesem
  Feature.
- Kein Übertragungsweg für Bot-Artefakte (`decide.js`) von `/dev` zum
  Präsentationsrechner – bleibt explizit offen/t.b.d.
- Keine Persistenz (kein Datenbank-/Dateisystem-Speicher für Sessions oder
  Nachrichten) – rein In-Memory für die Laufzeit des Serverprozesses.
- Keine Authentifizierung/Autorisierung der Clients.
- Kein echtes Leaderboard, kein Bot-Import, keine Turnierkonfiguration – nur
  UI-Platzhalter/Grundgerüst, sofern in tasks.md vorgesehen.
- Kein produktionsreifes Reconnect-/Retry-Konzept mit Backoff-Konfiguration;
  einfacher automatischer Reconnect genügt.

## Offene Fragen

- Exakte Namenskonvention/Format der WebSocket-Message-Contracts (wird in
  `design.md` festgelegt).
- Wie später der Bot-Artefakt-Transfer von `/dev` zum Präsentationsrechner
  gelöst wird (separates Folge-Feature, siehe `docs/07-offene-punkte.md`).
- Ob/wie `/present` später mehrere echte Gamesessions gleichzeitig darstellt
  (Grid-Layout, Leaderboard-Aggregation) – bewusst außerhalb dieses Feature-Scopes.

## Begleitende Doku-Updates (Teil dieses Features)

- `docs/03-architektur.md`: Abschnitt zur Server-Entscheidung für den
  Multi-Stationen-Betrieb (`/present`, `/admin`, Broadcast-Kanal zu `/dev`) ergänzen,
  ohne die clientseitige Simulation in Frage zu stellen.
- `docs/09-bot-artefakt-und-turnier.md`: Hinweis ergänzen, dass der
  Bot-Artefakt-Transfer zum Präsentationsrechner weiterhin offen ist und nicht
  über den neuen Broadcast-Server läuft (aktueller Stand).
- `docs/07-offene-punkte.md`: den Punkt "Zentrales Leaderboard über mehrere
  Stationen/Rechner hinweg" als entschieden markieren, mit Verweis auf
  `.features/arena-hub-server/`.
