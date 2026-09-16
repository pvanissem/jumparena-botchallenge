# 02 – Bot-API (State/Action-Contract)

> Aktueller Reset-Stand (16.09.2026): Das Besucher-Template liefert ausschließlich `[]` und startet keine Bewegung. Die fertige Level-1-Route liegt separat in `examples/strategies/messe-demo.js`. Dies ersetzt frühere Aussagen zur laufenden Standardvorlage.

Der versionierte Contract liegt in `packages/bot-contract/src/`. Guard und Worker
begrenzen die Ausfuehrung, sind aber keine umfassende Sicherheitsgarantie fuer Fremdcode.

## Grundprinzip

Jeder Bot ist **eine JavaScript-Datei** mit Default-Export. Empfohlener Einstieg:

```js
export default {
  apiVersion: 1,
  frameworkVersion: 2,
  name: "Mein Bot",
  author: "Gast",
  decide(state, tools) {
    return []; // Frischer Bot: Verhalten erst nach Besucherwunsch ergänzen.
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
  Action-Contract. Framework-Version 1 ist inkompatibel und muss neu erzeugt oder gezielt auf Version 2 migriert werden. Unbekannte Versionen werden vor dem Lauf abgelehnt.

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

## Bewegungshelfer, Framework-Version 2

Die Bot-Datei entscheidet über Ziel, Risiko, Boingo-Nutzung und Fortsetzung.
`@arena/bot-navigation` führt nur den gewählten Auftrag aus. Es gibt keinen
Autoplaner und keine automatisch vorgeschlagenen Ersatzrouten.

```ts
type ControlCommand =
  | { id: string; kind: "walk"; x: number; sprint?: boolean }
  | { id: string; kind: "jump"; platformId: string;
      x?: number; sprint?: boolean; holdMs?: number }
  | { id: string; kind: "boingo"; utilityId: string; platformId: string;
      x?: number; sprint?: boolean };
