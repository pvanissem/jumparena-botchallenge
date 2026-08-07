# 02 – Bot-API (State/Action-Contract)

Diese Schnittstelle ist der wichtigste Baustein: Sie muss so klar und beschränkt sein, dass
die KI in devkcode zuverlässig gültigen, sicheren Code generiert, der nicht "ausbrechen" kann.

## Grundprinzip

Jeder Bot besteht aus **genau einer Funktion**:

```js
function decide(state) {
  // ... vom Nutzer/der KI generierte Logik ...
  return actions; // z.B. ["jump", "right"]
}
```

- Wird **~30x pro Sekunde** (alle ~33ms, 30Hz) aufgerufen.
- Bekommt einen **read-only State-Snapshot** übergeben.
- Muss **synchron eine Liste von Actions** (`Action[]`) zurückgeben, die im selben
  Tick gleichzeitig angewendet werden (Multi-Action). `[]` = nichts tun.
- Läuft in einem Web Worker – kein Zugriff auf `window`, `fetch`, `localStorage`, DOM, andere
  Bots oder globale Variablen außerhalb des Funktionsscopes.

## State-Objekt (tatsächlicher Contract, siehe `packages/bot-contract/src/state.ts`)

> Positionen/Distanzen sind in **Pixeln** (nicht Tiles), relativ zum Bot: `dx < 0`
> = links, `dy < 0` = oben. Die Objekt-Listen (`coins`/`hazards`/`utilities`) sind
> auf den Sichtbereich des Bots begrenzt und nach Distanz sortiert; `nearest*` ist
> jeweils das erste Element bzw. `null`.

```ts
interface BotState {
  tick: number;
  position: { x: number; y: number };   // Pixel
  facing: "left" | "right";
  onGround: boolean;
  isAlive: boolean;
  velocity: { vx: number; vy: number };  // px/s
  isSprinting: boolean;
  sprintRampProgress: number;            // 0..1, Fortschritt der Sprint-Rampe

  nearbyTiles: TileType[][];             // 7x5, Bot in der Mitte
  platforms: {                           // exakte Rechteck-Geometrie aller
    dx: number; dy: number;              // sichtbaren, festen Flächen (siehe
    width: number; height: number;       // .features/bot-toolkit/), NICHT
    kind: "ground" | "float" | "ceiling" | "block";  // gerastert wie nearbyTiles
  }[];
  tuning: {                              // Bewegungs-Physik-Konstanten, damit
    gravity: number; tileSize: number; tickMs: number;
    baseMoveSpeed: number; sprintMoveSpeed: number; sprintRampMs: number;
    baseJumpVelocity: number; sprintJumpVelocity: number; minJumpHoldMs: number;
    botWidth: number; botHeight: number; // eigene Kollisionsbox
  };

  coins: { dx: number; dy: number; value: number }[];
  hazards: { dx: number; dy: number; kind: HazardKind; active: boolean;
             warning: boolean; stompable: boolean; vx: number; vy: number }[];
  utilities: { dx: number; dy: number; kind: UtilityKind }[];

  nearestCoin: (typeof coins)[number] | null;      // = coins[0] ?? null
  nearestHazard: (typeof hazards)[number] | null;  // = hazards[0] ?? null
  nearestUtility: (typeof utilities)[number] | null;

  goalDirection: { dx: number; dy: number };
  gapAhead: { present: boolean; distance: number | null };
  worldBounds: { width: number; height: number };
  justRespawned: boolean;
  tookDamage: boolean;

  coinsCollected: number;
  livesRemaining: number;
  timeElapsedMs: number;
}

type TileType = "empty" | "solid" | "hazard" | "coinBlock" | "goal" | "unknown";

type Action = "left" | "right" | "jump" | "idle" | "sprint-left" | "sprint-right";

// Rückgabe von decide: mehrere gleichzeitige Actions pro Tick.
type DecideResult = Action[];
```

## Navigations-Hilfsfunktionen im Bot-Template

`client/src/bot/current-bot.template.js` enthält neben `decide` bereits fertige,
getestete Hilfsfunktionen (siehe `.features/bot-toolkit/`), die devkcode beim
Bauen der `decide`-Logik direkt nutzen (und beliebig anpassen) kann, z.B.
`predictPath`/`calcLandingCoords` (wo lande ich, wenn ich nichts ändere?),
`minJumpHoldToReach` (wie lange muss ich springen, um X zu erreichen?),
`wallAhead`/`surfaceAt` (lokale Geometrie), `predictHazard`/
`pathIntersectsHazard` (kreuzt meine Bahn einen beweglichen Hazard?) sowie
kleinere Bausteine wie `moveToward` und `createJumpHold`. Vollständiger
Referenz-Index direkt im Kopfkommentar der Datei.

## Sprint & variable Sprunghöhe

- **`"sprint-left"`/`"sprint-right"`**: wie `"left"`/`"right"`, aber der Bot baut über eine
  kurze Zeitspanne Momentum auf – je länger er ununterbrochen dieselbe Sprint-Action
  zurückgibt, desto schneller wird er (bis zu einer maximalen Sprint-Geschwindigkeit).
  Wechselt er zurück zu `"left"`/`"right"`/`"idle"` oder die Richtung, fällt die
  Geschwindigkeit sofort auf das Basistempo zurück.
- **Sprung-Boost:** Löst ein Bot einen Sprung aus, während er (durch vorheriges Sprinten)
  schneller als die Basisgeschwindigkeit ist, wird der Sprung automatisch höher UND weiter.
- **Variable Sprunghöhe:** Gibt ein Bot `"jump"` über mehrere aufeinanderfolgende Ticks
  zurück ("hält die Taste"), erreicht der Sprung seine volle Höhe. Wechselt er direkt danach
  zu einer anderen Action, wird der Sprung abgeschnitten und der Bot fällt sofort – ein Bot
  kann also über die Anzahl aufeinanderfolgender `"jump"`-Ticks die Sprunghöhe steuern. Ein
  einzelner `"jump"`-Tick reicht dabei immer für eine brauchbare Mindesthöhe (kein
  Nachteil für Bots, die "jump" nur kurz zurückgeben).

## Regeln, die das devkcode-Profil dem Nutzer/der KI erklären muss

1. **Nur `decide(state)` darf definiert werden.** Zusätzliche Hilfsfunktionen sind erlaubt,
   solange sie innerhalb derselben Datei/desselben Scopes bleiben (kein Import, kein `require`).
2. **Kein Zugriff auf Browser-APIs.** Der Worker stellt ohnehin keine bereit – das Profil
   sollte der KI aber explizit sagen, dass sie sich darauf nicht verlassen soll.
3. **Kein Zustand über Ticks hinweg garantiert**, außer via Closure-Variablen innerhalb der
   Bot-Datei selbst (das ist erlaubt und sogar erwünscht, z.B. für einfache State-Machines).
4. **Rückgabewert ist eine Liste gültiger Action-Strings (`Action[]`).** Mehrere Actions
   pro Tick sind erlaubt und werden gleichzeitig angewendet (z.B. `["jump", "sprint-right"]`);
   bei mehreren horizontalen Bewegungen gewinnt die zuletzt genannte. Ungültige Einträge werden
   ignoriert; ein nicht-Array/fehlender Rückgabewert → Bot macht in diesem Tick nichts (`[]`),
   keine Disqualifikation (Fehlertoleranz
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
