# 02 – Bot-API (State/Action-Contract)

Der versionierte Contract liegt in `packages/bot-contract/src/`. Guard und Worker
begrenzen die Ausfuehrung, sind aber keine umfassende Sicherheitsgarantie fuer Fremdcode.

## Grundprinzip

Jeder Bot ist **eine JavaScript-Datei** mit Default-Export. Empfohlener Einstieg:

```js
function choose(context, options) {
  const goals = options.filter((option) => option.target.kind === "goal");
  goals.sort((a, b) => b.route.goalProgressPx - a.route.goalProgressPx || a.id.localeCompare(b.id));
  return goals[0]?.id ?? null;
}

export default {
  apiVersion: 1,
  frameworkVersion: 1,
  name: "Mein Bot",
  author: "Gast",
  decide(state, tools) {
    return tools.navigate({ choose });
  },
};
```

- Wird **~30x pro Sekunde** (alle ~33ms, 30Hz) aufgerufen.
- Bekommt einen **read-only State-Snapshot** übergeben.
- Muss **synchron eine Liste von Actions** (`Action[]`) zurueckgeben. Diese wird
  nach Workerantwort fuer folgende Physikschritte gesetzt, nicht rueckwirkend
  im beobachteten Tick. `[]` = nichts tun.
- Laeuft im Web Worker; Browser-/Netzwerkzugriffe sind im Bot verboten.
  Eigene Closure-Variablen und Hilfsfunktionen in derselben Datei sind erlaubt.
- Alte Bots ohne `frameworkVersion` behalten `decide(state)` und den Low-Level-
  Action-Contract. Unbekannte Framework-Versionen werden vor dem Lauf abgelehnt.

Bearbeitet wird nur `client/src/bot/current-bot.js`. Speichern laedt die
bestehende Vorschau `/code` automatisch neu; dort den Bot laufen lassen und
anhand vorhandener Versuchstraces unter `client/src/bot/runs/` erklaeren.
Ein Framework-Update ersetzt die Arbeitsdatei nicht durch die Vorlage.
Vorhandenen Besuchercode bewahren; Reset nur als explizite Betreiberaktion.

## State-Objekt (tatsächlicher Contract, siehe `packages/bot-contract/src/state.ts`)

> Positionen/Distanzen sind in **Pixeln** (nicht Tiles), relativ zum Bot: `dx < 0`
> = links, `dy < 0` = oben. Die Objekt-Listen (`coins`/`hazards`/`utilities`) sind
> auf den Sichtbereich des Bots begrenzt und nach Distanz sortiert; `nearest*` ist
> jeweils das erste Element bzw. `null`.
>
> **Sichtbereich** (`client/src/game/state/viewport.ts`): ein achsenparalleles
> Rechteck von **±400 px horizontal** (halbe Canvas-Breite) und **±540 px
> vertikal**. Vertikal entspricht das der vollen Weltenhöhe: da alle Level
> `worldHeight: 540` haben und die Kamera nie vertikal scrollt, sieht auch ein
> Mensch permanent die komplette Level-Höhe. Es gibt keine Sichtlinien-Prüfung –
> Wände verdecken nichts.

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

  nearbyTiles: TileType[][];             // 11x9, Bot in der Mitte bei [4][5]
  platforms: {                           // exakte Rechteck-Geometrie aller
    dx: number; dy: number;              // sichtbaren, festen Flächen (siehe
    width: number; height: number;       // .features/bot-toolkit/), NICHT
    kind: "ground" | "float" | "ceiling" | "block";  // gerastert wie nearbyTiles
    id?: string;
    collision?: "solid" | "one-way-up";
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
  navigation?: NavigationObservation;   // versionierte Erweiterung, siehe unten
}

type TileType = "empty" | "solid" | "hazard" | "coinBlock" | "goal" | "unknown";

type Action = "left" | "right" | "jump" | "idle" | "sprint-left" | "sprint-right";