interface ControlStatus {
  commandId: string | null;
  state: "idle" | "running" | "succeeded" | "failed";
  phase: "approach" | "launch" | "flight" | "landing" | null;
  reason: string | null;
}
interface ControlTools {
  readonly run: (command: ControlCommand) => Action[];
  readonly status: () => ControlStatus;
}
// ToolsApi ist ein Alias für ControlTools.
```

`x` ist absolut; bei Sprung und Boingo ist die Plattformmitte der Standard.
Plattform- und Utility-IDs stammen aus sichtbaren Objekten. `holdMs` erlaubt
Experimente mit kürzerem Sprunghalten (0–1200 ms); ohne Angabe hält der Helfer
den normalen Sprung bis zum Ende des beobachteten Aufstiegs. Die Physikwerte bleiben unverändert.

**`jump` springt sofort ab.** Der Helfer plant keinen Anlauf und prüft weder
Erreichbarkeit noch Hindernisse auf der Flugbahn. `sprint: true` baut Tempo erst
während der Bewegung auf. Benötigt ein Sprung Anlauf, muss die Botstrategie
vorher einen passenden Laufauftrag ausführen. Nähe allein macht eine Plattform
nicht erreichbar. Springen ist auch auf die aktuelle Plattform möglich, etwa
über ein Hindernis; es braucht dafür keine Lücke.

Gefahren anhand ihrer Geometrie und Bewegung beurteilen, nicht nur anhand eines
Geschwindigkeitsschwellwerts: Ein Kugelblitz bleibt am Umkehrpunkt gefährlich.
Ein laufender Auftrag darf neu bewertet und ersetzt werden. Blindes Fortsetzen
ist keine Sicherheitsregel; blindes `[]` im Flug ist ebenfalls kein Ausweichen,
sondern nimmt die horizontale Steuerung und gegebenenfalls Sprunghalten weg.

Bei `failed` den `reason` auswerten: `danger-ahead` kann vorübergehend sein und
rechtfertigt kein dauerhaftes Sperren des Ziels. Ein Neuversuch braucht eine neue
ID. Dauerhafte Hindernisse wie Stacheln verschwinden nicht durch Warten.

Genau ein synchroner `run` ist pro Entscheidung erlaubt; `status()` darf mehrfach
gelesen werden. Tools sind an die aktuelle Entscheidung gebunden und werden nicht
gespeichert. Dieselbe ID mit identischen Parametern setzt den Auftrag fort.
Erfolg und Fehler bleiben für diese ID bestehen. Für einen absichtlichen
Neuversuch oder andere Parameter eine neue ID wählen. Eine neue ID ersetzt den
aktuellen Auftrag auch im Flug; sie erzeugt keinen zusätzlichen Luftsprung.
Geänderte Parameter unter der aktuellen ID sind ein Botfehler.

`status()` verarbeitet die aktuelle Beobachtung bereits vor `decide`. Die
Bot-Datei hält ihren Auftrag in einer Closure und entscheidet bei Erfolg oder
Fehler selbst über die Fortsetzung. Ohne `run` oder mit abweichend zurückgegebenen
Actions endet die Helferausführung; `return []` bedeutet Warten/Stoppen.
Respawn/Epoch-Wechsel setzt den Helfer zurück; eigene Closure-Variablen muss der
Bot ebenfalls zurücksetzen.

Laufen stoppt bei fehlendem Boden, Gefahr oder ausbleibendem Fortschritt mit
einem Fehler. Es wählt keinen Sprung. Springen und Boingo verlangen echte
Impuls-/Landungsbeobachtungen; Landung auf einer anderen Plattform ist ein Fehler.
Boingo steuert nur bis zum tatsächlichen Impuls zum Zwischenziel und danach
zur gewählten Plattform. Unerreichbare Aufträge dürfen scheitern. Die Helfer
sind keine Garantie für sichere Flugbahnen oder Gegnerbegegnungen.

Vollständige editierbare Beispiele liegen unter `examples/strategies/`:
`visitor-builder.js` wählt einen nahen Boingo und eine höhere Plattform,
`sprinter.js` bevorzugt Tempo, `collector.js` sammelt nahe Früchte bis zum
Endspurt, `cautious.js` wartet bei einem nahen aktiven Gegner. Diese Regeln sind
experimenteller Besuchercode und dürfen verändert werden. Sie sind kein Nachweis
für sichere Flugbahnen oder vollständige Leveldurchläufe. Insbesondere die einfache
Wartezone im `visitor-builder.js` kann auch bei einem ungefährlichen Nachbarhindernis
stehen bleiben; stationäre Hindernisse erfordern eine eigene Überquerungsregel.
Die explizite Route `messe-demo.js` ist separat für Level 1 erprobt. Kein Bot-Build ist erforderlich.

### Navigation-Observation

`navigation` aus `navigation.ts` hat `version: 1`, `epoch`, `frame`,
`observedAtMs`, `physicsStepMs`, den absoluten realen `body`, `viewport`, optional
`goalBounds`, `boingoJumpVelocity` und `stompJumpVelocity`. `movement` enthaelt
`jumpStartedAtMs`, `impulseKind`, `impulseAtMs` und `sourceId`.
`lastImpulse` hält optional den letzten tatsächlichen Impuls fest:
`{ sequence, kind: "jump" | "boingo" | "stomp", atMs, sourceId }` oder `null`.
Er bleibt nach der Landung erhalten; seine Sequenz zählt innerhalb einer Epoch
ab 1. Respawn/Epoch-Wechsel löscht ihn. `movement` beschreibt dagegen nur die
aktuelle Bewegungsphase. Für die Helfer wird Observation-Version 1 benötigt.

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
5. **Watchdog:** Ein vorläufiger 100-ms-Watchdog schützt vor hängenden Bots;
   er ist kein Rechenzeitbudget. Timeout oder Laufzeitfehler stoppt den Bot für
   den Lauf, löscht gehaltene Actions und ignoriert verspätete Antworten.
   Es gibt keinen automatischen Wiederanlauf. Die Initialisierung hat einen
   separaten Timeout. Höchstens eine Workeranfrage ist gleichzeitig offen;
   das garantiert weder identische Frameraten noch bitgenaue Wiederholbarkeit.

## Offene Detailfragen (siehe auch 07-offene-punkte.md)

- Sollen Bots Informationen über andere Bots bekommen (z.B. um Rennen taktisch zu spielen)?
  Aktuell: Nein, da keine Bot-Interaktion vorgesehen ist.
- Soll es mehrere Schwierigkeitsgrade des State-Objekts geben (Einsteiger vs. Fortgeschritten)?
