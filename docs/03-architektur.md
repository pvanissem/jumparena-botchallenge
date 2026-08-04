# 03 – Technische Architektur

## Überblick

```
┌─────────────────────────────────────────────────────────────┐
│                      Browser (Client)                        │
│                                                                │
│  ┌──────────────┐        ┌────────────────────────────────┐  │
│  │  Bot-Import   │──────▶│         Heat-Manager            │  │
│  │  (.js Dateien)│        │  (wählt 16 Bots pro Runde aus)  │  │
│  └──────────────┘        └───────────────┬────────────────┘  │
│                                            │                   │
│                                            ▼                   │
│                        ┌───────────────────────────────────┐  │
│                        │        Phaser Game Instance        │  │
│                        │  ┌───────┐ ┌───────┐   ┌───────┐  │  │
│                        │  │Grid   │ │Grid   │...│Grid   │  │  │
│                        │  │Cell 1 │ │Cell 2 │   │Cell 16│  │  │
│                        │  │(Cam)  │ │(Cam)  │   │(Cam)  │  │  │
│                        │  └───────┘ └───────┘   └───────┘  │  │
│                        │        gemeinsame Level-Szene       │  │
│                        └───────────────┬───────────────────┘  │
│                                          │  State-Snapshot pro Tick
│                                          ▼                      │
│              ┌───────────┐  ┌───────────┐       ┌───────────┐  │
│              │ Worker #1 │  │ Worker #2 │  ...  │ Worker #16│  │
│              │ decide()  │  │ decide()  │       │ decide()  │  │
│              └───────────┘  └───────────┘       └───────────┘  │
│                                          │  Action zurück       │
│                                          ▼                      │
│                        Simulation wendet Aktionen an           │
│                        (Bewegung, Kollisionen mit Level,       │
│                         Coin-Pickup, Hazard-Check)              │
│                                                                │
│                        ┌───────────────────────────────────┐  │
│                        │        Scoring / Leaderboard        │  │
│                        └───────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Komponenten

### 1. Bot-Import
- UI zum Hochladen/Auswählen von `.js`-Dateien (Drag&Drop oder Ordner-Scan via File System
  Access API, sofern Browser-Unterstützung ausreicht; sonst klassischer `<input type="file"
  multiple webkitdirectory>`).
- Validierung: Datei muss eine Funktion `decide` exportieren/definieren (einfacher Parse-Check,
  z.B. per Function-Constructor-Test in einem Worker, bevor sie "zugelassen" wird).
- Zuordnung: Dateiname → Bot-Name, zufällige/feste Farbe & Sprite-Variante.

### 2. Heat-Manager
- Verwaltet die Liste aller eingepflegten Bots.
- Teilt sie in Gruppen à 16 auf (konfigurierbar), verwaltet Rundenreihenfolge.
- Startet pro Heat eine neue Simulation/Szene, sammelt danach die Ergebnisse ein.

### 3. Phaser Game Instance – Grid aus Mini-Ansichten
- **Eine gemeinsame Level-Szene** (Tilemap, Collectibles, Hazards) wird einmal geladen.
- Pro Bot im aktuellen Heat: ein eigener Sprite in derselben Szene + eine eigene
  **Kamera (`this.cameras.add(...)`)**, die nur diesen Bot verfolgt und in eine Grid-Zelle
  gerendert wird (Phaser unterstützt mehrere Kameras mit eigenem Viewport auf einer Szene –
  das ist performanter als 16 komplett separate Scene-Instanzen).
- Kein Kollisions-Handling zwischen Bot-Sprites (eigene Physics-Gruppe pro Bot oder
  `collideWorldBounds` ja, Bot-zu-Bot-Kollision explizit deaktiviert).

### 4. Web-Worker-Pool
- Ein Worker pro Bot im aktiven Heat (bei 16 Bots: 16 Worker – das ist unkritisch für moderne
  Browser/Hardware).
- Kommunikationsprotokoll (Vorschlag):
  ```ts
  // Main Thread → Worker
  { type: "init", code: string }              // einmalig beim Laden
  { type: "tick", state: BotState }            // pro Simulationsschritt

  // Worker → Main Thread
  { type: "ready" }
  { type: "action", action: Action, tick: number }
  { type: "error", message: string, tick: number }  // z.B. Syntax-/Laufzeitfehler
  ```
- Timeout-Handling im Main Thread: Falls innerhalb von z.B. 5ms keine Antwort auf `tick`
  kommt, wird `idle` angenommen und mitgezählt (siehe 02-bot-api.md, Punkt 5).

### 5. Simulation
- Fixer Tick-Loop (~150ms) unabhängig vom Render-Loop (Phaser `time.addEvent` oder eigener
  `setInterval`/`requestAnimationFrame`-Akkumulator).
- Pro Tick: State für jeden Bot bauen → an Worker senden → Antworten sammeln (mit Timeout) →
  Aktionen auf die Spielwelt anwenden → Kollisionen/Coin-Pickup/Hazard-Treffer/Ziel-Erreichen
  prüfen → Score-Update.
- Rendering läuft weiterhin mit 60fps, interpoliert zwischen den Tick-Zielpositionen für
  flüssige Optik (optional, kann für MVP auch weggelassen werden – "snap to tile" reicht
  fürs erste).

### 6. Scoring/Leaderboard
- Siehe [05-scoring-und-heats.md](05-scoring-und-heats.md).

## Technologie-Stack (Vorschlag)

| Bereich | Technologie |
|---|---|
| Rendering/Spiel-Engine | Phaser 3 (Arcade Physics reicht, kein Matter.js nötig) |
| Sprache | TypeScript |
| Bot-Sandbox | Web Worker (Standard-Browser-API, kein zusätzliches Sandboxing-Framework nötig) |
| Build | Vite (schnell, einfach für ein Stand-Setup, kein Server nötig – reiner Static Build) |
| Persistenz | Keine Backend-Persistenz nötig; Leaderboard optional als LocalStorage/JSON-Export |

## Warum kein Server? (für die Spielsimulation)

Der Nutzer möchte die eigentliche Spielsimulation explizit clientseitig ausführen.
Vorteile für den Messestand:
- Kein Netzwerk/WLAN-Abhängigkeit, kein Server-Setup/-Ausfallrisiko vor Ort.
- Einfaches Deployment: ein Laptop/Rechner reicht, Build kann sogar offline laufen.
- Nachteil: Kein zentrales Leaderboard über mehrere Rechner/Stationen hinweg – siehe
  nächster Abschnitt für die Auflösung dieses Punkts.

## Zentraler Server für Multi-Stationen-Betrieb (/present, /admin, Broadcast an /dev)

> Entschieden in `.features/arena-hub-server/` (siehe dort `requirements.md` und
> `design.md` für Details).

Für den Betrieb von 4–5 unabhängigen `/dev`-Stationen plus einem zentralen
Präsentations-/Admin-Rechner wird die "kein Server"-Entscheidung **eingeschränkt**
(nicht aufgehoben): Für `/present` und `/admin` gibt es einen zentralen
Node.js-Prozess, der **ausschließlich** als WebSocket-Router/Relay und
Static-File-Host fungiert – er enthält keine Spiellogik, keine Bot-Sandbox, kein
Scoring. Die eigentliche Simulation bleibt vollständig clientseitig, wie oben
beschrieben.

- `/admin` kann darüber Broadcast-Nachrichten an alle anderen verbundenen
  Clients senden (z.B. eine Test-Ping-Nachricht als PoC).
- `/present` empfängt diese Broadcasts und zeigt sie an.
- `/dev`-Stationen können denselben Broadcast-Kanal ebenfalls empfangen
  (Roundtrip-Nachweis), sind aber ansonsten unabhängige, isolierte Prozesse pro
  Stationsrechner – sie kennen den Präsentationsrechner nicht und haben (noch)
  keine Bot-Entwicklungslogik an den Server angebunden.
- Persistenz: nur In-Memory für die Laufzeit des Serverprozesses, keine
  Datenbank/Dateispeicherung.

**Wichtige Klarstellung zu `/dev`:** Ein `/dev`-Prozess ist und bleibt ein rein
lokaler, isolierter Node-Prozess pro Stationsrechner. Er hat und bekommt
**keine** WebSocket-Verbindung, über die er Bot-Code an den Hub-Server sendet –
`/dev` dient ausschließlich dazu, dass am Stand (mit Hilfe von `devkcode`) eine
`.js`-Datei mit einer `decide(state)`-Funktion entsteht, die der Besucher lokal
herunterlädt/exportiert. `/dev` "weiß" nichts von `/admin`, `/present` oder
anderen Stationen.

### Bot-Sammelstelle (Konzept, Umsetzung als eigenes Feature)

Damit `/admin` und `/present` **denselben Stand an eingereichten Bot-Artefakten**
sehen, braucht es eine zentrale Sammelstelle – naheliegenderweise beim ohnehin
zentralen Hub-Server-Prozess:

- Der Hub-Server hält eine **In-Memory-Bot-Registry** (nur für die Laufzeit des
  Serverprozesses, keine Persistenz) mit den eingereichten Bot-Artefakten
  (Quellcode + Metadaten wie Name/Autor/Farbe).
- `/admin` und `/present` lesen/abonnieren dieselbe Registry über den
  bestehenden WebSocket-Kanal – beide sehen also garantiert denselben Stand.
- Der Server bleibt dabei reiner Relay/Speicher: Er **führt den Bot-Code nicht
  aus** (keine Bot-Sandbox, keine Simulation auf dem Server) – das Ausführen
  passiert weiterhin ausschließlich clientseitig (in `/present`, analog zur
  Sandbox aus `docs/09-bot-artefakt-und-turnier.md`).
- Als Zwischenlösung für das **Einspeisen** in die Sammelstelle: `/admin` bietet
  einen manuellen Datei-Upload (Drag&Drop/File-Input) für `.js`-Bot-Artefakte an.
  `/dev` ist daran **nicht** angebunden.

**Explizit weiterhin offen:** Wie das fertige Bot-Artefakt (`decide.js`) von
einer `/dev`-Station **auf den Admin-Rechner** gelangt (z.B. USB-Stick,
manuelles Kopieren, künftig evtl. ein eigener Transportmechanismus), ist
**nicht** Teil dieser Server-Infrastruktur und bewusst ungelöst – siehe
`docs/09-bot-artefakt-und-turnier.md`. Die Sammelstelle selbst (Registry im
Hub-Server + Admin-Upload + Anzeige in `/admin`/`/present`) ist als eigenes
Feature-Spec umzusetzen (siehe `docs/07-offene-punkte.md`).
