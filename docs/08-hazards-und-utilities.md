# 08 – Hazards & Utilities

Dieses Dokument beschreibt die im Level platzierbaren **Hazards** (Gefahren) und
**Utilities** (nützliche Objekte), ihre Mechanik sowie – besonders wichtig – wie
sie sich im `BotState` (dem Input jeder `decide(state)`-Funktion) zeigen.

> Hinweis: Die eigentliche Bot-Logik (`decide(state)`) wird später am Stand per
> `devkcode` erzeugt. Dieses Dokument beschreibt die **API-Fläche**, die ein Bot
> nutzen kann – nicht bereits gebaute Bot-Strategien.

## Architektur (kurz)

Hazards/Utilities sind datengetrieben und über eine **Registry** erweiterbar
(Open/Closed): ein neuer Typ = ein Eintrag in `registry.ts` + ggf. ein Behavior
in `behaviors.ts`. Weder die `GameScene` noch der Kollisions-Handler kennen
Kind-spezifische Sonderfälle.

```
src/game/hazards/
  defs.ts        # Kind-Typen + Level-Definitionen (discriminated unions)
  registry.ts    # kind -> { texture, anim, stompable, behavior, hitbox }
  behaviors.ts   # pure Update-Funktionen: patrol / static / timed / pendulum
  factory.ts     # kind -> Sprite + Physik-Body + Startanimation
```

## Hazards

| Name | Asset | Mechanik | Stompbar? | Dauerhaft gefährlich? |
|---|---|---|---|---|
| **Schnetzler** | Saw | patrouilliert horizontal zwischen zwei Punkten | ✅ ja | ja |
| **Stachlinger** | Spikes | statisch, sitzt auf dem Boden | ❌ nein | ja |
| **Loderix** | Fire | getaktet an/aus (Feuerstoß) | ❌ nein | **nein** (nur "an") |
| **Kugelblitz** | Spiked Ball | schwingt als Pendel um einen Aufhängepunkt | ❌ nein | ja |
| **Spikehead** | Spiked Ball (rot eingefärbt) | fällt nach Betreten einer Trigger-Zone herab, steigt danach langsam wieder auf | ❌ nein | **nein** (nur während Fallen/Liegen/Aufsteigen) |

### Schnetzler (Säge)
- Bewegt sich zwischen `minX` und `maxX` mit `speed`.
- **Einziger** Hazard, der per Draufspringen (Stomp) neutralisiert werden kann –
  wie ein klassischer Platformer-Gegner. Seitlicher Kontakt kostet ein Leben.

### Stachlinger (Stacheln)
- Steht fest auf Boden/Plattformen, immer aktiv.
- Kein Lebewesen → nicht stompbar. Jede Berührung kostet ein Leben. Muss
  umsprungen/umgangen werden.

### Loderix (Feuer)
- Zyklus: `onMs` (an) → `offMs` (aus), mit optionalem `phaseMs`-Versatz, damit
  mehrere Instanzen nicht synchron takten (Default: 1500 / 1500 / 0).
- **Nur im „An"-Zustand gefährlich** – im „Aus"-Zustand ist die Kollision
  deaktiviert. Das ist das Timing-Element: Ein Bot kann lernen zu warten, bis
  Loderix aus ist, und dann gefahrlos passieren.

### Kugelblitz (Stachelkugel am Pendel)
- Schwingt deterministisch (Sinus) um `pivotX/pivotY` mit `length`, `periodMs`
  und `amplitudeDeg` (Default: 2400 ms, 50°).
- Dauerhaft gefährlich; muss zeitlich zwischen den Schwüngen passiert werden.

### Spikehead (fallender Stachelkopf)
- Nutzt dasselbe Sprite wie Kugelblitz (Spiked Ball), aber rot eingefärbt
  (kein eigenes Asset nötig).
- Hängt in Ruheposition (`originY`) über einer Passage. Betritt der Racer
  eine definierte horizontale Trigger-Zone (`triggerMinX`/`triggerMaxX`),
  löst dies nach einer kurzen, festen Vorwarnzeit (`warnMs`, Default 400ms)
  den Fall aus.
