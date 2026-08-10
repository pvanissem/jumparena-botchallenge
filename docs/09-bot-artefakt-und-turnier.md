# 09 – Bot-Artefakt, Sandbox & Turniermodus

Dieses Dokument beschreibt, wie das Artefakt einer devkcode-Vibe-Coding-Session
in die Arena kommt, sicher ausgeführt wird und im Turnier gegeneinander antritt.

## Das Bot-Artefakt (Modul-Contract)

Ergebnis jeder Session ist **eine `.js`-Datei** – ein ES-Modul mit genau einem
Default-Export:

```js
export default {
  apiVersion: 1,          // Bot-API-Version
  name: "Blitz-Bot",       // optional (sonst Dateiname)
  author: "Anna",          // optional
  color: "#ff5da2",        // optional (sonst automatische Farbe)
  decide(state) {          // PFLICHT
    return "right";        // "left" | "right" | "jump" | "idle" | "sprint-left" | "sprint-right"
  },
};
```

- Nur `decide` ist Pflicht; alles andere hat Fallbacks.
- `apiVersion` schützt über einen mehrstündigen Event vor echten Breaking
  Changes: Bots aus Runde 1 laufen auch in Runde 20.
- Referenzformat + dokumentierte API als Kommentar: siehe
  `client/src/bot/current-bot.template.js` (siehe "Import" unten – das ist
  seit `.features/dev-station-mode/` die lebende Referenz direkt in der
  Datei, die devkcode bearbeitet, statt separater Beispiel-Bot-Dateien).

## Import in `/dev` (kein Server, keine Dateiauswahl, deterministische Datei)

> **Aktualisiert durch `.features/dev-station-mode/`:** Der ursprünglich hier
> beschriebene Import beliebiger `.js`-Dateien per File System Access
> API/Datei-Picker wurde **verworfen** zugunsten einer einzigen, festen
> Bot-Arbeitsdatei. Grund: devkcode bearbeitet die Bot-Logik direkt als
> Quelldatei im `/dev`-Projekt – ein zusätzlicher Import-Schritt danach wäre
> überflüssige Reibung.

- Die Bot-Logik lebt in `client/src/bot/current-bot.js` (git-ignoriert,
  Vorlage in `current-bot.template.js`, eingecheckt). devkcode bearbeitet
  diese Datei **direkt**, kein Upload, kein Picker, kein Ordner-Scan.
- `/dev` lädt den Quelltext dieser Datei per Vite-`?raw`-Import und führt ihn
  unverändert über die bestehende Sandbox aus (siehe "Sandbox" unten).
- Jede Änderung an `current-bot.js` löst über Vites HMR automatisch einen
  vollständigen Reload von `/dev` aus – Level, Racer-Status und
  BotRunner/Worker starten dadurch garantiert frisch mit dem neuen Code, ohne
  manuellen Klick.
- Zwischen zwei Besuchern setzt `npm run reset-bot` (Repo-Root) die Datei auf
  die Standardvorlage zurück; die fertige Datei wird davor manuell (z.B. per
  USB-Stick) vom Stationsrechner kopiert – siehe unten "Weiterhin offen/t.b.d."
- Damit ist die ursprüngliche „kein Server"-Entscheidung aus `docs/03`
  weiterhin gültig –   `/dev` läuft als reiner Vite-Client-Prozess
  (`npm run dev`, siehe `docs/03-architektur.md`) ohne jede WebSocket-/
  Server-Anbindung.

> **Ergänzung (siehe `.features/arena-hub-server/`):** Für den Betrieb von
> `/present` und `/admin` bei mehreren `/dev`-Stationen gibt es inzwischen einen
> zentralen WebSocket-Router-Server (siehe `docs/03-architektur.md`, Abschnitt
> "Zentraler Server für Multi-Stationen-Betrieb"). Dieser Server transportiert
> aber (noch) **keine** Bot-Artefakte automatisch von `/dev` – `/dev` sendet
> grundsätzlich nichts an den Server. Für `/admin` und `/present` ist stattdessen
> eine **zentrale Bot-Sammelstelle** im Hub-Server vorgesehen (Registry mit JSON-Datei-Persistenz,
> siehe `docs/03-architektur.md`, Abschnitt "Bot-Sammelstelle"), die beide
> Ansichten mit demselben Stand versorgt. Eingespeist wird diese Sammelstelle
> vorerst über einen **manuellen Datei-Upload in `/admin`** (Zwischenlösung).
> **Weiterhin offen/t.b.d.:** Wie das fertige Bot-Artefakt (`current-bot.js`)
> von einer `/dev`-Station **auf den Admin-Rechner** gelangt (z.B. USB-Stick,
> manuelles Kopieren) – das ist bewusst nicht Teil der bisherigen Infrastruktur
> und Gegenstand eines künftigen, separaten Feature-Specs.

