# Design: bot-state-vision

## Architektur-Überblick

Bezug zu `docs/03-architektur.md` (Simulation → State-Snapshot → Worker) und
`.features/level-one-arena/design.md` (bestehende `worldSnapshot.ts` +
`botStateBuilder.ts`). Das Feature erweitert die **State-Bau-Pipeline**, ohne die
Kollisions-/Regel-Logik (`raceRules.ts`) oder die Physik (`movement.ts`) zu
verändern.

Bestehende Pipeline (unverändert in ihrer Struktur):

```
RaceScene.fireBotTick()
  → buildSnapshot(): WorldSnapshot        (reine Daten, kein Phaser)
  → buildBotState(snapshot, racer, tick, extras): BotState   (pure Funktion)
  → Worker.decide(botState)
```

Kernprinzip (SOLID/DRY): Der **Contract** (`@arena/bot-contract`) definiert die
Typen. Der **`botStateBuilder`** bleibt eine **pure, Phaser-freie** Funktion und
ist damit vollständig unit-testbar (Rot-Grün-Refactor). Alle neuen Felder werden
aus bereits vorhandenen Daten abgeleitet oder als **explizite, primitive Eingaben**
in den Builder hineingereicht – der Builder "rät" nichts aus Phaser-Objekten.

### Betroffene / neue Komponenten

| Datei | Änderung |
|---|---|
| `packages/bot-contract/src/state.ts` | Neue Typen `VisibleCoin/VisibleHazard/VisibleUtility`, `GapAhead`; `BotState` erweitert; `NearestCoin/Hazard/Utility` werden zu Aliassen der `Visible*`-Typen (DRY). |
| `client/src/game/state/worldSnapshot.ts` | Hazard-Snapshot um `warning` erweitern; Utilities/Coins unverändert. |
| `client/src/game/state/botStateBuilder.ts` | Listen (sortiert, gefiltert), `nearest*` = `[0]`, `warning/stompable`, `velocity/isSprinting`, `gapAhead`, `worldBounds`, `justRespawned/tookDamage`. |
| `client/src/game/state/viewport.ts` (**neu**) | `VIEW_HALF_WIDTH_PX`/`VIEW_HALF_HEIGHT_PX` + `withinView()` – Single Source of Truth für den Sichtbereich. |
| `client/src/game/state/gapAhead.ts` (**neu**) | Pure `computeGapAhead(level, x, y, facing, maxDistancePx)`. |
| `client/src/game/hazards/behaviors.ts` | `spikeheadState` liefert bereits `phase`; daraus wird `warning` abgeleitet (kein neues Verhalten, nur Nutzung). |
| `client/src/game/scenes/RaceScene.ts` | `buildSnapshot` liefert `warning`; `fireBotTick` reicht `velocity/isSprinting/justRespawned/tookDamage` als `extras` an den Builder; Event-Flags werden nach jedem Bot-Tick zurückgesetzt. |
| `client/src/bot/AGENTS.md`, `current-bot.template.js`, `docs/02`, `docs/08` | Doku-Angleich (US-8). |

### Multi-Action & 30-Hz-Frequenz – betroffene Komponenten (US-9/US-10)

| Datei | Änderung |
|---|---|
| `packages/bot-contract/src/botModule.ts` | `decide`-Signatur: `(state) => Action[]`. |
| `packages/bot-contract/src/state.ts` | Neuer Typ-Alias `DecideResult = Action[]` (Doku/Klarheit). |
| `client/src/sandbox/workerLike.ts` | `action`-Message → `actions: Action[]`. |
| `client/src/sandbox/botWorker.ts` | Ergebnis von `decide` als Array durchreichen (keine Validierung – bleibt Runner-Aufgabe). |
| `client/src/sandbox/BotRunner.ts` | `tick()` liefert `Action[]`; `normalizeActions()` (fehlertolerant); Timeout/Fehler → `[]`. |
| `client/src/game/control/RacerController.ts`, `BotController.ts` | `getNextAction` → `getNextActions(): Action[] \| Promise<Action[]>`. |
| `client/src/game/control/KeyboardController.ts` | `getNextActions(): Action[]` (aus `getInput()` abgeleitet; DRY). |
| `client/src/game/scenes/RaceScene.ts` | `lastBotActions: Action[]`; `applyBotActions(actions)` statt Einzel-Action; Tick-Intervall `33 ms`. |