- Zyklus: **warning** (an `originY`, ungefährlich) → **falling** (`fallMs`,
  Default 200ms, Y interpoliert `originY`→`fallToY`) → **resting** (`restMs`,
  Default 600ms, verharrt unten) → **rising** (`riseMs`, Default 500ms, Y
  interpoliert langsam zurück `fallToY`→`originY`) → **idle** (wieder oben,
  erneut auslösbar).
- Während falling/resting/rising ist er durchgehend gefährlich (nicht
  stompbar) – erst im "idle"-Zustand oben ist er ungefährlich und kann
  erneut getriggert werden.
- Rein zeit-/positionsbasiert, kein Zufall – siehe
  `client/src/game/hazards/behaviors.ts#spikeheadState`.

## Utilities

| Name | Asset | Mechanik |
|---|---|---|
| **Boingo** | Trampoline | von oben gelandet → kräftiger Sprung-Boost (deutlich höher als ein normaler Sprung), kein Schaden, wiederverwendbar |

### Boingo (Trampolin)
- Landet der Spieler von oben, wird er katapultiert (Boost ≈ 1,5× normale
  Sprunghöhe) und die Bounce-Animation spielt einmalig ab.
- Nützlich, um hoch gelegene (wertvolle) Früchte zu erreichen.

## Sichtbarkeit in der Bot-API (`BotState`)

Ein Bot bekommt pro Tick u.a. diese Felder (siehe
`packages/bot-contract/src/state.ts`). Alle sichtbaren Objekte stehen zusätzlich
als distanz-sortierte Listen `coins`/`hazards`/`utilities` zur Verfügung;
`nearest*` ist jeweils das erste Listenelement bzw. `null`. Distanzen sind in
**Pixeln** relativ zum Bot (– = links/oben).

```ts
nearestHazard: {
  dx: number;          // Pixel-Distanz horizontal (– = links, + = rechts)
  dy: number;          // Pixel-Distanz vertikal (– = oben, + = unten)
  kind: HazardKind;    // "schnetzler" | "stachlinger" | "loderix" | "kugelblitz" | "spikehead"
  active: boolean;     // ob gerade gefährlich (Loderix/Spikehead togglen)
  warning: boolean;    // kündigt sich an (Spikehead-Vorwarnphase), sonst false
  stompable: boolean;  // vorberechnet: nur "schnetzler" ist true
} | null;

nearestUtility: {
  dx: number;
  dy: number;
  kind: UtilityKind;   // "boingo"
} | null;

nearestCoin: {
  dx: number;
  dy: number;
  value: number;       // Score-Wert der Frucht
} | null;
```

Zusätzlich taucht jeder aktuell gefährliche Hazard im Sichtfeld `nearbyTiles`
als `"hazard"` auf (getaktete/getriggerte nur, solange sie „an" sind). Die
Spikehead-Vorwarnung erscheint **nicht** in `nearbyTiles`, sondern
ausschließlich über `hazards[i].warning`.

### Was ein Bot daraus machen *könnte* (illustrativ)
- `stompable === true` (schnetzler) → könnte über den Gegner **springen** (Stomp)
  statt auszuweichen.
- `kind === "loderix" && !active` → gefahrlos **durchlaufen**, spart Zeit.
- `kind === "spikehead" && warning` → kurz vor dem Fall **wegrennen**.
- `stompable === false` (stachlinger/kugelblitz/spikehead) → **ausweichen/timen**,
  nie stompen.
- `nearestUtility.kind === "boingo"` → Trampolin ansteuern, um an hohe Früchte
  mit hohem `value` zu gelangen.

## Bewusst (noch) nicht enthalten

- **Arrow Trap** (Projektil) – höherer Implementierungsaufwand; kann bei Bedarf
  additiv über Registry/Behavior ergänzt werden, ohne bestehende Logik zu
  ändern. (**Rock/Spike Head** wurde als "Spikehead" für Level 2 umgesetzt,
  siehe oben und `.features/level-two-kaizo/`.)