## Sandbox (Web Worker)

Jeder Bot läuft in einem **eigenen Web Worker** (Modul-Worker):

1. **Statischer Guard** (`sandbox/staticGuard.ts`): schneller Regex-Vorfilter
   gegen `import`/`require`/`fetch`/`window`/`document`/`eval`/… – erste, nicht
   alleinige Verteidigungslinie.
2. **Dynamischer Import**: Der Quelltext wird als Blob-URL an den Worker
   übergeben, der ihn per `import()` lädt und validiert.
3. **Tick-Loop**: Pro Simulations-Tick (~150ms) sendet der Main-Thread den
   `BotState`, der Worker antwortet mit einer Action.
4. **Fehlertoleranz**: Laufzeitfehler → `idle` für diesen Tick. Verpasst der
   Worker zu viele Ticks in Folge (vermutlich Endlosschleife), wird er per
   `worker.terminate()` **hart beendet** und der Bot pausiert – kein
   Einfrieren des Stands, kein hartes Disqualifizieren.

Der harte Kill ist der Grund, warum echter Fremd-Code zwingend im Worker läuft
(nicht im Main-Thread): nur so lässt sich eine echte Endlosschleife stoppen.

## Turniermodus

- **Single-Elimination**, Gruppen à **max. 4 Bots** gleichzeitig.
- Pro Match laufen alle Bots im **selben Level** gleichzeitig; jeder hat ein
  eigenes Sprite + eine eigene **Kamera** (Grid 1×1 / 1×2 / 2×2). Keine
  Bot-zu-Bot-Kollision.
- **Wertung pro Match** (`game/scoring.ts`, aus `docs/05`): Frucht-Score +
  Zeitbonus − Tode − DNF-Abzug. Nur der/die **Erstplatzierte** kommt weiter
  (Zeit als Tie-Breaker).
- Bei zu wenigen Bots einfach kleinere/weniger Gruppen (kein Auffüllen).
- Am Ende: **Champion-Screen**. Bracket-Anzeige zeigt Runden → Matches →
  Gewinner live.

### Multi-Racer-Architektur (getrennte Welten)

Die naheliegende Idee – ein Level, mehrere Racer-Sprites, mehrere Kameras –
hätte ein hartes Fairness-Problem: Sammelt Bot A eine Frucht oder löst einen
Block, würde das Objekt zerstört und Bot B könnte es nicht mehr einsammeln.
Das wäre vom Startzeitpunkt abhängig und unfair.

Deswegen wird die bestehende `RaceScene` **pro Racer als separate Instanz**
unter einem eindeutigen Scene-Key gestartet. Jede Instanz besitzt ihre eigene
Physik-Welt und eigene Level-Objekte; die Kameras werden auf ein Grid von
Viewports im selben Canvas beschränkt. So entfällt jegliches Objekt-Sharing
strukturell, und "keine Bot-zu-Bot-Kollision" ergibt sich automatisch. Der
Hub-Server kennt weiterhin keine Spiellogik; er hält nur den Turnierzustand
und leitet Bracket, Match-Result und Match-Progress weiter.

### Ablauf-Komponenten
- `server/src/botRegistry/BotRegistry.ts` – alle importierten Bots (+ Persistenz)
- `server/src/tournament/TournamentService.ts` – Bracket-Struktur, Advance-Logik
- `server/src/tournament/SingleEliminationStrategy.ts` – Single-Elimination-Strategie
- `packages/shared/src/tournament.ts` – Turnier-Typen
- `packages/shared/src/messages.ts` – Turnier- & Match-Nachrichten
- `client/src/tournament/useTournamentState.ts` – Turnier-Zustand aus WebSocket
- `client/src/tournament/useMatchProgress.ts` – Live-Progress pro Match
- `client/src/match/MatchRunner.ts` – startet N × RaceScene im Grid
- `client/src/match/MatchView.tsx` – Phaser-Host für `/present`
- `client/src/game/scenes/RaceScene.ts` – parametrisierbarer Key, Viewport, Audio
- `client/src/pages/AdminPage.tsx` – Turnier-Konfiguration & Steuerung
- `client/src/pages/PresentPage.tsx` – Bracket / Match / Ergebnis / Champion

## Testmodus (`/dev`)

`/dev` bietet zwei Testmodi (siehe `.features/dev-station-mode/`):
„Selbst spielen" (Tastatur, ← → / Leertaste) und „Bot laufen lassen"
(deterministisch immer `client/src/bot/current-bot.js`, siehe "Import" oben).
Beide laufen im selben Level, nützlich zum Ausprobieren und Debuggen –
unabhängig vom späteren Turniermodus in `/present`.