## Schnittstellen & Datenmodelle

### Contract (`packages/bot-contract/src/state.ts`)

```ts
export interface VisibleCoin {
  dx: number; dy: number;   // Pixel, relativ zum Bot (Objekt − Bot)
  value: number;
}

export interface VisibleHazard {
  dx: number; dy: number;   // Pixel, relativ zum Bot
  kind: HazardKind;
  active: boolean;          // gerade gefährlich
  warning: boolean;         // Gefahr kündigt sich an (spikehead-Vorwarnphase)
  stompable: boolean;       // darf per Draufspringen neutralisiert werden
}

export interface VisibleUtility {
  dx: number; dy: number;   // Pixel, relativ zum Bot
  kind: UtilityKind;
}

// DRY: nearest* sind semantisch identisch zu einem Listenelement.
export type NearestCoin = VisibleCoin;
export type NearestHazard = VisibleHazard;
export type NearestUtility = VisibleUtility;

export interface GapAhead {
  present: boolean;
  distance: number | null;  // Pixel bis zur Lückenkante in facing-Richtung; null wenn keine
}

export interface BotState {
  tick: number;
  position: { x: number; y: number };
  facing: "left" | "right";
  onGround: boolean;
  isAlive: boolean;

  velocity: { vx: number; vy: number };   // NEU: px/s, vx>0 rechts, vy>0 unten
  isSprinting: boolean;                    // NEU

  nearbyTiles: TileType[][];               // 11×9, Bot in der Mitte bei [4][5]

  // Shortcuts = jeweils Listen-[0] oder null
  nearestCoin: NearestCoin | null;
  nearestHazard: NearestHazard | null;
  nearestUtility: NearestUtility | null;

  // Vollständige, distanz-sortierte, sichtbereichs-gefilterte Sicht (NEU)
  coins: VisibleCoin[];
  hazards: VisibleHazard[];
  utilities: VisibleUtility[];

  goalDirection: { dx: number; dy: number };
  gapAhead: GapAhead;                      // NEU
  worldBounds: { width: number; height: number };  // NEU

  justRespawned: boolean;                  // NEU
  tookDamage: boolean;                     // NEU

  coinsCollected: number;
  livesRemaining: number;
  timeElapsedMs: number;
}
```

Anmerkung zur Kompatibilität: `apiVersion` bleibt **1**. Die State-Felder werden
rein **additiv** ergänzt (`coins/hazards/utilities/velocity/isSprinting/gapAhead/
worldBounds/justRespawned/tookDamage`), `nearestHazard` um `warning/stompable`.
Der **einzige Breaking Change** ist der Rückgabetyp von `decide` (`Action` →
`Action[]`, siehe Abschnitt "Breaking Change: Multi-Action"). Bots, die nur
`nearestCoin.dx` o.ä. lesen, müssen lediglich ihre Rückgabe als Array formulieren
(US-3 bleibt für die State-Lesbarkeit gültig).

### Builder-Signatur (`botStateBuilder.ts`)

Die transienten, nur zur Laufzeit (Phaser) bekannten Werte werden als **ein
explizites `extras`-Objekt** übergeben – das hält die Funktion pur und testbar
(ISP: der Builder bekommt genau die primitiven Werte, die er braucht, keine
Phaser-Typen):

```ts
export interface BotStateExtras {
  velocity: { vx: number; vy: number };
  isSprinting: boolean;
  justRespawned: boolean;
  tookDamage: boolean;
}

export function buildBotState(
  snapshot: WorldSnapshot,
  racer: RacerRuntimeState,
  tick: number,
  extras: BotStateExtras
): BotState
```

### WorldSnapshot-Erweiterung (`worldSnapshot.ts`)

```ts
hazards: ReadonlyArray<{
  id: string; kind: HazardKind; x: number; y: number;
  active: boolean;
  warning: boolean;   // NEU
}>;
```

`stompable` wird **nicht** in den Snapshot aufgenommen, sondern im Builder aus der
`HAZARD_REGISTRY` gelesen (Single Source of Truth – DRY; die Snapshot-Schicht ist
reine Level-/Laufzeitgeometrie, keine Regel-Metadaten).

### Sichtbereich (`viewport.ts`)

