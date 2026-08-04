# Bugfix: Steuerungs-Lag, fehlender Multi-Input, unanimierte Grafik

## Aktuelles Verhalten (Bug)

- Manuelle Tastatursteuerung fühlt sich laggy an: Input wird nur im 150ms-
  Bot-Tick-Raster gelesen und über ein `await`/Promise verarbeitet, obwohl
  Tastatureingaben für einen Menschen jeden Frame (60fps) reagieren sollten.
- Gleichzeitiges Laufen + Springen ist nicht möglich: `KeyboardController`
  liefert nur eine `Action` pro Aufruf (if/else-Kette), "links" gewinnt immer
  gegen "jump".
- Die Spielfigur ist eingefroren (kein Idle/Run/Jump/Fall-Wechsel, kein
  Blickrichtungs-Flip).
- Früchte/Coins, Säge, Feuer, Trampolin und Ziel-Flagge sind statische Bilder
  statt animierter Spritesheets (nur Frame 0 sichtbar, da per `load.image`
  statt `load.spritesheet` geladen).
- Terrain wird mit einer einzigen, sich wiederholenden Kachel gezeichnet statt
  eines Kachelsets mit Ober-/Rand-Kacheln.

## Erwartetes Verhalten

- Tastatur-Input wird jeden Frame synchron gelesen und angewendet (60fps-
  Gefühl, kein Bot-Tick-Bezug für den manuellen Modus).
- Gleichzeitiges Laufen + Springen funktioniert (horizontale und vertikale
  Bewegung sind unabhängig).
- Der Bot-Tick (150ms) bleibt für den Bot-Modus bestehen, blockiert aber
  nicht mehr den `update()`-Loop (nicht-blockierend, letzte Action gecacht).
- Spielfigur, Früchte, Hazards, Utility und Ziel sind animiert (Idle/Run/
  Jump/Fall/Hit, rotierende Früchte, Säge-Spin, Feuer an/aus, Trampolin-
  Bounce, Ziel-Flagge idle/pressed, Pickup-Pop-Effekt).
- Terrain wird mit einem Kachelset (Ober-/Mittelkacheln, linker/rechter Rand)
  gerendert, angelehnt an `coin-quest-arena-tmp`.

## Was bleibt unverändert (Regressions-Schutz)

- `@arena/bot-contract` (Typen, `Action`, `BotModule`, Validierung) –
  unverändert. Der Bot-seitige Contract bleibt exakt eine `Action` pro Tick.
- `client/src/sandbox/{BotRunner,botWorker,createBrowserWorker,workerLike}` –
  unverändert (Feature `bot-decide-api` bleibt vollständig intakt, alle 60
  zugehörigen Tests bleiben grün).
- Die pure Rules Engine (`level/`, `rules/`, `state/`, `scoring.ts`,
  `hazards/behaviors.ts`, `hazards/registry.ts`) – unverändert, alle
  bestehenden Tests bleiben grün.
- `KeyboardController.getNextAction(): Action` (bestehende Methode) bleibt
  erhalten (Bot-Parität, bestehende Tests bleiben grün) – wird um eine
  zusätzliche, schmale Methode ergänzt, nicht ersetzt.
- `RacerController`-Interface (`getNextAction`) bleibt unverändert; der
  Tastatur-Sonderpfad in `RaceScene` ist ein zusätzlicher, optionaler
  Codepfad (Duck-Typing: `RaceScene` prüft, ob der aktuelle Controller ein
  `KeyboardController` ist und nutzt dann `getInput()` zusätzlich).

## Root Cause (nach Analyse)

1. `RaceScene.update()` wendet `lastAction` nur nach einem 150ms-Tick neu an
   und der Tick-Handler selbst ist `async`/`await`-basiert – das koppelt die
   Reaktionsgeschwindigkeit der Tastatur fälschlich an das Bot-Tick-Intervall.
2. `RacerController.getNextAction()` ist bewusst auf **eine** `Action`
   beschränkt (richtig für Bots, aber zu restriktiv für menschlichen Input).
3. Assets wurden für animierte Objekte per `load.image` statt
   `load.spritesheet` geladen bzw. es fehlte eine zentrale
   Animations-Erzeugung (`scene.anims.create`) und deren Verwendung
   (`sprite.play(...)`).
4. Terrain-Rendering zeichnete für jede Kachel denselben festen Frame-Index
   statt eines positionsabhängigen Kachel-Sets.

## Fix-Ansatz

**A – Steuerung/Performance:**
- `RaceScene.update()`: Tastatur-Modus liest jeden Frame synchron
  `KeyboardController.getInput()` (neu, additiv) und wendet horizontale +
  vertikale Bewegung unabhängig an. Bot-Modus bleibt bei `getNextAction()`
  im 150ms-Raster, aber nicht-blockierend (Promise wird "fire-and-forget"
  behandelt, Ergebnis in `lastAction` gecacht, kein `await` mehr im
  Frame-Pfad).
- Bewegungs-/Physik-Konstanten an Prototyp-Werte angleichen (Speed, Jump,
  Gravity, Bounce-Werte) für ein spürbar direkteres Spielgefühl.

**B – Grafik:**
- Neue Module `game/assets/spriteSheets.ts` (Ladepfade/Frame-Größen) und
  `game/assets/animations.ts` (zentrale `createAnimations(scene)`),
  angelehnt an `coin-quest-arena-tmp/src/game/assets/`.
- `RaceScene.preload()` nutzt die Spritesheet-Definitionen statt einzelner
  `load.image`-Aufrufe für alles Animierte.
- `RaceScene.create()` ruft `createAnimations(this)` einmalig auf.
- Player-Animation in `RaceScene.update()` (Idle/Run/Jump/Fall/Hit + Flip),
  angelehnt an Prototyp-`Racer.updateVisuals()`.
- `worldBuilder.ts`: Früchte/Hazards/Utility/Ziel spielen ihre jeweilige
  Animation; Terrain wird mit dem 3×2-Kachelset gezeichnet (angelehnt an
  Prototyp-`paintTerrainSegment`).

**Nicht Teil dieses Bugfixes:** Multi-Kamera/Multi-Racer, Contract-Änderung
an `@arena/bot-contract`, Server-/Sammelstelle-Themen.
