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

## Utilities

| Name | Asset | Mechanik |
|---|---|---|
| **Boingo** | Trampoline | von oben gelandet → kräftiger Sprung-Boost (deutlich höher als ein normaler Sprung), kein Schaden, wiederverwendbar |

### Boingo (Trampolin)
- Landet der Spieler von oben, wird er katapultiert (Boost ≈ 1,5× normale
  Sprunghöhe) und die Bounce-Animation spielt einmalig ab.
- Nützlich, um hoch gelegene (wertvolle) Früchte zu erreichen.

## Sichtbarkeit in der Bot-API (`BotState`)

Ein Bot bekommt pro Tick u.a. diese Felder (siehe `src/game/types.ts`):

```ts
nearestHazard: {
  dx: number;          // Tile-Distanz horizontal (– = links, + = rechts)
  dy: number;          // Tile-Distanz vertikal (– = oben, + = unten)
  kind: HazardKind;    // "schnetzler" | "stachlinger" | "loderix" | "kugelblitz"
  active: boolean;     // ob gerade gefährlich (bei Loderix togglt es)
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
als `"hazard"` auf (getaktete nur, solange sie „an" sind).

### Was ein Bot daraus machen *könnte* (illustrativ, nicht implementiert)
- `kind === "schnetzler"` → könnte über den Gegner **springen** (Stomp) statt
  auszuweichen.
- `kind === "loderix" && !active` → gefahrlos **durchlaufen**, spart Zeit.
- `kind === "stachlinger"` / `"kugelblitz"` → **ausweichen/timen**, nie stompen.
- `nearestUtility.kind === "boingo"` → Trampolin ansteuern, um an hohe Früchte
  mit hohem `value` zu gelangen.

## Bewusst (noch) nicht enthalten

- **Arrow Trap** (Projektil) und **Rock/Spike Head** (Richtungs-Trigger) – höherer
  Implementierungsaufwand; können bei Bedarf additiv über Registry/Behavior
  ergänzt werden, ohne bestehende Logik zu ändern.