```ts
/** Halbe Sichtbreite = halbe Canvas-Breite (800 / 2). */
export const VIEW_HALF_WIDTH_PX = 400;
/** Halbe Sichthöhe = volle Weltenhöhe, da die Kamera nie vertikal scrollt. */
export const VIEW_HALF_HEIGHT_PX = 540;

export function withinView(
  dx: number, dy: number,
  halfWidth = VIEW_HALF_WIDTH_PX,
  halfHeight = VIEW_HALF_HEIGHT_PX
): boolean {
  return Math.abs(dx) <= halfWidth && Math.abs(dy) <= halfHeight;
}
```

Der Sichtbereich ist ein **achsenparalleles Rechteck** um den Bot, kein Kreis. Er
bildet den Kamera-Ausschnitt nach (US-2: "Sichtbereich entspricht dem des Spielers"):

- **Horizontal ±400 px:** Der Canvas ist 800×540 (`ArenaView.tsx`), die Kamera folgt
  dem Racer zentriert → halbe Canvas-Breite. Verrät im Einzel-Viewport nicht das
  ganze Level.
- **Vertikal ±540 px:** Alle Level haben `worldHeight: 540`, exakt die Canvas-Höhe,
  und `RaceScene` setzt `cameras.main.setBounds(0, 0, worldWidth, 540)`. Die Kamera
  scrollt daher **nie** vertikal – ein Mensch sieht permanent die komplette
  Level-Höhe. Jedes vertikale Delta innerhalb eines Levels liegt somit im Sichtfeld.

Bewusst **kein** euklidischer Radius: ein Kreis schrumpft in der Diagonale und
würde einem hoch stehenden Bot den Boden tiefer liegender Plattformen verbergen.
`surfaceAt()`/`landingSpot()` lieferten dort `null`, obwohl `predictPath` Fallwege
von über 1000 px simuliert – der Bot könnte keine Landung planen.

**Eine** Definition für alle Objektarten (US-2, letzte AK), Grenze eingeschlossen,
keine Sichtlinien-/Verdeckungsprüfung (Wände verdecken nichts). Zentral in
`viewport.ts` als Single Source of Truth – kein Magic Value verstreut.

Dieselbe Definition filtert auch `state.platforms` (`visiblePlatforms.ts`, per
AABB-Overlap gegen das Sicht-Rechteck; Plattformen werden dabei nie geclippt).

### gapAhead (`gapAhead.ts`, neu)

Pure Funktion, arbeitet nur auf `LevelDef.platforms` (`kind === "ground"` bildet
den durchgehenden Boden; `float`-Plattformen zählen ebenfalls als Boden, auf dem
man steht):

```ts
export function computeGapAhead(
  level: LevelDef, x: number, y: number,
  facing: "left" | "right", maxDistancePx = VIEW_HALF_WIDTH_PX
): GapAhead
```

Der Default entspricht der horizontalen Sichtweite: 400 px = 25 Tile-Spalten.

Algorithmus (KISS, tile-basiert über die bestehende `tileTypeAt`/Plattform-Geometrie):
1. Startspalte = Tile-Spalte unter dem Bot.
2. Schreite in `facing`-Richtung Tile für Tile voran (bis `maxDistancePx`).
3. Für jede Spalte: Gibt es in der Bodenzeile **unter** dem Bot ein `solid`-Tile?
   - Solange ja: weiter.
   - Beim **ersten** Tile ohne Boden darunter → Lücke gefunden:
     `present: true`, `distance =` (Pixel-Distanz von Bot-x zur linken Kante
     dieses Tiles, immer ≥ 0).
4. Wird bis `maxDistancePx` keine Lücke gefunden → `present: false, distance: null`.

"Bodenzeile unter dem Bot" = `row = floor(y / TILE_SIZE) + 1` (ein Tile unter der
Bot-Mitte). Wiederverwendung der vorhandenen Plattform-Abfrage aus `tiles.ts`
(DRY) statt eigener Geometrie – dazu wird die interne Boden-Prüfung als kleine
pure Helferfunktion aus `tiles.ts` exportiert (`isSolidAt(level, col, row)`), die
`tileTypeAt` bereits intern nutzt.

### Builder-Logik im Detail