// Rückgabe von decide: mehrere gleichzeitige Actions pro Tick.
type DecideResult = Action[];
```

## Framework-Tools, Version 1

Navigation kommt aus `@arena/bot-navigation` im Worker, nicht aus kopierten
Helfern im Template. Der Contract heisst `ToolsApi`:

```ts
interface ToolsApi {
  readonly navigate: (options?: { choose?: ChooseRoute }) => Action[];
}
type ChooseRoute = (context: StrategyContext, options: readonly RouteOption[]) => string | null;
interface StrategyContext {
  timeElapsedMs: number;
  timeRemainingMs: number;
  livesRemaining: number;
  justRespawned: boolean;
  previousTargetId: string | null;
}
interface RouteOption {
  id: string;
  target: {
    id: string;
    kind: "coin" | "goal";
    position: { x: number; y: number };
    value: number;
  };
  route: {
    id: string;
    estimatedDurationMs: number;
    detourPx: number;
    expectedFruitValue: number;
    goalProgressPx: number;
    risk: number;
    landingMarginPx: number;
    mechanics: Array<"walk" | "jump" | "drop" | "boingo" | "stomp">;
    scope: "target-reachable" | "local-progress";
  };
}
```

`navigate` ist synchron, an den aktuellen State gebunden und genau einmal pro
`decide` erlaubt. Jeder Worker besitzt eine eigene persistente Navigatorinstanz.
Vor der ersten Entscheidung wartet die Laufzeit auf `module-ready`, damit
Modul und Tools bereitstehen; das Tick-Budget misst nicht den Modulstart.
`choose` laeuft an sicheren Entscheidungsgrenzen; laufende Manoever werden nicht
mit jeder neuen Frucht unterbrochen. Die Rueckgabe sind angebotene **Options-IDs**,
keine Actions, Ziel-IDs oder selbstgebauten Plaene. Context/Optionen sind Kopien.
Gib die Actions von `navigate` unveraendert zurueck, ohne eigene Motorikreflexe.

`null` waehlt die bekannte Ziel-Fortsetzung mit niedrigem Risiko und Fortschritt.
Eine unbekannte ID meldet einen Hinweis und nutzt denselben Fallback. Das ist
kein Veto: Auch herausgefilterte Optionen koennen im Fallback wieder vorkommen.
`risk` ist ein relativer Kostenwert, keine Sterbewahrscheinlichkeit. Bekannte
Kollisionen werden ausgeschlossen, dynamische Prognosen bleiben unsicher.
`target-reachable` fuer Fruechte verlangt Einsammelkontakt und tragfaehige
Fortsetzung; `local-progress` verspricht nur einen lokalen Teilweg. Ohne
bekannte Fortsetzung wird `blocked` diagnostiziert, kein blinder Sprung erzwungen.

Vollstaendige Beispiele: `examples/strategies/sprinter.js`, `collector.js` und
`cautious.js`. Sie zeigen Fortschritt/Zeit, Fruchtwert/Zusatzzeit mit Endspurt
und Lebensbedingung sowie Risiko/Landepuffer. Kein Bot-Build ist erforderlich.

### Navigation-Observation

`navigation` aus `navigation.ts` hat `version: 1`, `epoch`, `frame`,
`observedAtMs`, `physicsStepMs`, den absoluten realen `body`, `viewport`, optional
`goalBounds`, `boingoJumpVelocity` und `stompJumpVelocity`. `movement` enthaelt
`jumpStartedAtMs`, `impulseKind`, `impulseAtMs` und `sourceId`.
Fehlende Observation-Version 1 ist fuer `navigate` ein API-Fehler.

Sichtbare Objekte besitzen optional stabile `id`s und relative `bounds`
(`dx`, `dy`, `width`, `height`). Position und Legacy-Distanzen behalten ihre
Bedeutung. `tuning.botWidth/botHeight` sind die effektiven World-Body-Masse.
Hazardpositionen/Geschwindigkeiten stammen aus beobachteten aktiven Instanzen;
Respawns erzeugen keine kuenstliche Geschwindigkeit. Ausgeloeste Bloecke bleiben
solide, solange ihr Collider existiert; freigelegte Fruechte erscheinen in
`coins` bis zum Einsammeln. `gapAhead` bleibt eine Legacy-Abkuerzung, kein
Landungsnachweis. One-Way-Plattformen kollidieren nur von oben beim Fallen.

## Sprint & variable Sprunghöhe

- **`"sprint-left"`/`"sprint-right"`**: wie `"left"`/`"right"`, aber der Bot baut über eine
  kurze Zeitspanne Momentum auf – je länger er ununterbrochen dieselbe Sprint-Action
  zurückgibt, desto schneller wird er (bis zu einer maximalen Sprint-Geschwindigkeit).
   Normales Laufen, Stillstand oder Richtungswechsel setzen die Sprint-Rampe
   zurueck; Stillstand setzt die horizontale Geschwindigkeit auf null.
- **Sprung-Boost:** Löst ein Bot einen Sprung aus, während er (durch vorheriges Sprinten)
  schneller als die Basisgeschwindigkeit ist, wird der Sprung automatisch höher UND weiter.
- **Variable Sprunghöhe:** Gibt ein Bot `"jump"` über mehrere aufeinanderfolgende Ticks
  zurück ("hält die Taste"), erreicht der Sprung seine volle Höhe. Wechselt er direkt danach
   zu einer anderen Action, wird der normale Aufstieg nach der Mindesthaltezeit
   abgeschnitten. Boingo-/Stomp-Impulse haben keinen alten Jump-Cut-Timer. Ein
  einzelner `"jump"`-Tick reicht dabei immer für eine brauchbare Mindesthöhe (kein
  Nachteil für Bots, die "jump" nur kurz zurückgeben).

## Regeln, die das devkcode-Profil dem Nutzer/der KI erklären muss

1. **Nur eine Bot-Datei bearbeiten.** Zusaetzliche Strategie-Hilfsfunktionen sind erlaubt,
   solange sie innerhalb derselben Datei/desselben Scopes bleiben (kein Import, kein `require`).
2. **Browser-/Netzwerkzugriffe sind verboten.** Der Guard ist ein begrenzter
   Vorfilter, keine umfassende Isolation aller Browser-Worker-APIs.
3. **Kein Zustand über Ticks hinweg garantiert**, außer via Closure-Variablen innerhalb der
   Bot-Datei selbst (das ist erlaubt und sogar erwünscht, z.B. für einfache State-Machines).
4. **Rückgabewert ist eine Liste gültiger Action-Strings (`Action[]`).** Mehrere Actions
   pro Tick sind erlaubt und werden gleichzeitig angewendet (z.B. `["jump", "sprint-right"]`);
   bei mehreren horizontalen Bewegungen gewinnt die zuletzt genannte. Ungültige Einträge werden
   ignoriert; ein nicht-Array/fehlender Rückgabewert → Bot macht in diesem Tick nichts (`[]`),
   keine Disqualifikation (Fehlertoleranz
   für's Publikum wichtiger als Strenge).
5. **Performance-Limit:** Der produktive Worker-Roundtrip hat 5 ms Budget. Bots, die das
   Zeitlimit überschreiten, werden für den jeweiligen Tick übersprungen (Ergebnis: `idle`).
    Bei wiederholter Überschreitung (10x in Folge) → Bot wird fuer den Lauf
   pausiert (kein hartes Disqualifizieren während des Rennens, aus Fairness-/Show-Gründen).

## Offene Detailfragen (siehe auch 07-offene-punkte.md)

- Sollen Bots Informationen über andere Bots bekommen (z.B. um Rennen taktisch zu spielen)?
  Aktuell: Nein, da keine Bot-Interaktion vorgesehen ist.
- Soll es mehrere Schwierigkeitsgrade des State-Objekts geben (Einsteiger vs. Fortgeschritten)?
