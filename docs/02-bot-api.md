# 02 – Bot-API (State/Action-Contract)

Diese Schnittstelle ist der wichtigste Baustein: Sie muss so klar und beschränkt sein, dass
die KI in devkcode zuverlässig gültigen, sicheren Code generiert, der nicht "ausbrechen" kann.

## Grundprinzip

Jeder Bot besteht aus **genau einer Funktion**:

```js
function decide(state) {
  // ... vom Nutzer/der KI generierte Logik ...
  return action; // z.B. "right"
}
```

- Wird **einmal pro Simulations-Tick** (~150ms) aufgerufen.
- Bekommt einen **read-only State-Snapshot** übergeben.
- Muss **synchron** einen gültigen Action-String zurückgeben.
- Läuft in einem Web Worker – kein Zugriff auf `window`, `fetch`, `localStorage`, DOM, andere
  Bots oder globale Variablen außerhalb des Funktionsscopes.

## State-Objekt (Vorschlag, muss final abgestimmt werden)

```ts
interface BotState {
  tick: number;                // aktueller Simulationsschritt
  position: { x: number; y: number };   // Tile-Koordinaten des Bots
  facing: "left" | "right";
  onGround: boolean;
  isAlive: boolean;

  // Sichtfeld: begrenzter Ausschnitt der Tilemap um den Bot herum (z.B. 7x5 Tiles)
  nearbyTiles: TileType[][];   // z.B. "empty" | "solid" | "hazard" | "coinBlock" | "goal"

  // Vereinfachte Sensordaten (praktischer für KI-generierten Code als rohes Tile-Parsing)
  nearestCoin: { dx: number; dy: number } | null;
  nearestHazard: { dx: number; dy: number } | null;
  goalDirection: { dx: number; dy: number };

  coinsCollected: number;
  livesRemaining: number;
  timeElapsedMs: number;
}

type TileType = "empty" | "solid" | "hazard" | "coinBlock" | "goal" | "unknown";

type Action = "left" | "right" | "jump" | "idle";
```

## Regeln, die das devkcode-Profil dem Nutzer/der KI erklären muss

1. **Nur `decide(state)` darf definiert werden.** Zusätzliche Hilfsfunktionen sind erlaubt,
   solange sie innerhalb derselben Datei/desselben Scopes bleiben (kein Import, kein `require`).
2. **Kein Zugriff auf Browser-APIs.** Der Worker stellt ohnehin keine bereit – das Profil
   sollte der KI aber explizit sagen, dass sie sich darauf nicht verlassen soll.
3. **Kein Zustand über Ticks hinweg garantiert**, außer via Closure-Variablen innerhalb der
   Bot-Datei selbst (das ist erlaubt und sogar erwünscht, z.B. für einfache State-Machines).
4. **Rückgabewert muss exakt einem der 4 Action-Strings entsprechen.** Ungültige oder fehlende
   Rückgaben → Bot macht in diesem Tick nichts (`idle`), keine Disqualifikation (Fehlertoleranz
   für's Publikum wichtiger als Strenge).
5. **Performance-Limit:** `decide()` muss innerhalb von z.B. 5ms zurückkehren. Bots, die das
   Zeitlimit überschreiten, werden für den jeweiligen Tick übersprungen (Ergebnis: `idle`).
   Bei wiederholter Überschreitung (z.B. 10x in Folge) → Bot wird für den Rest des Heats
   pausiert (kein hartes Disqualifizieren während des Rennens, aus Fairness-/Show-Gründen).

## Offene Detailfragen (siehe auch 07-offene-punkte.md)

- Wie groß soll das Sichtfeld (`nearbyTiles`) sein? Zu groß → Bot "sieht" zu viel/wird zu
  mächtig; zu klein → Strategie wird zu simpel.
- Sollen Bots Informationen über andere Bots bekommen (z.B. um Rennen taktisch zu spielen)?
  Aktuell: Nein, da keine Bot-Interaktion vorgesehen ist.
- Soll es mehrere Schwierigkeitsgrade des State-Objekts geben (Einsteiger vs. Fortgeschritten)?