```ts
// 1. Kandidaten → relative + gefiltert + sortiert (eine generische Helper-Fn, DRY)
function toVisibleList<TIn, TOut>(
  from, items, mapFn
): TOut[]   // filtert via withinView, sortiert nach dist², mappt

// 2. coins/hazards/utilities über toVisibleList
// 3. nearest* = list[0] ?? null
// 4. gapAhead = computeGapAhead(...)
// 5. worldBounds = { width: level.worldWidth, height: level.worldHeight }
// 6. velocity/isSprinting/justRespawned/tookDamage aus extras
// 7. stompable pro Hazard aus HAZARD_REGISTRY[kind].stompable
```

Die Sortierung nach quadrierter Distanz (`dx²+dy²`) vermeidet unnötige
`Math.sqrt`-Aufrufe (Performance; 5 ms-Budget bleibt komfortabel).

## Ablauf / Sequenz

### Multi-Action-Verarbeitung (US-9)

Der Rückgabewert von `decide` ist jetzt `Action[]`. Contract:

```ts
// state.ts
export type DecideResult = Action[];
// botModule.ts
decide: (state: BotState) => Action[];
```

**BotRunner.normalizeActions** (fehlertolerant, Single Source of Truth für
Gültigkeit – DRY, ersetzt das alte `isValidAction`-Skalar):

```ts
function normalizeActions(value: unknown): Action[] {
  if (!Array.isArray(value)) return [];        // null/undefined/Skalar → []
  return value.filter(isValidAction);           // ungültige Elemente raus
}
```
- Timeout / `error`-Message / nicht-Array → `[]` (= "nichts tun", entspricht altem
  `idle`). Ein leeres Array nach dem Filtern zählt **nicht** als Fehlversuch (der
  Bot hat gültig geantwortet, nur nichts gewollt) – Fehlversuch nur bei Timeout,
  Exception oder `module-invalid` (unverändertes Kill-Verhalten, US-9 letztes AK).

**Anwendung in RaceScene (`applyBotActions`)** – reine Interpretationsschicht, keine
neue Physik (DRY: nutzt weiterhin `applyMovement`/`applyJumpOnly`):

```
applyBotActions(actions: Action[]):
  jump = actions.includes("jump")
  // "letzte horizontale gewinnt" (US-9):
  horiz = last of actions where action ∈ {left,right,sprint-left,sprint-right}
  dir    = horiz→{-1|+1} | (none → 0)
  sprint = horiz ∈ {sprint-left, sprint-right}
  applyMovement(dir, sprint, jump)   // eine Pipeline, wie Tastatur-Multi-Input
```

Dadurch ist die Bot-Steuerung **strukturgleich zum bestehenden Tastatur-Pfad**
(`applyKeyboardInput` → `applyMovement(dir, sprint, jump)`), der Bewegung + Sprint +
Sprung längst gleichzeitig kann. Der frühere Sonderfall `applyBotAction` (einzelne
Action, mit separatem `jump`/`idle`-Zweig) entfällt → weniger Code, ein
gemeinsamer Pfad (SRP/DRY). `idle` als explizites Listenelement ist bedeutungslos
(kein `dir`, kein `jump`) und damit implizit korrekt behandelt.

### 30-Hz-Frequenz (US-10)

`BOT_TICK_INTERVAL_MS` in `RaceScene` von `150` auf `33` (≈30 Hz). Der bestehende
Akkumulator (`sinceLastBotTick += delta`) bleibt unverändert; nur die Schwelle
sinkt. Timeout (5 ms) und `maxConsecutiveFailures` (10) bleiben unverändert (5 ms ≪
33 ms). Die "letzte Action wirkt bis zum nächsten Tick jeden Frame erneut"-Mechanik
bleibt – bei 60 fps liegen jetzt nur noch ~2 Frames zwischen zwei Bot-Ticks.

### State-Bau-Sequenz

```
update(delta):
  ...bestehende Physik/Regeln...
  // Event-Flags für diesen Frame ableiten:
  if (loseLifeAndRespawn passierte)  → pendingTookDamage = true
                                       → pendingJustRespawned = true (Respawn=Teil davon)
  if (Bot-Tick fällig):
    velocity   = body.velocity (vx, vy)
    isSprinting= sprintHoldMs > 0
    botState   = buildBotState(snapshot, racer, tick, {
                   velocity, isSprinting,
                   justRespawned: pendingJustRespawned,
                   tookDamage: pendingTookDamage })
    → Worker
    pendingJustRespawned = false   // nach Konsum zurücksetzen
    pendingTookDamage    = false
```

