# Requirements: bot-toolkit

## Kontext

Bezug: `docs/02-bot-api.md` (State/Action-Contract), `docs/08-hazards-und-utilities.md`
(Hazards/Utilities), `client/src/bot/AGENTS.md` (Steering für das devkcode-Bot-Profil).

Nach ersten Playtests am Stand: Der Wunsch ist **kein** neuer Mechanismus (keine
`decide(state, helpers)`-Signatur, keine Sandbox-Injektion), sondern zwei additive
Dinge:

1. Der `BotState`-Contract bekommt ein paar zusätzliche, präzise Felder, die heute
   fehlen, damit ein Bot seine eigene Trajektorie und die Level-Geometrie exakt
   nachrechnen kann.
2. `client/src/bot/current-bot.template.js` bekommt zusätzliche **named exports**
   (reine Hilfsfunktionen neben dem `export default`), die auf diesen State-Feldern
   aufbauen — insbesondere eine Funktion, die aus aktueller Position/Velocity/Aktion
   die künftige Flugbahn und Landeposition berechnet (`calcLandingCoords`).

Der Worker liest ausschließlich `mod.default` (`client/src/sandbox/botWorker.ts:24-31`);
zusätzliche named exports in derselben Datei sind für Guard/Worker unsichtbar und
harmlos, machen die Helfer aber isoliert mit Vitest testbar und für devkcode als
Referenzcode direkt im Blick.

Ausdrücklich **kein** Ziel dieses Specs: konkrete Bot-Strategien, Persönlichkeits-
Vorlagen, Änderungen an Guard/Worker/`BotRunner`, Änderung von `apiVersion` (bleibt 1).

## Vorarbeit: Physik-Fakten (verifiziert im Code)

Diese Werte/Verhalten sind die Referenz, an der jede neue Helferfunktion (v.a.
`predictPath`/`calcLandingCoords`) sich messen lassen muss:

- Gravity `900` (aktuell nur Literal in `client/src/game/ArenaView.tsx:85`, in vier
  Level-Dateien nur als Kommentar dupliziert – **muss zuerst nach
  `MOVEMENT_TUNING` hochgezogen werden**, bevor sie Teil von `state.tuning` sein
  kann).
- `MOVEMENT_TUNING` (`client/src/game/movement/movement.ts:7-20`): `BASE_MOVE_SPEED
  200`, `SPRINT_MOVE_SPEED 320`, `SPRINT_RAMP_MS 450`, `BASE_JUMP_VELOCITY -560`,
  `SPRINT_JUMP_VELOCITY -650`, `MIN_JUMP_HOLD_MS 180`.
- Bot-Hitbox `24×32` px (`client/src/game/scenes/RaceScene.ts:200`) – heute im
  State nicht vorhanden, aber nötig, um Kantenabstand korrekt zu berechnen.
- `applyMovement`/`applyJumpOnly` (`RaceScene.ts:475-524`):
  - `dir === 0` → `vx` wird **sofort** auf `0` gesetzt (`:488`). "Nichts ändern"
    heißt für die Simulation: dieselbe Richtungs-Action wird in jedem
    Simulationsschritt weiter angenommen, nicht `dir = 0`.
  - Sprungimpuls beim Absprung aus dem Stand rechnet mit `Math.abs(vx) ||
    BASE_MOVE_SPEED` (`:511`) – bei `vx === 0` wird also mit `200`, nicht `0`
    gerechnet.
  - Variable Sprunghöhe: Wird `jump` nicht mehr gehalten UND
    `msSinceJumpStart >= MIN_JUMP_HOLD_MS`, wird `vy` **hart auf `0`** gesetzt
    (`:518-523`, `shouldCutJump` in `movement.ts:74-81`) – kein sanftes
    Abbremsen.
- Level-Geometrie ist **kein Raster**, sondern eine Liste von Rechtecken
  (`client/src/game/level/types.ts:8-16` `PlatformDef { x, y, tilesWide, kind }`).
  `isSolidAt` (`client/src/game/level/tiles.ts:78-88`) prüft nur eine exakte
  Tile-Zeile pro Plattform (`row === platformRow`).
