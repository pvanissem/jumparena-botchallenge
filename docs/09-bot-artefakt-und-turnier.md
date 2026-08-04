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
    return "right";        // "left" | "right" | "jump" | "idle"
  },
};
```

- Nur `decide` ist Pflicht; alles andere hat Fallbacks.
- `apiVersion` schützt über einen mehrstündigen Event vor echten Breaking
  Changes: Bots aus Runde 1 laufen auch in Runde 20.
- Referenzformat + Beispiele: `examples/bots/` (auch unter `public/example-bots/`).

## Import (kein Server, alles lokal im Browser)

Der Import läuft rein client-seitig – **kein Backend, kein Upload, kein
Netzwerk**:

- **File System Access API** (Chrome/Edge): `showOpenFilePicker` /
  `showDirectoryPicker` – Nutzer wählt Datei(en) oder einen ganzen Ordner
  direkt vom Rechner (z.B. den devkcode-Export-Ordner).
- **Fallback** `<input type="file">` für andere Browser.
- **Beispiel-Bots** werden per `fetch` aus `public/example-bots/` geladen.

Die Metadaten (`name`/`color`/…) kommen **ausschließlich aus dem dynamisch
geladenen Modul** – kein Parsing, keine Server-Extraktion. Ungültige Bots
(Syntaxfehler, fehlender `decide`, unbekannte API-Version) werden **nicht
verworfen**, sondern in der Bot-Liste sichtbar als „ungültig" markiert.

> Hinweis: Damit ist die ursprüngliche „kein Server"-Entscheidung aus
> `docs/03` weiterhin gültig – nur mit modernem Browser-Datei-Zugriff statt
> eines klassischen Upload-Endpoints. Dieser lokale Import ist **ausschließlich
> für den Testmodus innerhalb einer `/dev`-Station** relevant (siehe
> "Testmodus" unten) – `/dev` bleibt dabei ein komplett isolierter, lokaler
> Prozess ohne Verbindung zu `/admin` oder `/present` (siehe `docs/03`).
>
> **Ergänzung (siehe `.features/arena-hub-server/`):** Für den Betrieb von
> `/present` und `/admin` bei mehreren `/dev`-Stationen gibt es inzwischen einen
> zentralen WebSocket-Router-Server (siehe `docs/03-architektur.md`, Abschnitt
> "Zentraler Server für Multi-Stationen-Betrieb"). Dieser Server transportiert
> aber (noch) **keine** Bot-Artefakte automatisch von `/dev` – `/dev` sendet
> grundsätzlich nichts an den Server. Für `/admin` und `/present` ist stattdessen
> eine **zentrale Bot-Sammelstelle** im Hub-Server vorgesehen (In-Memory-Registry,
> siehe `docs/03-architektur.md`, Abschnitt "Bot-Sammelstelle"), die beide
> Ansichten mit demselben Stand versorgt. Eingespeist wird diese Sammelstelle
> vorerst über einen **manuellen Datei-Upload in `/admin`** (Zwischenlösung).
> **Weiterhin offen/t.b.d.:** Wie das fertige Bot-Artefakt (`decide.js`) von
> einer `/dev`-Station **auf den Admin-Rechner** gelangt (z.B. USB-Stick,
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

### Ablauf-Komponenten
- `store/botRegistry.ts` – alle importierten Bots (+ Runner, + Fehlerstatus)
- `store/tournamentStore.ts` – Bracket-Struktur, Advance-Logik
- `store/matchStore.ts` – Live-Zustand & Ranking des laufenden Matches
- `services/tournamentRunner.ts` – verbindet Bracket ↔ RaceScene
- `game/scenes/RaceScene.ts` – Multi-Racer-Simulation + Kamera-Grid

## Testmodus

Unabhängig vom Turnier gibt es „Manuell testen": ein einzelner, per Tastatur
(← → / Leertaste) gesteuerter Racer im selben Level – nützlich zum Ausprobieren
des Levels und zum Debuggen.
