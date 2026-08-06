# Requirements: bot-state-vision

## Kontext

Bezug zu `docs/02-bot-api.md` (State/Action-Contract) und
`docs/08-hazards-und-utilities.md` (Hazard-Sichtbarkeit im State). Der aktuelle
`BotState` (`packages/bot-contract/src/state.ts`) reicht dem Bot pro Tick nur
jeweils **das nächstgelegene** Objekt (`nearestCoin`/`nearestHazard`/
`nearestUtility`) durch. Der Bot "sieht" damit deutlich weniger als ein Mensch,
der den ganzen Bildschirmausschnitt überblickt, und kann keine mehrstufigen
Entscheidungen treffen (z.B. "übernächste Münze anpeilen, wenn die nächste hinter
einer Gefahr liegt").

Ziel dieses Features: Der Bot soll **das sehen, was der Spieler auf dem Bildschirm
sieht** – alle aktuell sichtbaren Coins, Hazards und Utilities im Sichtbereich –
und zusätzliche, **fertig aufbereitete** Sensordaten bekommen, damit sich einfache
`decide`-Funktionen bauen lassen. Leitprinzip: **so einfach wie möglich für den
Bot** (KISS), keine Roh-Daten, die der Bot selbst nachrechnen muss.

Dieses Feature berücksichtigt außerdem die zwischenzeitlich gemergten Änderungen
(`.features/movement-sprint-and-variable-jump/`, `.features/level-two-kaizo/`):
Sprint-Actions, variable Sprunghöhe und den neuen Trigger-Hazard `spikehead` mit
Vorwarnphase.

Zusätzlich wird der **Action-Contract** erweitert: Ein Bot soll **mehrere
Aktionen gleichzeitig** ausführen dürfen (z.B. springen und dabei die Flugrichtung
steuern), und die **Entscheidungsfrequenz** wird von 150 ms (~6,7 Hz) auf **33 ms
(30 Hz)** erhöht, damit die Steuerung feingranular und reaktionsschnell ist.

## User Stories

### US-1: Vollständige Sicht auf sichtbare Objekte

Als Bot-Autor möchte ich pro Tick **alle** aktuell sichtbaren Coins, Hazards und
Utilities im Sichtbereich als Liste bekommen, damit ich mehrstufige Strategien
bauen kann und nicht auf das jeweils nächstgelegene Objekt beschränkt bin.

Akzeptanzkriterien:
- WHEN `decide(state)` aufgerufen wird SHALL DAS SYSTEM in `state.coins`,
  `state.hazards` und `state.utilities` je eine Liste aller im Sichtbereich
  befindlichen Objekte der jeweiligen Art bereitstellen.
- WHEN sich im Sichtbereich kein Objekt einer Art befindet SHALL DAS SYSTEM die
  entsprechende Liste als leeres Array (`[]`) bereitstellen (nie `null`/`undefined`).
- WHEN eine Objekt-Liste befüllt wird SHALL DAS SYSTEM die Elemente **aufsteigend
  nach euklidischer Distanz** zum Bot sortieren (`[0]` = nächstes Objekt).
- WHEN ein Objekt in einer Liste beschrieben wird SHALL DAS SYSTEM dessen Position
  als `dx`/`dy` in **Pixeln relativ zum Bot** angeben (`Objekt − Bot`; `dx < 0` =
  links, `dy < 0` = oberhalb).

### US-2: Sichtbereich entspricht dem des Spielers

Als Turnier-Verantwortlicher möchte ich, dass der Bot nur Objekte "sieht", die
auch für einen Menschen auf dem Bildschirm sichtbar wären, damit kein Bot durch
Level-Weitsicht unfair im Vorteil ist.

Akzeptanzkriterien:
- WHEN ein Objekt weiter als der definierte Sichtradius vom Bot entfernt ist SHALL
  DAS SYSTEM es NICHT in `coins`/`hazards`/`utilities` aufnehmen.
- WHEN ein Objekt innerhalb des Sichtradius liegt SHALL DAS SYSTEM es in die
  jeweilige Liste aufnehmen.
- WHEN der Sichtradius angewendet wird SHALL DAS SYSTEM denselben Radius für Coins,
  Hazards und Utilities verwenden (einheitliche, konsistente Sicht).

### US-3: Bequeme "nearest"-Shortcuts bleiben erhalten

Als Autor eines einfachen Einsteiger-Bots möchte ich weiterhin direkt auf das
nächstgelegene Objekt zugreifen können, ohne selbst über Listen iterieren zu
müssen, damit triviale Bots minimal bleiben.

Akzeptanzkriterien:
- WHEN `state` gebaut wird SHALL DAS SYSTEM `nearestCoin`, `nearestHazard` und
  `nearestUtility` weiterhin bereitstellen.
- WHEN die zugehörige Liste nicht leer ist SHALL DAS SYSTEM `nearest*` exakt auf
  deren erstes (nächstes) Element setzen.
- WHEN die zugehörige Liste leer ist SHALL DAS SYSTEM das jeweilige `nearest*`-Feld
  auf `null` setzen.

### US-4: Vorberechnete Gefahren-Hinweise (warning, stompable)

Als Bot-Autor möchte ich pro Hazard direkt ablesen können, ob er gleich gefährlich
wird und ob ich ihn durch Draufspringen neutralisieren darf, ohne die Spielregeln
selbst kennen zu müssen.

Akzeptanzkriterien:
- WHEN ein Hazard vom Typ `spikehead` sich in seiner Vorwarnphase befindet (kurz
  bevor er herabfällt) SHALL DAS SYSTEM für diesen Hazard `warning: true` und
  `active: false` melden.
- WHEN ein Hazard nicht in einer Vorwarnphase ist SHALL DAS SYSTEM `warning: false`
  melden.
- WHEN ein Hazard beschrieben wird SHALL DAS SYSTEM ein Feld `stompable` liefern,
  das genau dann `true` ist, wenn dieser Hazard-Typ durch Draufspringen
  neutralisiert werden kann (aktuell nur `schnetzler`).
- WHEN ein Hazard gerade aktiv gefährlich ist SHALL DAS SYSTEM `active: true`
  melden (unverändertes bestehendes Verhalten, inkl. getaktetem `loderix` und
  fallendem/liegendem/aufsteigendem `spikehead`).

### US-5: Eigene Bewegungsdaten (velocity, isSprinting)

Als Bot-Autor möchte ich meine aktuelle Geschwindigkeit und ob ich gerade
Sprint-Momentum aufbaue kennen, damit ich Sprünge und Sprint-Strategien
zuverlässig timen kann.

Akzeptanzkriterien:
- WHEN `state` gebaut wird SHALL DAS SYSTEM `velocity` mit `vx`/`vy` (Pixel pro
  Sekunde, Vorzeichen wie bei Position: `vx > 0` = nach rechts, `vy > 0` = nach
  unten) bereitstellen.
- WHEN der Bot im aktuellen Tick Sprint-Momentum aufbaut SHALL DAS SYSTEM
  `isSprinting: true` melden, sonst `false`.

### US-6: Abgrund-Erkennung (gapAhead)

Als Bot-Autor möchte ich ohne Tile-Parsing wissen, ob in Laufrichtung eine Lücke
im Boden kommt, damit ich rechtzeitig springen kann.

Akzeptanzkriterien:
- WHEN in Blickrichtung (`facing`) innerhalb des Sichtbereichs eine Bodenlücke
  (Abgrund) vorhanden ist SHALL DAS SYSTEM `gapAhead.present: true` und
  `gapAhead.distance` als horizontale Pixel-Distanz bis zur Lückenkante melden.
- WHEN in Blickrichtung innerhalb des Sichtbereichs keine Lücke vorhanden ist SHALL
  DAS SYSTEM `gapAhead.present: false` und `gapAhead.distance: null` melden.

### US-7: Orientierungs- und Ereignisdaten (worldBounds, justRespawned, tookDamage)

Als Bot-Autor möchte ich grob wissen, wie groß das Level ist und ob gerade ein
einschneidendes Ereignis passiert ist, damit ich Endspurt- bzw.
Erholungs-Verhalten bauen kann.

Akzeptanzkriterien:
- WHEN `state` gebaut wird SHALL DAS SYSTEM `worldBounds` mit `width`/`height` des
  Levels (in Pixeln) bereitstellen.
- WHEN der Bot seit dem vorherigen Tick an einem Checkpoint respawnt ist SHALL DAS
  SYSTEM im aktuellen Tick `justRespawned: true` melden, sonst `false`.
- WHEN der Bot seit dem vorherigen Tick ein Leben verloren hat SHALL DAS SYSTEM im
  aktuellen Tick `tookDamage: true` melden, sonst `false`.

### US-8: Contract, Referenz und Doku sind konsistent

Als Bot-Autor (bzw. der devkcode-Agent) möchte ich, dass die Referenz-Dokumentation
den tatsächlichen State exakt beschreibt, damit ich keine falschen Annahmen treffe.

Akzeptanzkriterien:
- WHEN das Feature abgeschlossen ist SHALL DAS SYSTEM `client/src/bot/AGENTS.md`,
  `client/src/bot/current-bot.template.js`, `docs/02-bot-api.md` und
  `docs/08-hazards-und-utilities.md` an den finalen State/Actions/Hazards angleichen
  (inkl. 6 Actions, **Array-Rückgabe / Multi-Action**, **30-Hz-Frequenz**,
  Sprint/variable Sprunghöhe, `spikehead`, neue State-Felder).
- WHEN die Doku die Positions-/Distanzeinheiten beschreibt SHALL DAS SYSTEM
  durchgängig **Pixel** (nicht Tiles) für `position`/`dx`/`dy`/`goalDirection`
  angeben.

### US-9: Mehrere gleichzeitige Aktionen pro Tick

Als Bot-Autor möchte ich pro Entscheidung mehrere Aktionen gleichzeitig ausführen
(z.B. `jump` und `right` zusammen), damit der Bot in der Luft die Flugrichtung
steuern oder springend sprinten kann.

Akzeptanzkriterien:
- WHEN `decide(state)` aufgerufen wird SHALL DAS SYSTEM eine **Liste** von Actions
  (`Action[]`) als Rückgabewert erwarten.
- WHEN `decide` ein Array mit mehreren Actions zurückgibt SHALL DAS SYSTEM alle
  darin enthaltenen, nicht widersprüchlichen Actions im selben Tick anwenden (z.B.
  `["jump", "sprint-right"]` = springen UND nach rechts sprinten).
- WHEN das zurückgegebene Array mehrere horizontale Bewegungs-Actions enthält
  (`left`/`right`/`sprint-left`/`sprint-right`) SHALL DAS SYSTEM die **zuletzt
  genannte** anwenden und die früheren ignorieren.
- WHEN das zurückgegebene Array ein leeres Array (`[]`) ist SHALL DAS SYSTEM den
  Bot in diesem Tick nichts tun lassen (entspricht bisherigem `idle`).
- WHEN der Rückgabewert kein Array ist, `null`/`undefined` ist oder Elemente
  enthält, die keine gültige Action sind SHALL DAS SYSTEM fehlertolerant reagieren:
  ungültige Elemente werden ignoriert; ein vollständig ungültiger Rückgabewert wird
  wie `[]` behandelt (kein Absturz, kein harter Disqualifikations-Effekt).
- WHEN `decide` wiederholt (z.B. 10× in Folge) einen Fehler wirft oder das
  Zeitlimit überschreitet SHALL DAS SYSTEM das bestehende Fehlertoleranz-Verhalten
  (Pausieren/Worker-Kill) unverändert beibehalten.

### US-10: Entscheidungsfrequenz 30 Hz

Als Bot-Autor möchte ich, dass `decide` häufig genug aufgerufen wird, um flüssig
und präzise steuern zu können.

Akzeptanzkriterien:
- WHEN die Simulation läuft SHALL DAS SYSTEM `decide(state)` etwa alle **33 ms
  (30 Hz)** aufrufen (statt bisher 150 ms).
- WHEN die Frequenz erhöht wird SHALL DAS SYSTEM das Performance-Zeitlimit pro
  `decide`-Aufruf (5 ms) und die Fehlertoleranz-Schwellen unverändert lassen (5 ms
  bleiben komfortabel innerhalb von 33 ms).

## Nicht-Ziele

- Keine Informationen über **andere Bots** (bleibt bewusst außen vor, keine
  Bot-Interaktion – siehe `docs/02`).
- Keine Vorhersage-/Simulations-API (z.B. "wo ist Hazard X in N ms"): Der Bot
  bekommt nur den aktuellen Zustand plus `warning` als einfaches Vorwarn-Signal.
- Kein `warningMsLeft`/Rest-Timer o.ä. (YAGNI) – `warning` als Boolean genügt für
  "jetzt ausweichen".
- Keine Änderung der Spielphysik, des Scorings oder der Action-**Semantik** (die
  einzelnen Actions wirken wie bisher; neu ist nur, dass mehrere pro Tick
  kombiniert werden dürfen).
- Keine neuen Action-**Typen** (kein "duck", "shoot" o.ä.) – nur die
  Kombinierbarkeit der bestehenden 6 Actions.
- Kein neues Level, keine neuen Hazard-Typen.
- Keine Vergrößerung/Änderung von `nearbyTiles` (bleibt 7×5 wie bisher).

## Offene Fragen

- Konkreter Wert des Sichtradius in Pixeln (Kalibrierung gegen die reale
  Kamera-/Grid-Zellenbreite) → Detail für `design.md`.
- `gapAhead.distance`: Distanz bis zur **Kante der aktuellen Plattform** vs. bis
  zum Wieder-Auftauchen von Boden → Detail für `design.md` (Default-Annahme:
  Distanz bis zur Kante, ab der kein Boden mehr unter dem Bot ist).
- Ob `nearbyTiles` bei `spikehead` in `warning` bereits als `"hazard"` erscheinen
  soll (aktuell: nur wenn `active`) → in `design.md` klären; Tendenz: unverändert
  lassen, `warning` nur über die Hazard-Liste.
