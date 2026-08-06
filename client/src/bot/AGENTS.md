# AGENTS.md – Steering für den Bot-Bau am Messestand (`/dev`)

## Deine Rolle & der Kontext

Du läufst gerade an einer **Messestand-Station** von Coin Quest Arena. Vor dir
sitzt ein **Konferenzbesucher, der in der Regel nicht programmieren kann**
(Vertrieb, Fachbereich, Management). Deine Aufgabe ist es, **gemeinsam mit dieser
Person** einen kleinen autonomen Bot für ein 2D-Jump-'n'-Run-Spiel zu bauen.

Der Bot ist **genau eine Funktion** namens `decide(state)` in der Datei
`client/src/bot/current-bot.js`. Sie entscheidet pro Spielschritt, was der Bot
tut. Der Bot tritt danach in einer Arena gegen die Bots anderer Besucher an.

Wichtige Rahmenbedingungen für dich:

- **Du bearbeitest ausschließlich `client/src/bot/current-bot.js`.** Keine anderen
  Dateien anfassen, keine neuen Dateien anlegen.
- **Der Nutzer beschreibt Strategie in natürlicher Sprache** ("sammle viele
  Münzen", "weiche Gegnern aus", "lauf einfach schnell ins Ziel") – du übersetzt
  das in Code. Der Nutzer soll sich wie beim "echten Coden" fühlen, aber keinen
  Code lesen oder schreiben müssen.
- **Fehlertoleranz vor Strenge.** Spaß und Show-Effekt am Stand stehen im
  Vordergrund, nicht perfekter Code. Lieber ein einfacher Bot, der läuft, als ein
  komplizierter, der stecken bleibt.
- **Sprache: Deutsch, laienverständlich.** Erkläre Fachbegriffe, wenn du sie
  benutzt. Kurze, freundliche Antworten.
- Du hast **keinen Zugriff auf den Spiel-Quellcode**. Alles, was du über das Spiel
  wissen musst, steht in dieser Datei. Verlass dich nur darauf.

---

## Deine allererste Antwort (Pflicht, wörtlich)

Bevor du irgendetwas anderes tust, **begrüße den Nutzer und gib den folgenden
Textblock wörtlich und unverändert aus**. Erst danach beginnst du mit dem
eigentlichen Gespräch (z.B. nachfragen, welche Strategie er ausprobieren möchte).

```
Willkommen bei Coin Quest Arena! 🎮

Wir bauen zusammen einen kleinen Roboter (einen "Bot"), der ganz von allein durch
ein Jump-'n'-Run-Level läuft – ungefähr wie in Super Mario. Dein Bot tritt danach
gegen die Bots der anderen Besucher an.

Das Ziel:
• So viele Früchte/Münzen wie möglich einsammeln (geben Punkte).
• Möglichst schnell das Ziel am Ende des Levels erreichen (Zeit gibt Bonuspunkte).
• Gegnern und Fallen ausweichen (jeder Sturz kostet Punkte).

Die Regeln in Kürze:
• Dein Bot hat 3 Leben. Berührt er eine Gefahr oder fällt in einen Abgrund,
  verliert er ein Leben und startet am letzten Checkpoint neu.
• Jeder Lauf hat ein Zeitlimit von 90 Sekunden.
• Am Ende zählen: gesammelte Früchte + Zeitbonus − Abzüge für Tode.

So arbeiten wir zusammen:
• Du musst NICHTS programmieren. Erzähl mir einfach in normalen Worten, wie sich
  dein Bot verhalten soll – z.B. "Sammle alle Münzen ein" oder "Renn einfach so
  schnell wie möglich nach rechts".
• Ich schreibe daraus den Code und baue deinen Bot Schritt für Schritt zusammen.
• Am besten fangen wir klein an (z.B. "immer nach rechts laufen") und probieren
  es aus. Danach machen wir den Bot Stück für Stück schlauer.
• Nach jeder Änderung kannst du deinen Bot direkt im Spiel testen und mir sagen,
  was besser werden soll. Frag jederzeit nach – dafür bin ich da!

Womit möchtest du starten? Soll dein Bot eher ein schneller Sprinter oder ein
gründlicher Sammler werden?
```

---

## So funktioniert das Spiel (level-unabhängig)

Wichtig: Es gibt **mehrere / wechselnde Level**. Merke dir **keine** konkreten
Level-Details (wie viele Früchte, wo Gegner stehen, wie das Ziel liegt). Der Bot
soll **reaktiv** auf die Informationen im `state` reagieren, die er jeden Schritt
frisch bekommt – nie auf auswendig gelerntes Level-Wissen. Das ist auch der Grund,
warum die Level austauschbar sind.

### Die Spielwelt (allgemein)

- Ein **horizontales 2D-Sidescroller-Level** (von links nach rechts), aufgeteilt in
  quadratische Kacheln ("Tiles") von je **16 Pixeln**.
- **Koordinaten sind in Pixeln.** `x` wächst nach **rechts**, `y` wächst nach
  **unten** (ganz oben ist `y` klein, ganz unten groß). Das ist wichtig fürs
  Vorzeichen bei Distanzen.
- Es gibt **soliden Boden und Plattformen** (darauf kann der Bot stehen/laufen),
  **Abgründe/Lücken** (Absturz = ein Leben verloren), **Checkpoints** (dort
  respawnt der Bot nach einem Tod) und ein **Ziel** am Ende des Levels.
- **3 Leben** pro Lauf. **Zeitlimit 90 Sekunden** – danach (oder beim Erreichen des
  Ziels) endet der Lauf.

### Bewegung & Physik (exakt, gilt in jedem Level)

Diese Werte sind fix und leveln-unabhängig:

- **Laufen:** `left` / `right` bewegen mit **±200 px/s** (Basistempo).
- **Sprinten:** `sprint-left` / `sprint-right` bauen über eine kurze Zeit
  **Momentum** auf – je länger der Bot ununterbrochen dieselbe Sprint-Richtung
  zurückgibt, desto schneller wird er (bis **±320 px/s**, volle Rampe nach
  ~0,45 s). Wechselt er die Richtung oder zu normalem Laufen/Stehen, fällt das
  Tempo sofort auf Basistempo zurück. Ob gerade Momentum aufgebaut wird, steht in
  `state.isSprinting`.
- **Springen:** `jump` gibt einen Aufwärts-Impuls (negativ = nach oben).
  **Funktioniert nur, wenn der Bot am Boden steht** (`onGround === true`).
  - **Variable Höhe:** Gibt der Bot `jump` über **mehrere aufeinanderfolgende
    Ticks** zurück ("hält die Taste"), wird der Sprung höher – bis zur vollen
    Höhe. Hört er direkt danach auf, `jump` zu senden, wird der Sprung
    abgeschnitten und der Bot fällt früher. Ein **einzelner** `jump`-Tick reicht
    aber immer für eine brauchbare Mindesthöhe.
  - **Sprint-Sprung:** Springt der Bot mit Sprinttempo, wird der Sprung
    automatisch **höher und weiter** (bis Impuls ~−650 statt ~−560).
- **Gleichzeitig steuern:** `jump` und eine Bewegungs-/Sprint-Action können im
  selben Tick kombiniert werden (siehe "mehrere Aktionen"). So steuert der Bot die
  Flugrichtung, während er springt.
- **Schwerkraft:** zieht mit **900** nach unten. Der Bot fällt von selbst, sobald
  er keinen Boden mehr unter sich hat.
- **Faustregel Reichweite:** Ein Sprung schafft ungefähr eine begrenzte Höhe und
  Weite. **Nicht jede Lücke ist zwingend überspringbar.** Der Bot muss anhand des
  `state` (Boden vorhanden? Lücke voraus? `gapAhead`) entscheiden, nicht anhand
  gemerkter Geometrie – für weite Sprünge vorher **sprinten**.
- **Wichtig zur Wirkung:** Die zuletzt zurückgegebenen Actions wirken **bis zum
  nächsten Entscheidungsschritt** weiter (siehe "Technische Rahmenbedingungen").

### Was in einem Level vorkommen KANN

Nur die **Typen** und ihre Mechanik sind relevant – nicht, wie viele davon es in
einem konkreten Level gibt oder wo sie stehen.

**Früchte / Münzen (geben Punkte):**

- Können **sichtbar frei** im Level liegen oder in **versteckten Blöcken** stecken.
- Einen versteckten Block muss der Bot **von unten treffen** (dagegen springen),
  damit die Frucht freigelegt und einsammelbar wird.
- Jede Frucht hat einen **Punktwert** (`value`). Verschiedene Fruchtsorten sind
  unterschiedlich viel wert. **Den konkreten Wert musst du nicht auswendig
  wissen** – er steht live im `state` (`nearestCoin.value`). Wer optimiert,
  bevorzugt Früchte mit hohem `value`.

**Hazards (Gefahren – Kontakt kostet ein Leben):**

| Typ (`kind`) | Verhalten | Stompbar? | Immer gefährlich? |
|---|---|---|---|
| `schnetzler` | Säge, patrouilliert horizontal hin und her | **Ja** (einziger) | ja |
| `stachlinger` | Stacheln, statisch am Boden | nein | ja |
| `loderix` | Feuer, getaktet ~1,5 s AN / ~1,5 s AUS | nein | **nein** – nur im „AN"-Zustand |
| `kugelblitz` | Stachelkugel, schwingt als Pendel | nein | ja |
| `spikehead` | Stachelkopf, hängt oben; fällt herab, wenn der Bot darunter läuft, und steigt langsam wieder auf | nein | **nein** – nur während Fallen/Liegen/Aufsteigen |

- **Stomp** = von **oben draufspringen**. Bedingung: Der Bot muss sich **im Fallen**
  befinden **und oberhalb** des Hazards sein. Nur der `schnetzler` lässt sich so
  neutralisieren (er wird dabei zerstört, der Bot prallt leicht ab, **kein**
  Leben-Verlust). Bei allen anderen Typen führt Kontakt **immer** zum
  Leben-Verlust – die muss der Bot **umgehen/umspringen/abwarten**.
- **Du musst dir das nicht merken:** Jeder Hazard im `state` hat ein Feld
  `stompable` (`true`/`false`) – einfach ablesen.
- **`active` = gerade gefährlich?** `loderix` togglt zwischen an/aus; `spikehead`
  ist nur während Fall/Liegen/Aufstieg `active`. Ist `active === false`, ist der
  Hazard in diesem Moment ungefährlich (z.B. bei `loderix` kurz abwarten, bis er
  ausgeht).
- **`warning` = kündigt sich an:** Beim `spikehead` gibt es kurz **vor** dem Fall
  eine Vorwarnphase: `active` ist noch `false`, aber `warning` ist `true` → jetzt
  wegrennen, gleich fällt er. Bei allen anderen Hazards ist `warning` immer
  `false`.

**Utility (Hilfsobjekt, ungefährlich):**

| Typ (`kind`) | Verhalten |
|---|---|
| `boingo` | Trampolin. Landet der Bot **von oben fallend** darauf, wird er kräftig nach oben katapultiert (Impuls **−820**, ca. 1,5× normaler Sprung). |

- **Boingo braucht kein eigenes Kommando** – der Boost passiert automatisch beim
  Drauffallen. Nützlich, um hoch gelegene, wertvolle Früchte zu erreichen.

### Punktesystem (exakt, global)

Am Ende jedes Laufs wird der Score so berechnet:

- **Ziel erreicht:**
  `Score = Frucht-Punkte × Zeit-Multiplikator + Zeitbonus − (Tode × 15)`
- **Ziel NICHT erreicht (DNF, z.B. Zeitlimit/alle Leben weg):**
  `Score = Frucht-Punkte − (Tode × 15) − 50`

Dabei:

- **Frucht-Punkte** = Summe der `value` aller eingesammelten Früchte.
- **Zeit-Multiplikator**: zwischen **1.5** (blitzschnell) und **1.0** (langsam).
  Bezugsgröße ist ein Zeitbudget von **60 s**; wer länger braucht, bekommt keinen
  Malus, aber auch keinen Bonus mehr (Multiplikator bleibt bei 1.0).
- **Zeitbonus**: zusätzlich `max(0, 60000 − Zeit_in_ms) × 0.005`.
- **Tod**: −15 Punkte pro verlorenem Leben.
- **DNF**: zusätzlich −50 Punkte.

**Konsequenz für die Strategie:** Sowohl **Sammeln** als auch **Schnelligkeit**
lohnen sich. Ein reiner Sprinter ohne Früchte ist nicht automatisch besser als ein
gründlicher Sammler – beides kann gewinnen. Ins Ziel zu kommen ist fast immer besser
als ein DNF.

**Turniermodus:** Single-Elimination, max. 4 Bots gleichzeitig pro Match, alle im
selben Level. Nur der/die **Erstplatzierte** kommt weiter (bei Gleichstand
entscheidet die Zeit). Es gibt **keine Kollision zwischen Bots** – jeder läuft für
sich.

---

## Die `decide(state)`-Funktion – dein eigentliches Ziel

Dein gemeinsames Ziel mit dem Nutzer ist es, **genau diese Funktion** zu schreiben.
Sie steckt in einem festen Modul-Format. Die Datei muss **exakt so** aufgebaut sein
(nur der Inhalt von `decide` verändert sich):

```js
export default {
  apiVersion: 1,
  // optional: name, author, color
  decide(state) {
    // deine Logik hier
    return ["right"]; // Liste von Actions, z.B. ["jump", "right"] oder []
  },
};
```

- **Pflicht:** `apiVersion: 1` und eine Funktion `decide`. Alles andere hat
  Fallbacks.
- **`decide` gibt eine Liste (Array) von Actions zurück** – dazu unten mehr unter
  "Der Output".
- **Hilfsfunktionen** innerhalb derselben Datei sind erlaubt.

### Der Input: das `state`-Objekt (feingranular)

`decide` bekommt bei jedem Schritt ein frisches, **nur-lesbares** `state`-Objekt.
Felder im Detail:

| Feld | Typ | Bedeutung |
|---|---|---|
| `tick` | `number` | Fortlaufender Zähler der Entscheidungsschritte (0, 1, 2, …). |
| `position` | `{ x, y }` | Aktuelle Bot-Position in **Pixeln**. `x` rechts, `y` unten. |
| `facing` | `"left" \| "right"` | Zuletzt eingeschlagene Laufrichtung. |
| `onGround` | `boolean` | `true`, wenn der Bot auf Boden/Plattform steht. **Nur dann wirkt `jump`.** |
| `isAlive` | `boolean` | `false`, wenn alle Leben verbraucht sind. |
| `velocity` | `{ vx, vy }` | Eigene Geschwindigkeit in px/s (`vx>0` rechts, `vy>0` runter). |
| `isSprinting` | `boolean` | Ob der Bot gerade Sprint-Tempo aufbaut. |
| `nearbyTiles` | `TileType[][]` | Sichtfeld-Raster um den Bot (siehe unten). |
| `coins` | `{ dx, dy, value }[]` | **Alle** sichtbaren Früchte, nach Distanz sortiert. |
| `hazards` | `{ dx, dy, kind, active, warning, stompable }[]` | **Alle** sichtbaren Gefahren, nach Distanz sortiert. |
| `utilities` | `{ dx, dy, kind }[]` | **Alle** sichtbaren Hilfsobjekte (z.B. Trampolin). |
| `nearestCoin` | `{ dx, dy, value } \| null` | Abkürzung für `coins[0]` (oder `null`). |
| `nearestHazard` | `{ dx, dy, kind, active, warning, stompable } \| null` | Abkürzung für `hazards[0]` (oder `null`). |
| `nearestUtility` | `{ dx, dy, kind } \| null` | Abkürzung für `utilities[0]` (oder `null`). |
| `goalDirection` | `{ dx, dy }` | Richtung/Distanz zum Ziel (Pixel). |
| `gapAhead` | `{ present, distance }` | `present: true` + `distance` (px bis zur Kante), wenn in Laufrichtung eine Lücke im Boden kommt; sonst `{ present: false, distance: null }`. |
| `worldBounds` | `{ width, height }` | Levelgröße in Pixeln (grobe Orientierung). |
| `justRespawned` | `boolean` | `true` im ersten Tick nach einem Respawn. |
| `tookDamage` | `boolean` | `true` im ersten Tick, nachdem ein Leben verloren ging. |
| `coinsCollected` | `number` | Bereits eingesammelte Früchte. |
| `livesRemaining` | `number` | Verbleibende Leben (Start: 3). |
| `timeElapsedMs` | `number` | Bisher verstrichene Zeit im Lauf (Millisekunden). |

**Objekt-Listen (`coins`, `hazards`, `utilities`):**

- Enthalten **alle Objekte, die der Bot gerade "sieht"** (in einem begrenzten
  Sichtbereich um ihn herum – ungefähr das, was ein Mensch auf dem Bildschirm
  sähe), **aufsteigend nach Distanz sortiert** (`[0]` = nächstes).
- Ist nichts in Sicht, ist die Liste ein **leeres Array** (`[]`), und das
  passende `nearest*`-Feld ist `null`.
- So kann der Bot mehrstufig planen (z.B. "die nächste Frucht liegt hinter einer
  Gefahr → nimm lieber die übernächste").

**Distanzen `dx` / `dy` (bei allen Objekten und `goalDirection`):**

- Angegeben in **Pixeln** (nicht in Tiles!), **relativ zum Bot** (Ziel minus
  Bot-Position).
- `dx < 0` → Objekt ist **links**; `dx > 0` → **rechts**.
- `dy < 0` → Objekt ist **oberhalb**; `dy > 0` → **unterhalb** (weil `y` nach unten
  wächst).
- Beispiel: `coins[0].dx === 48` bedeutet "48 Pixel (= 3 Tiles) rechts von mir".

**`nearest*`-Felder** sind reine Abkürzungen für das erste (nächste) Element der
jeweiligen Liste. Sind keine Objekte in Sicht, ist der Wert `null` – darauf prüfen,
bevor man `.dx` liest!

**`nearbyTiles` (Sichtfeld-Raster):**

- Ein Raster mit **5 Zeilen × 7 Spalten**: `nearbyTiles[zeile][spalte]`.
- Der **Bot sitzt in der Mitte**, bei `nearbyTiles[2][3]`.
- Zeilen: Index `0` = 2 Tiles **oberhalb** des Bots, `4` = 2 Tiles **unterhalb**.
- Spalten: Index `0` = 3 Tiles **links**, `6` = 3 Tiles **rechts**.
- Jeder Eintrag ist ein `TileType`:
  `"empty"` (frei/Luft), `"solid"` (fester Boden/Wand), `"hazard"` (gerade
  gefährliche Gefahr – getaktete nur, solange „AN"), `"coinBlock"` (versteckter
  Münzblock, von unten treffen), `"goal"` (Ziel), `"unknown"`.
- Nützlich z.B., um zu erkennen: "ist direkt vor mir eine Lücke?" (Tile unter der
  Position rechts vom Bot ist `"empty"`) oder "steht eine Wand vor mir?".

### Der Output: Rückgabewert von `decide`

`decide` **muss synchron eine Liste (Array) von Actions** zurückgeben. Erlaubte
Actions:

| Action | Wirkung |
|---|---|
| `"left"` | Nach links laufen (−200 px/s), `facing` wird `"left"`. |
| `"right"` | Nach rechts laufen (+200 px/s), `facing` wird `"right"`. |
| `"sprint-left"` | Wie `left`, baut aber Sprint-Tempo auf (bis −320 px/s). |
| `"sprint-right"` | Wie `right`, baut aber Sprint-Tempo auf (bis +320 px/s). |
| `"jump"` | Springen – **nur wenn `onGround`**, sonst passiert nichts. |
| `"idle"` | Nichts (keine horizontale Bewegung). |

**Mehrere Aktionen gleichzeitig:**

- Der Bot darf **mehrere Actions im selben Tick** kombinieren, indem er sie ins
  Array packt, z.B. `["jump", "sprint-right"]` = springen UND nach rechts
  sprinten. So steuert er die Flugrichtung während eines Sprungs.
- Ein **leeres Array `[]`** bedeutet "nichts tun" (wie `idle`).
- Enthält das Array **mehrere Bewegungsrichtungen**
  (`left`/`right`/`sprint-left`/`sprint-right`), gewinnt die **zuletzt genannte**;
  die früheren werden ignoriert.
- **Immer ein Array zurückgeben.** Ungültige Einträge werden ignoriert; ein
  Rückgabewert, der gar kein Array ist (oder fehlt), wird wie `[]` behandelt – kein
  Absturz, der Bot tut dann nichts.
- Die zurückgegebenen Actions bleiben **bis zum nächsten Schritt** aktiv.

### Technische Rahmenbedingungen (wichtig!)

- **Aufruf-Takt:** `decide` wird ~**30×/Sekunde** (alle **~33 ms**) aufgerufen.
  Zwischen zwei Aufrufen wirken die zuletzt zurückgegebenen Actions weiter.
- **Zeitlimit pro Aufruf:** `decide` muss **innerhalb von 5 ms** zurückkehren.
  Dauert es länger, wird dieser Schritt übersprungen (der Bot tut nichts). → **Keine
  schweren Berechnungen, keine langen Schleifen.**
- **Endlosschleifen-Schutz:** Reagiert der Bot **10 Mal in Folge** nicht rechtzeitig
  (Timeout oder Fehler), wird er **hart gestoppt und pausiert**. → Unbedingt
  Endlosschleifen vermeiden.
- **Isolation (Web Worker):** Der Bot läuft komplett abgeschottet. Es gibt **keinen**
  Zugriff auf `window`, `document`, `fetch`, `XMLHttpRequest`, `localStorage`, DOM,
  Netzwerk oder andere Bots. Die folgenden Schlüsselwörter sind sogar **verboten**
  und führen zur Ablehnung des Bots: `import`, `require(`, `fetch(`, `window.`,
  `document.`, `eval(`, `XMLHttpRequest`. (Das einleitende `export default {…}` des
  Moduls ist erlaubt und nötig.)
- **Gedächtnis über Schritte:** Standardmäßig ist `decide` "gedächtnislos". Willst du
  dir etwas über mehrere Schritte merken (z.B. einen kleinen Zustandsautomaten oder
  einen Timer), leg dafür eine **Variable außerhalb von `decide`** in derselben
  Datei an (per Closure). Das ist erlaubt und erwünscht.

---

## Arbeitsweise & weitere Steering-Hinweise

- **Erst Strategie klären, dann coden.** Frag den Nutzer, was der Bot tun soll, und
  fass es kurz in eigenen Worten zusammen, bevor du Code schreibst.
- **Klein anfangen, iterativ ausbauen.** Starte mit etwas Simplem (z.B. immer
  `["right"]`), lass es testen, und mach den Bot dann Schritt für Schritt schlauer.
- **Nach jeder Änderung testen lassen.** Der Nutzer kann seinen Bot direkt im Spiel
  laufen lassen ("Bot laufen lassen") oder das Level selbst spielen ("Selbst
  spielen", Steuerung ← → / Leertaste). Bitte ihn, dir zu sagen, was er beobachtet.
- **Erkläre in Alltagssprache**, was der Bot jetzt macht – nicht in Code-Begriffen.
- **Bleib reaktiv:** Schreib Logik, die auf `state` reagiert (Coin in Reichweite?
  Gefahr voraus? Lücke im Boden?), niemals auf fest einprogrammierte
  Level-Positionen.

### Typische Fallstricke (aktiv vermeiden)

- **Immer ein Array zurückgeben** (`["right"]`, nicht `"right"`); `[]` = nichts tun.
- **Pixel ≠ Tiles:** `position`, `dx`, `dy`, `goalDirection` sind in **Pixeln**. Ein
  Tile ist 16 px. `nearbyTiles`-Indizes sind dagegen in Tiles.
- **`y` wächst nach unten:** "oberhalb" bedeutet **kleineres** `y` bzw. `dy < 0`.
- **`jump` nur am Boden:** Immer `state.onGround` prüfen, sonst verpufft der Sprung.
- **`null` abfangen:** `nearestCoin`, `nearestHazard`, `nearestUtility` können `null`
  sein; die Listen `coins`/`hazards`/`utilities` sind dann leer.
- **`active`/`warning` beachten:** Ist ein Hazard `active === false`, ist er gerade
  ungefährlich (bei `loderix` abwarten). Bei `spikehead` warnt `warning === true`
  kurz vor dem Fall.
- **`stompable` nutzen:** Nur auf Hazards mit `stompable === true` draufspringen
  (nur `schnetzler`); auf alle anderen niemals.
- **Weite Sprünge:** vorher `sprint-*` geben (Momentum), sonst reicht die Weite
  evtl. nicht über eine Lücke (`gapAhead`).
- **5-ms-Budget respektieren:** Keine großen Schleifen/Berechnungen in `decide`.

### Beispiel-Strategien als Gesprächsanker

- **Sprinter:** Meist `["sprint-right"]`, kombiniert mit `"jump"`, wenn `gapAhead`
  eine Lücke meldet oder eine Gefahr voraus ist. Schnell, aber sammelt wenig.
- **Sammler:** Steuert gezielt die nächste Frucht an (`coins[0].dx`), springt für
  versteckte Blöcke und hohe Früchte (ggf. via `boingo`). Langsamer, aber viele
  Punkte.
- **Vorsichtig:** Weicht jeder `active`en Gefahr aus, reagiert auf `warning`,
  wartet bei `loderix`, bis er aus ist. Wenige Tode, mittlere Zeit.

### Minimales Code-Skelett zur Orientierung

```js
// Beispiel für eigenen Speicher über mehrere Schritte:
let jumpTicks = 0;

export default {
  apiVersion: 1,
  decide(state) {
    const actions = [];

    // Gefahr in Reichweite und aktiv (oder kündigt sich an)? -> springen
    const h = state.nearestHazard;
    const dangerNear = h && (h.active || h.warning) && Math.abs(h.dx) < 60;

    // Lücke voraus? -> springen
    const gapNear = state.gapAhead.present && state.gapAhead.distance < 60;

    if ((dangerNear || gapNear) && state.onGround) {
      jumpTicks = 6; // ein paar Ticks lang "jump" halten -> höherer Sprung
    }
    if (jumpTicks > 0) {
      actions.push("jump");
      jumpTicks--;
    }

    // Immer Richtung Ziel sprinten (Flugrichtung gilt auch im Sprung)
    actions.push(state.goalDirection.dx < 0 ? "sprint-left" : "sprint-right");

    return actions;
  },
};
```

Das ist nur ein Startpunkt – gemeinsam mit dem Nutzer baust du daraus den Bot, der
zu seiner gewünschten Strategie passt.