### Event-Flag-Lifecycle (justRespawned / tookDamage)

- In `RaceScene` werden zwei transiente Felder `pendingTookDamage`,
  `pendingJustRespawned` geführt.
- Gesetzt an **genau den Stellen**, die bereits `loseLifeAndRespawn` auslösen:
  `applyPitFall` (Pit-Fall, `update`) und `applyHazardContact` mit `"hit"`
  (`onHazardOverlap`). Beide bedeuten "Leben verloren **und** an Checkpoint
  respawnt" → beide Flags werden gemeinsam gesetzt (im aktuellen Spiel ist jeder
  Schadens-Fall zugleich ein Respawn; getrennte Flags bleiben aber
  zukunftssicher/ausdrucksstark und erfüllen US-7 wörtlich).
- **Konsumiert & zurückgesetzt** unmittelbar nach dem Bau des BotState im
  jeweiligen Bot-Tick. Dadurch ist das Flag im **ersten Tick nach dem Ereignis**
  `true` und danach wieder `false` (US-7).
- Reines `RaceScene`-Wiring, keine Regeländerung in `raceRules.ts` (Flags sind
  Präsentations-/Sensor-Belang, nicht Teil des persistenten Racer-Regelzustands →
  SRP).

### warning-Ableitung

`buildSnapshot` fragt für jeden `spikehead` `spikeheadState(def, msSinceTrigger)`
(bereits importiert/genutzt) ab und setzt `warning = phase === "warning"`. Für alle
anderen Hazard-Kinds ist `warning = false`. `active` bleibt exakt wie bisher
(`dynamic.activeHazardIds`). Keine Doppelberechnung: `spikeheadState` wird pro
Spikehead einmal aufgerufen; `active` und `warning` daraus konsistent abgeleitet.

## Fehlerbehandlung & Edge Cases

- **Leere Listen:** Keine Objekte im Sichtbereich → `[]` und `nearest* = null` (US-1/US-3).
- **Bot außerhalb jeder Plattform** (fällt gerade): `gapAhead` liefert konsistent
  `present: false, distance: null`, wenn in Laufrichtung innerhalb von
  `maxDistancePx` kein Boden mehr liegt (kein Crash).
- **Distanz nie negativ:** `gapAhead.distance = max(0, kante − botX)` bei
  `facing==="right"` bzw. `botX − kante` bei `left`.
- **Spikehead im Snapshot:** dessen Position ist `fallToY` (bestehende Konvention),
  damit `dy` die relevante Bedrohungshöhe widerspiegelt – unverändert.
- **`velocity` bei stehendem Bot:** `{vx:0, vy:0}` – unkritisch.
- **`isSprinting` Definition:** `sprintHoldMs > 0` (Bot gab in diesem/letzten Frame
  eine `sprint-*`-Action und bewegt sich) – exakt das Signal, das die Rampe speist.

## Test-Strategie

TDD (Rot-Grün-Refactor), Vitest. Schwerpunkt auf den **puren** Modulen:

**`botStateBuilder.test.ts`** (erweitern):
- coins/hazards/utilities: leere Listen; korrekte Sortierung nach Distanz;
  Sichtbereichs-Filter (drin/knapp draußen, horizontal wie vertikal);
  `dx/dy`-Vorzeichen (Pixel, − = links/oben).
- `nearest* === list[0]`; `null` bei leerer Liste.
- `stompable` nur bei `schnetzler` true; `warning` durchgereicht; `active` erhalten.
- `velocity/isSprinting/justRespawned/tookDamage` aus `extras` 1:1 übernommen.
- `worldBounds` aus Level; `goalDirection` unverändert.

**`viewport.test.ts`** (neu): `withinView` an/innerhalb/außerhalb der Grenze je
Achse (Grenze eingeschlossen, Ecke sichtbar); Objekte weit ober-/unterhalb des Bots
sind sichtbar.

**`visiblePlatforms.test.ts`** (neu): Plattform weit unter-/oberhalb des Bots wird
geliefert; horizontale Ausschlussgrenze; große Plattform wird nicht geclippt.

**`tiles.test.ts`** (erweitern): `buildNearbyTiles` liefert per Default 11×9 mit dem
Bot bei `[4][5]`; vollständiges Zell→Tile-Mapping.

**`gapAhead.test.ts`** (neu): kein Gap; Gap direkt voraus (distance≥0); Gap
außerhalb `maxDistancePx` → `false`; Richtung `left`/`right`; Bot ohne Boden.

