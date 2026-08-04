# Beispiel-Bots & Bot-Format

Dieser Ordner enthält Referenz-Bots im offiziellen **Bot-Modul-Format** – so,
wie es eine `devkcode`-Vibe-Coding-Session am Messestand als Artefakt erzeugt.

## Format

Eine Bot-Datei ist ein **ES-Modul mit genau einem Default-Export**:

```js
export default {
  apiVersion: 1,          // Bot-API-Version (aktuell: 1)
  name: "Blitz-Bot",       // optional – sonst Dateiname
  author: "Anna",          // optional
  color: "#ff5da2",        // optional – sonst automatische Farbe

  // Pflicht: wird einmal pro Simulations-Tick (~150ms) aufgerufen.
  decide(state) {
    return "right"; // "left" | "right" | "jump" | "idle"
  },
};
```

## Regeln

- **Nur `decide` ist Pflicht.** Alle anderen Felder sind optional.
- **Kein** `import`, `require`, `fetch`, `window`, `document`, `eval` etc. –
  der Bot läuft in einem isolierten Web Worker ohne Browser-APIs.
- `decide` muss **synchron** eine der vier Actions zurückgeben. Ungültige
  Rückgaben werden als `"idle"` behandelt (Fehlertoleranz).
- Hilfsfunktionen/Closure-Variablen innerhalb der Datei sind erlaubt und
  erwünscht (z.B. für einfache State-Machines).

## Der `state`-Input (BotState)

Siehe `src/game/types.ts` für die vollständige Definition. Die wichtigsten
Felder:

| Feld | Bedeutung |
|---|---|
| `position` | Tile-Koordinaten des Bots |
| `facing` | Blickrichtung `"left" \| "right"` |
| `onGround` | steht der Bot auf dem Boden? |
| `nearbyTiles` | Sichtfeld-Raster (`"solid" \| "hazard" \| "goal" \| "empty" \| ...`) |
| `nearestCoin` | `{ dx, dy, value }` – Richtung + Score-Wert der nächsten Frucht |
| `nearestHazard` | `{ dx, dy, kind, active }` – Art & Aktiv-Zustand der nächsten Gefahr |
| `nearestUtility` | `{ dx, dy, kind }` – z.B. Trampolin (`"boingo"`) |
| `goalDirection` | `{ dx, dy }` – Richtung zum Ziel |
| `coinsCollected`, `livesRemaining`, `timeElapsedMs` | laufende Kennzahlen |

`dx`/`dy` sind Tile-Deltas relativ zum Bot (negativ = links/oben).

Details zu den Gefahren-Typen: siehe `docs/08-hazards-und-utilities.md`.

## Dateien hier

Zwölf lauffähige Beispiel-Bots mit unterschiedlichen Strategien:

- `bot-sprinter.js` – rennt zum Ziel, springt bei Hindernissen
- `bot-sammler.js` – steuert Münzen an (auch über sich), dann das Ziel
- `bot-vorsichtige.js` – weicht Gefahren defensiv aus
- `bot-turbo.js` – minimalistisch: immer nach rechts, springt bei Gefahr
- `bot-goldgraeber.js` – jagt Früchte kompromisslos (Score über Zeit)
- `bot-angsthase.js` – extrem defensiv, großer Sicherheitsabstand
- `bot-feuertaenzer.js` – nutzt `active`-Zustand: läuft durch inaktive Gefahren
- `bot-trampolin.js` – steuert Trampoline (`nearestUtility`) für hohe Früchte an
- `bot-stomper.js` – springt gezielt auf stompbare Gegner
- `bot-huepfburg.js` – hüpft rhythmisch (Closure-Zähler als State-Machine)
- `bot-taktiker.js` – wägt `nearestCoin.value` ab (Umweg nur für teure Früchte)
- `bot-zickzack.js` – wartet (`idle`) taktisch, bis die Bahn frei ist

Dieselben Dateien liegen unter `public/example-bots/` und können in der App
über „Beispiel-Bots laden" direkt geladen werden.