- **`hiddenCoinBlocks` sind vollwertige solide Collider**, kein reines
  `nearbyTiles`-Konzept: eigene `Phaser.Physics.Arcade.StaticGroup`
  (`client/src/game/world/worldBuilder.ts:219-242`, Body `28×24` px) mit
  eigenem `physics.add.collider(this.player, this.world.blocks, …)`
  (`client/src/game/scenes/RaceScene.ts:206`) – der Bot kann von allen vier
  Seiten dagegenstoßen, nicht nur von unten. Für die Trajektorie-Geometrie
  zählen sie daher wie Plattformen, nur mit Zusatzverhalten ("von unten
  treffen → wird zur Münze") und eigener Body-Größe statt Tile-Raster.

## User Stories

### US-1: Physik-Konstanten hochziehen

Als Entwickler möchte ich, dass `gravity` eine benannte Konstante in
`MOVEMENT_TUNING` ist, damit sie konsistent im State exponiert werden kann.

Akzeptanzkriterien:
- WHEN `MOVEMENT_TUNING` importiert wird SHALL DAS SYSTEM ein Feld `GRAVITY_Y:
  900` bereitstellen.
- WHEN `ArenaView.tsx` die Arcade-Physik konfiguriert SHALL DAS SYSTEM
  `MOVEMENT_TUNING.GRAVITY_Y` verwenden statt des Literals `900`.
- WHEN ein bestehender Test auf den alten Wert `900` prüft SHALL DAS SYSTEM
  weiterhin denselben numerischen Wert liefern (reines Hochziehen, kein
  Verhaltensunterschied).

### US-2: Sichtbare Terrain-Geometrie im State

Als Bot-Autor (bzw. dessen devkcode-Agent) möchte ich exakte, nicht gerasterte
Geometrie aller solide kollidierenden Objekte in Sichtweite, damit ich eine
Flugbahn/Landung geometrisch korrekt berechnen kann.

Akzeptanzkriterien:
- WHEN der State für einen Tick gebaut wird SHALL DAS SYSTEM ein Feld
  `platforms: VisiblePlatform[]` bereitstellen mit `{ dx, dy, width, height,
  kind }`, wobei `dx`/`dy` die linke obere Ecke relativ zum Bot sind (Pixel),
  `width`/`height` die Ausdehnung in Pixeln sind und `kind` einer von
  `"ground" | "float" | "ceiling" | "block"` ist.
- WHEN eine Plattform (`PlatformDef`) den Sichtradius des Bots schneidet SHALL
  DAS SYSTEM sie **vollständig** (nicht am Sichtradius abgeschnitten) in
  `platforms` aufnehmen, damit keine falschen Kanten entstehen.
- WHEN ein `hiddenCoinBlocks`-Eintrag noch nicht aufgelöst ist und den
  Sichtradius schneidet SHALL DAS SYSTEM ihn ebenfalls als Eintrag mit
  `kind: "block"` und der tatsächlichen Collider-Größe (28×24 px, ggf. skaliert)
  in `platforms` aufnehmen.
- WHEN ein `hiddenCoinBlocks`-Eintrag bereits aufgelöst ist (`resolvedBlockIds`)
  SHALL DAS SYSTEM ihn NICHT mehr in `platforms` aufnehmen (er ist dann
  passierbar).
- WHEN `platforms` befüllt wird SHALL DAS SYSTEM `nearbyTiles` unverändert
  weiterhin liefern (kein Breaking Change, reine Ergänzung).

### US-3: Physik-Tuning im State

Als Bot-Autor möchte ich alle bewegungsrelevanten Konstanten und die eigene
Hitbox-Größe im State sehen, damit ich Trajektorien ohne geratene Zahlen
berechnen kann.

Akzeptanzkriterien:
- WHEN der State gebaut wird SHALL DAS SYSTEM ein Feld `tuning` bereitstellen
  mit `{ gravity, tileSize, tickMs, baseMoveSpeed, sprintMoveSpeed,
  sprintRampMs, baseJumpVelocity, sprintJumpVelocity, minJumpHoldMs, botWidth,
  botHeight }`.
- WHEN sich einer der zugrunde liegenden Werte in `MOVEMENT_TUNING`/`TILE_SIZE`/
  Bot-Body-Größe ändert SHALL DAS SYSTEM automatisch den neuen Wert in
  `state.tuning` widerspiegeln (keine duplizierten Literale).
- WHEN der Bot gerade sprintet SHALL DAS SYSTEM zusätzlich
  `sprintRampProgress: number` (0..1) im State liefern, damit die aktuelle
  horizontale Geschwindigkeit für die nächsten Ticks vorhersagbar ist
  (`isSprinting` allein reicht dafür nicht, da boolean).

### US-4: `predictPath` – reine Trajektorien-Simulation

Als Bot-Autor möchte ich eine Funktion, die mir für eine angenommene
Aktionsfolge die zukünftige Bahn (Positionen/Geschwindigkeiten über die Zeit)
liefert, damit ich Sprünge/Landungen im Voraus einschätzen kann.

Akzeptanzkriterien:
- WHEN `predictPath(state, { dir, sprint, jump, holdJumpTicks, maxTicks })`
  aufgerufen wird SHALL DAS SYSTEM ein Array `{ dx, dy, vx, vy, ticks }[]`
  zurückgeben, das die Bewegung ab der aktuellen Position simuliert.
- WHEN `dir === 0` über mehrere Simulationsschritte angenommen wird SHALL DAS
  SYSTEM `vx` sofort auf `0` setzen (Nachbildung von `RaceScene.ts:488`), NICHT
  exponentiell abbremsen.
- WHEN ein Sprung aus `vx === 0` simuliert wird SHALL DAS SYSTEM den
  Sprungimpuls so berechnen, als läge die aktuelle Geschwindigkeit bei
  `baseMoveSpeed` (Nachbildung von `RaceScene.ts:511`).
- WHEN `holdJumpTicks` erreicht ist und `msSinceJumpStart >= minJumpHoldMs`
  SHALL DAS SYSTEM `vy` in diesem Simulationsschritt hart auf `0` setzen
  (Nachbildung von `shouldCutJump`), nicht sanft interpolieren.
- WHEN die simulierte Bahn eine solide Fläche aus `state.platforms` schneidet
  SHALL DAS SYSTEM die Simulation an diesem Punkt beenden (Kollision), unter
  Berücksichtigung der Bot-Breite/-Höhe aus `state.tuning`.
- WHEN dieselbe Aktionsfolge in einem Referenztest gegen die echte
  `RaceScene`-Physik gefahren wird SHALL DAS SYSTEM Positionen innerhalb einer
  im Design festgelegten Toleranz (z.B. ±4 px nach 1 Sekunde Flugzeit) liefern.

### US-5: `calcLandingCoords` und darauf aufbauende Trajektorie-Helfer

Als Bot-Autor möchte ich direkt abfragen können, wo ich lande, wenn ich ab
jetzt nichts mehr an meiner aktuellen Aktion ändere (oder eine bestimmte
Aktion ausführe), ohne selbst zu simulieren.

Akzeptanzkriterien:
- WHEN `calcLandingCoords(state, opts?)` aufgerufen wird SHALL DAS SYSTEM
  `{ dx, dy, ticks, kind }` zurückgeben, wobei `kind` einer von
  `"ground" | "ceiling" | "none"` ist (`"none"` = keine Landung innerhalb des
  Sichtradius/`maxTicks` gefunden).
- WHEN `opts` weggelassen wird SHALL DAS SYSTEM die aktuelle Bewegung des Bots
  (aktuelle `velocity`, `facing`, `onGround`) unverändert fortschreiben
  ("wenn ich nichts mehr verändere").
- WHEN `simulateJump(state, holdTicks)` aufgerufen wird SHALL DAS SYSTEM
  `calcLandingCoords` mit einem Sprung-Szenario (`jump: true`,
  `holdJumpTicks: holdTicks`) intern wiederverwenden.
- WHEN `apex(state, opts)` aufgerufen wird SHALL DAS SYSTEM den höchsten Punkt
  (minimales `dy`) der mit `predictPath` berechneten Bahn zurückgeben.
- WHEN `minJumpHoldToReach(state, dx, dy)` aufgerufen wird SHALL DAS SYSTEM die
  minimale Anzahl Ticks zurückgeben, für die `jump` gehalten werden muss, um
  den Punkt `(dx, dy)` zu erreichen oder zu überfliegen, bzw. `null`, wenn er
  mit keiner Haltezeit erreichbar ist.
- WHEN `ticksUntilEdge(state)` aufgerufen wird SHALL DAS SYSTEM die Anzahl
  Ticks bis der Bot (unter Berücksichtigung seiner halben Breite aus
  `state.tuning.botWidth`) die aktuelle Plattform in `facing`-Richtung
  verlässt, zurückgeben (oder `null`, wenn er in Sichtweite nicht verlässt).

### US-6: Umgebungs-Helfer

Als Bot-Autor möchte ich einfache Abfragen zur lokalen Geometrie, ohne
`platforms` selbst durchsuchen zu müssen.

Akzeptanzkriterien:
- WHEN `surfaceAt(state, dx)` aufgerufen wird SHALL DAS SYSTEM die
  `dy`-Höhe der nächsten soliden Oberfläche an der horizontalen Position
  `dx` relativ zum Bot zurückgeben, oder `null`, wenn dort keine Oberfläche im
  Sichtradius liegt.
- WHEN `wallAhead(state)` aufgerufen wird SHALL DAS SYSTEM `{ distance, height
  } | null` zurückgeben: eine solide Fläche in `facing`-Richtung, die höher
  ist als der Bot springen kann, samt Distanz und Höhe in Pixeln.

### US-7: Gefahren-Vorhersage

Als Bot-Autor möchte ich abschätzen können, ob ein bewegter Hazard meine
geplante Bahn schneidet, damit ich Kollisionen vorab vermeiden kann.

Akzeptanzkriterien:
- WHEN der State für einen Tick gebaut wird SHALL DAS SYSTEM jedem Eintrag in
  `hazards` zusätzlich `vx: number` und `vy: number` (px/s, aktuelle
  Geschwindigkeit) beifügen.
- WHEN `predictHazard(state, hazard, ticks)` aufgerufen wird SHALL DAS SYSTEM
  `{ dx, dy, active }` für den angegebenen Hazard `ticks` Ticks in die Zukunft
  zurückgeben, basierend auf der aktuellen Bewegung/dem aktuellen Zustand.
- WHEN `pathIntersectsHazard(state, path, hazard)` aufgerufen wird SHALL DAS
  SYSTEM `true` zurückgeben, wenn ein `predictPath`-Ergebnis (`path`) zu
  irgendeinem Zeitpunkt innerhalb der Kollisionsdistanz zum vorhergesagten
  Hazard-Ort liegt UND der Hazard zu diesem Zeitpunkt `active` ist.

### US-8: Kleinere Convenience-Helfer

Als Bot-Autor möchte ich ein paar triviale, aber häufig gebrauchte Bausteine,
ohne sie jedes Mal neu zu schreiben.

Akzeptanzkriterien:
- WHEN `moveToward(dx, sprint)` aufgerufen wird SHALL DAS SYSTEM eine
  passende Action (`"left" | "right" | "sprint-left" | "sprint-right" |
  "idle"`) zurückgeben, abhängig vom Vorzeichen von `dx` und `sprint`.
- WHEN `createJumpHold()` aufgerufen wird SHALL DAS SYSTEM ein
  Closure-Objekt mit einer `tick()`-artigen Methode zurückgeben, das über
  mehrere Bot-Ticks hinweg konsistent `"jump"` liefert, bis eine angegebene
  Zielhaltezeit erreicht ist.
- WHEN `pathHits(path, dx, dy, radius)` aufgerufen wird SHALL DAS SYSTEM
  `true` zurückgeben, wenn irgendein Punkt aus `path` innerhalb `radius` Pixel
  um `(dx, dy)` liegt (z.B. um zu prüfen, ob ein geplanter Sprung eine Münze
  oder einen `coinBlock` von unten trifft).

### US-9: Alle Helfer sind reine, isoliert getestete Funktionen im Template

Als Projekt möchte ich, dass die neuen Funktionen genauso wartbar sind wie der
übrige Code, obwohl sie in einer Datei liegen, die primär von devkcode bearbeitet
wird.

Akzeptanzkriterien:
- WHEN eine der Funktionen aus US-4 bis US-8 implementiert wird SHALL DAS
  SYSTEM sie als benannten Export in `current-bot.template.js` bereitstellen
  UND über eine begleitende Vitest-Datei (`current-bot.template.helpers.test.ts`
  o.ä.) abdecken.
- WHEN der Worker die Bot-Datei validiert (`validateBotModule`,
  `checkStaticGuard`) SHALL DAS SYSTEM durch die zusätzlichen named exports in
  keiner Weise beeinträchtigt werden (Guard/Validierung bleiben unverändert;
  reine Zusatz-Exporte sind bereits heute unkritisch, siehe
  `client/src/sandbox/botWorker.ts:24-31`).
- WHEN die Datei um die Helfer wächst SHALL DAS SYSTEM am Dateianfang einen
  kompakten Referenz-Index (eine Zeile pro Funktion: Name, Zweck, Rückgabewert)
  voranstellen, damit devkcode die Datei nicht komplett lesen muss, um die
  API zu überblicken.

### US-10: Dokumentation nachziehen

Als Team möchte ich, dass `docs/02-bot-api.md`, `docs/08-hazards-und-utilities.md`
und `client/src/bot/AGENTS.md` den erweiterten Contract und die neuen Helfer
korrekt beschreiben.

Akzeptanzkriterien:
- WHEN `BotState` um `platforms`, `tuning`, `sprintRampProgress` und
  `hazards[].vx/vy` erweitert wird SHALL DAS SYSTEM diese Felder in
  `docs/02-bot-api.md` mit demselben Typ wie im Contract-Code dokumentieren.
- WHEN die neuen Helferfunktionen im Template existieren SHALL DAS SYSTEM sie
  in `client/src/bot/AGENTS.md` mit Kurzbeschreibung und einem Mini-Beispiel
  auflisten.
- WHEN das Dokument den bereits bekannten Kommentar-Fehler in
  `packages/bot-contract/src/state.ts` zu `stompable` berührt („aktuell nur
  `schnetzler`" statt korrekt `ninjafrog`, siehe `docs/08-hazards-und-utilities.md:125`)
  SHALL DAS SYSTEM den Kommentar auf den korrekten Wert (`ninjafrog`)
  korrigieren.

## Nicht-Ziele

- Keine Änderung der `decide(state)`-Signatur, keine Sandbox-Injektion von
  Helfern, keine Änderung von `apiVersion`.
- Keine neuen Bot-Strategien oder Persönlichkeits-Vorlagen.
- Keine Änderung an `BotRunner`/`botWorker`/`staticGuard`-Verhalten.
- Keine Vergrößerung von `nearbyTiles` (bleibt 7×5, unverändert) – die
  Trajektorie-Helfer nutzen ausschließlich `platforms`.
- Keine Behebung von zuvor diskutierten, aber nicht bestätigten Symptomen aus
  Playtests (z.B. `gapAhead`-Airborne-Verhalten) – falls dort tatsächlich ein
  Bug vorliegt, ist das ein separates Bugfix-Spec.

## Offene Fragen

- Toleranzwert für den `predictPath`-Referenztest gegen `RaceScene` (siehe
  US-4, letztes Kriterium) – wird im Design konkret festgelegt, sobald ein
  erster Simulationsschritt-Wert (`physicsStepMs`) gewählt ist.
- Soll `platforms` zusätzlich zu `nearbyTiles` bestehen bleiben (additiv, wie
  hier angenommen) oder soll `nearbyTiles` in einem späteren Schritt auf
  `platforms` umgestellt/abgelöst werden? Für dieses Spec: additiv, keine
  Ablösung.