**`state.test.ts`** (Contract, erweitern): Typ-/`ACTIONS`-Konsistenz bleibt;
ggf. Kompilier-Sicherung der neuen Typen.

**`BotRunner.test.ts`** (erweitern): `tick()` liefert jetzt `Action[]`.
- gültiges Array wird 1:1 durchgereicht; gemischtes Array → nur gültige Elemente;
  nicht-Array/`null`/Skalar → `[]`; Timeout → `[]` + Fehlversuch; `error` → `[]` +
  Fehlversuch; leeres/gefiltert-leeres Array → **kein** Fehlversuch.
- Kill nach `maxConsecutiveFailures` unverändert.

**`BotController.test.ts` / `KeyboardController.test.ts`** (anpassen):
`getNextActions()` liefert `Action[]` (Keyboard: Multi-Input → z.B.
`["sprint-right","jump"]`).

**RaceScene:** bewusst **nicht** unit-getestet (Phaser/Canvas nötig, siehe
Datei-Header). Verifikation der Flag-Lifecycle + velocity/isSprinting-Verdrahtung
**manuell** am `/dev`-Stand (Testmodus "Bot laufen lassen" mit einem Debug-Bot,
der Felder zurückspiegelt) – als Task dokumentiert.

## Auswirkungen auf bestehenden Code

- **Additiv** im Contract (keine Feld-Entfernung) → keine Breaking Changes für
  bestehende Bots; `apiVersion` bleibt 1.
- `buildBotState`-**Signatur** bekommt einen 4. Parameter (`extras`). Einziger
  Aufrufer ist `RaceScene.fireBotTick` → dort angepasst. (Tests werden mit angepasst.)
- `worldSnapshot`-Hazard-Objekt bekommt `warning` → `buildSnapshot` in `RaceScene`
  angepasst; `tiles.ts`/`behaviors.ts` liefern die Daten bereits.
- Kleine, klar abgegrenzte neue Module (`viewport.ts`, `gapAhead.ts`) statt
  aufgeblähtem Builder (SRP/KISS).
- Kein Einfluss auf `raceRules.ts`, `movement.ts`, Scoring, Tick-Rate, Sandbox.

### Breaking Change: Multi-Action (US-9/US-10)

Der Rückgabetyp von `decide` ändert sich von `Action` zu `Action[]` – ein echter
Breaking Change für Bot-Artefakte. Bewusst akzeptiert, weil (a) noch kein
Live-Event lief und (b) die Bots am Stand ohnehin vom devkcode-Agenten generiert
werden, der die neue Doku (AGENTS.md) kennt. `apiVersion` bleibt dennoch **1**
(keine parallele Alt-Version zu unterstützen). Betroffen und mit-angepasst:
`botModule.ts`, `botWorker.ts`, `BotRunner.ts`, `workerLike.ts`, `RacerController`/
`BotController`/`KeyboardController` sowie alle zugehörigen Tests und das
Bot-Template. Die Fehlertoleranz bleibt erhalten: ein alter Bot, der versehentlich
einen String zurückgibt, führt nur zu `[]` (nichts tun), nicht zum Absturz.

## Design-Entscheidungen zu den offenen Fragen aus requirements.md

1. **Sichtbereich:** achsenparalleles Rechteck `±400 × ±540 px`
   (`VIEW_HALF_WIDTH_PX` / `VIEW_HALF_HEIGHT_PX`), zentral in `viewport.ts` (s.o.).
   `nearbyTiles` ist **11×9** Tiles (176×144 px), Bot in der Mitte bei `[4][5]`
   (`buildNearbyTiles`-Defaults in `tiles.ts`).
2. **`gapAhead.distance`:** Distanz bis zur **Kante der Lücke** (erstes Tile ohne
   Boden darunter) in Laufrichtung – nicht bis zum Wieder-Auftauchen von Boden
   (KISS; "muss ich bald springen?" ist die relevante Frage).
3. **`nearbyTiles` + spikehead-warning:** In `nearbyTiles` erscheint nur `active`
   als `"hazard"`. Die Vorwarnung wird **ausschließlich**
   über `hazards[i].warning` bereitgestellt (eine klare Quelle, keine Duplizierung
   der Semantik in zwei Feldern → DRY/KISS).
