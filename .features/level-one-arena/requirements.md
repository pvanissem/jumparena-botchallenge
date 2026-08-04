# Requirements: Level-One-Arena (erstes Level + Phaser-Integration)

## Kontext

Aufbauend auf `bot-decide-api` (Bot-Contract + Worker-Sandbox) liefert dieses Feature das
erste spielbare Level: eine Phaser-3-Szene mit Terrain, Münzen (sichtbar + versteckt in
Blöcken), Checkpoints, den vier Hazards und dem Boingo-Utility (siehe `docs/06-level-design.md`
und `docs/08-hazards-und-utilities.md`), sowie die Scoring-Berechnung (`docs/05-scoring-und-heats.md`).

Ein Racer kann wahlweise **manuell per Tastatur** oder **von einem Bot** (`decide(state)` über
den in `bot-decide-api` gebauten `BotRunner`) gesteuert werden – beides in derselben `/dev`-
Ansicht, umschaltbar. Es gibt genau einen Racer gleichzeitig sichtbar (kein Multi-Kamera-Grid,
das ist ein späteres, eigenes Feature für `/present`); die Architektur darf sich dadurch aber
nicht "verbauen" (siehe Nicht-Ziele/Design-Vorgabe).

Architektur-Vorgabe (wie bei `bot-decide-api`): striktes SOLID-Design, Clean-Code-Standards
(Uncle Bob), YAGNI/DRY/KISS, strikt testgetrieben (Rot-Grün-Refactor).

## User Stories

### US-1: Level-Definition als Daten

Als Entwicklerteam möchte ich das Level als reine, deklarative Datenstruktur (`LevelDef`)
definiert haben, damit Level-Inhalt und Rendering/Physik-Code getrennt bleiben (Single
Responsibility) und das Level ohne Code-Änderungen an anderer Stelle angepasst werden kann.

Akzeptanzkriterien:
- WHEN `LevelDef` für das erste Level geladen wird SHALL DAS SYSTEM Weltgröße, Spawn-Punkt,
  Ziel-Punkt, Boden-/Plattform-Segmente (inkl. Lücken/Abgründe), sichtbare Münzen, versteckte
  Block-Münzen, Checkpoints, alle vier Hazard-Typen und mindestens ein Boingo-Utility enthalten.
- WHEN das Level geladen wird SHALL DAS SYSTEM gemäß `docs/06-level-design.md` eine
  überschaubare Größenordnung einhalten (ca. 10–15 sichtbare Münzen, 3–5 versteckte
  Block-Münzen, 2–3 Hazards, 1–2 Sprung-Passagen über Abgründe, mindestens 2 Checkpoints
  zwischen Start und Ziel).
- WHEN neue Level-Elemente eines bereits unterstützten Typs hinzugefügt werden (z.B. eine
  weitere Münze) SHALL DAS SYSTEM dies durch reines Ergänzen von Dateneinträgen ermöglichen,
  ohne Rendering-/Physik-Code ändern zu müssen (Open/Closed).

### US-2: Level-Rendering in Phaser

Als Standbetreuer möchte ich, dass das Level (Terrain, Hintergrund, Münzen, Checkpoints,
Hazards, Utilities, Ziel) sichtbar in einer Phaser-Szene dargestellt wird, damit Besucher am
Stand etwas sehen, das sie nachvollziehen können.

Akzeptanzkriterien:
- WHEN die Szene startet SHALL DAS SYSTEM Hintergrund, Terrain (inkl. Lücken), alle sichtbaren
  Münzen, alle Checkpoints (im "nicht erreicht"-Zustand), alle Hazards (mit ihrem jeweiligen
  Bewegungs-/Takt-Verhalten), das Boingo-Utility und das Ziel gemäß `LevelDef` darstellen.
- WHEN eine versteckte Block-Münze noch nicht ausgelöst wurde SHALL DAS SYSTEM sie als
  undurchsichtigen Block darstellen (nicht als sichtbare Münze).
- WHEN ein Racer einen versteckten Block von unten berührt (Kollision von unten gegen den
  Block) SHALL DAS SYSTEM den Block als ausgelöst markieren, die Münze sichtbar/einsammelbar
  machen und sie danach wie eine reguläre Münze behandeln.

### US-3: Racer-Physik & Kollisionen

Als Standbetreuer möchte ich, dass ein Racer sich gemäß den vier Actions bewegt und korrekt
mit Münzen, Hazards, Utilities, Checkpoints und dem Ziel interagiert.

Akzeptanzkriterien:
- WHEN ein Racer die Action `"left"`/`"right"` erhält SHALL DAS SYSTEM ihn in die jeweilige
  Richtung mit fester Geschwindigkeit bewegen; bei `"jump"` (nur wenn `onGround`) SHALL DAS
  SYSTEM einen Sprung mit fester Sprungkraft auslösen; bei `"idle"` SHALL DAS SYSTEM keine
  horizontale Bewegung auslösen.
- WHEN ein Racer eine Münze (sichtbar oder freigeschaltete Block-Münze) berührt SHALL DAS
  SYSTEM sie einsammeln (aus der Welt entfernen, `coinsCollected`/Fruchtwert erhöhen).
- WHEN ein Racer einen stompbaren Hazard (Schnetzler) von oben trifft SHALL DAS SYSTEM den
  Hazard neutralisieren (kein Lebensverlust, Hazard verschwindet/wird inaktiv); bei
  seitlichem/direktem Kontakt mit einem beliebigen aktiven Hazard SHALL DAS SYSTEM ein Leben
  abziehen und den Racer zum zuletzt erreichten Checkpoint zurücksetzen.
- WHEN ein getakteter Hazard (Loderix) im "Aus"-Zustand berührt wird SHALL DAS SYSTEM dies
  NICHT als Treffer werten (kein Lebensverlust).
- WHEN ein Racer von oben auf das Boingo-Utility landet SHALL DAS SYSTEM ihn mit einem
  deutlich höheren Sprung (Faktor ca. 1,5× normale Sprunghöhe) katapultieren, ohne Schaden.
- WHEN ein Racer einen Checkpoint berührt, der noch nicht der zuletzt erreichte ist, SHALL DAS
  SYSTEM ihn als neuen "letzten erreichten Checkpoint" für diesen Racer merken.
- WHEN ein Racer in einen Abgrund fällt (unterhalb der Welt/außerhalb aller Plattformen) SHALL
  DAS SYSTEM dies wie einen Hazard-Treffer behandeln (Leben abziehen, Respawn am letzten
  Checkpoint).
- WHEN ein Racer alle Leben (Default 3, siehe `docs/05`) verbraucht hat SHALL DAS SYSTEM ihn als
  "ausgeschieden" (`didNotFinish = true`) markieren und seine Steuerung/Physik-Updates
  stoppen.
- WHEN ein Racer das Ziel berührt SHALL DAS SYSTEM den Lauf für diesen Racer als beendet
  markieren und `timeElapsedMs` bis zu diesem Zeitpunkt festhalten.
- WHEN das Zeitlimit eines Laufs (Default 90.000ms, siehe `docs/05`) erreicht wird, BEVOR ein
  Racer das Ziel erreicht hat, SHALL DAS SYSTEM den Lauf für diesen Racer als beendet mit
  `didNotFinish = true` markieren (bereits gesammelte Münzen bleiben gewertet).

### US-4: `BotState` aus dem Weltzustand ableiten

Als Entwicklerteam möchte ich eine reine Funktion, die aus Racer- und Levelzustand den
`BotState`-Contract (aus `@arena/bot-contract`) baut, damit dieselbe Logik sowohl für
Bot-gesteuerte als auch (zu Debug-/Vergleichszwecken) für manuell gesteuerte Racer verwendet
werden kann.

Akzeptanzkriterien:
- WHEN der State für einen Racer gebaut wird SHALL DAS SYSTEM `position`, `facing`,
  `onGround`, `isAlive`, `coinsCollected`, `livesRemaining`, `timeElapsedMs` und `tick` korrekt
  aus dem aktuellen Racer-/Levelzustand befüllen.
- WHEN `nearestCoin`/`nearestHazard`/`nearestUtility` bestimmt werden SHALL DAS SYSTEM jeweils
  das nächstgelegene Objekt dieser Art relativ zum Racer (als `dx`/`dy` in Tile-Einheiten)
  liefern, oder `null`, falls keines existiert; bei `nearestHazard` SHALL DAS SYSTEM zusätzlich
  `kind` und den aktuellen `active`-Zustand (z.B. Loderix an/aus) korrekt widerspiegeln.
- WHEN `nearbyTiles` bestimmt wird SHALL DAS SYSTEM ein festes, begrenztes Sichtfeld
  (Default 7×5 Tiles, siehe offene Frage in `docs/02-bot-api.md`) um den Racer herum liefern,
  in dem aktuell gefährliche Hazards als `"hazard"` erscheinen (getaktete nur, solange aktiv).
- WHEN `goalDirection` bestimmt wird SHALL DAS SYSTEM die Richtung zum Ziel relativ zum Racer
  liefern (`dx`/`dy`).

### US-5: Scoring

Als Standbetreuer möchte ich, dass nach einem Lauf ein Score gemäß der in `docs/05` definierten
Formel berechnet wird, damit Läufe vergleichbar sind.

Akzeptanzkriterien:
- WHEN ein Lauf beendet ist (Ziel erreicht oder Zeitlimit/`didNotFinish`) SHALL DAS SYSTEM den
  Score als `fruitScore + (reachedGoal ? max(0, TIME_BUDGET_MS - timeElapsedMs) ×
  TIME_BONUS_FACTOR : 0) − deaths × DEATH_PENALTY − (reachedGoal ? 0 : DNF_PENALTY)` berechnen,
  gerundet auf eine ganze Zahl.
- WHEN die Scoring-Konstanten verwendet werden SHALL DAS SYSTEM die Vorschlagswerte aus
  `docs/05` nutzen (`POINTS_PER_COIN=10`, `TIME_BUDGET_MS=60000`, `TIME_BONUS_FACTOR=0.01`,
  `DEATH_PENALTY=15`, `DNF_PENALTY=50`) als benannte, zentrale Konstanten (nicht dupliziert).

### US-6: Manuelle Tastatursteuerung (Testmodus)

Als Standbetreuer möchte ich einen Racer selbst per Tastatur (←/→/Leertaste) steuern können,
um das Level auszuprobieren und zu debuggen.

Akzeptanzkriterien:
- WHEN im Testmodus "Selbst spielen" die Pfeiltasten links/rechts gedrückt werden SHALL DAS
  SYSTEM dies 1:1 in die Actions `"left"`/`"right"` übersetzen; bei Leertaste in `"jump"`; ohne
  Tastendruck in `"idle"`.
- WHEN zwischen "Selbst spielen" und "Bot laufen lassen" umgeschaltet wird SHALL DAS SYSTEM den
  aktuellen Lauf zurücksetzen (Racer zurück auf Spawn, Leben/Coins/Zeit zurückgesetzt).

### US-7: Bot-gesteuerter Testmodus über `BotRunner`

Als Standbetreuer möchte ich denselben Racer stattdessen von einem geladenen Bot (Beispiel-Bot
oder späterer eigener Bot) steuern lassen können, um das Zusammenspiel von Level und
`decide(state)` zu verifizieren.

Akzeptanzkriterien:
- WHEN im Testmodus "Bot laufen lassen" ein gültiger Bot-Quellcode ausgewählt ist SHALL DAS
  SYSTEM pro Simulations-Tick (~150ms) den `BotState` (via US-4) bauen, ihn dem `BotRunner`
  aus `bot-decide-api` übergeben und die zurückgelieferte Action auf den Racer anwenden
  (identisch zur manuellen Steuerung aus US-3).
- WHEN der `BotRunner` in den Status `"paused"` wechselt (siehe `bot-decide-api`) SHALL DAS
  SYSTEM dies in der UI sichtbar anzeigen (z.B. "Bot pausiert: <Grund>"), ohne den restlichen
  Lauf/die Anzeige zum Absturz zu bringen.
- WHEN in diesem Testmodus mindestens ein Beispiel-Bot aus `examples/bots/`/
  `client/public/example-bots/` auswählbar ist SHALL DAS SYSTEM diesen laden und ausführen
  können.

### US-8: Wiederverwendbare Arena-Komponente in `/dev`

Als Entwicklerteam möchte ich die Level-Darstellung als eigenständige, von der Seite entkoppelte
Komponente bauen, damit sie später (in einem eigenen Feature) auch in `/present` wiederverwendet
werden kann, ohne umgebaut zu werden.

Akzeptanzkriterien:
- WHEN die Phaser-Integration gebaut wird SHALL DAS SYSTEM sie als eigenständige Komponente
  (z.B. `ArenaView`) kapseln, die unabhängig von `DevPage` instanziierbar ist und keine
  `/dev`-spezifische Logik (Umschalt-UI, Bot-Auswahl) direkt enthält.
- WHEN `DevPage` die Komponente nutzt SHALL DAS SYSTEM die Umschalt-/Bot-Auswahl-UI in `DevPage`
  selbst (bzw. eigenen Unterkomponenten) belassen, nicht in der Arena-Komponente.
- WHEN die Szene/der WorldBuilder für einen einzelnen Racer gebaut wird SHALL DAS SYSTEM dies
  so tun, dass ein späteres Hinzufügen weiterer Racer/Kameras in derselben Szene (Multi-Kamera-
  Grid, siehe `docs/03`) keine Neuentwicklung der Level-/Hazard-Erzeugung erfordert (kein
  Multi-Kamera-Code in diesem Feature, aber keine Architektur, die es strukturell ausschließt).

### US-9 (NFR): Saubere, skalierbare Architektur

Als Entwicklerteam möchten wir, dass dieses Feature nach SOLID, Clean Code (Uncle Bob) und
YAGNI/DRY/KISS umgesetzt wird, strikt testgetrieben.

Akzeptanzkriterien:
- WHEN Level-Daten, Hazard-Verhalten, Scoring, State-Building und Phaser-Rendering
  implementiert werden SHALL DAS SYSTEM diese in getrennten Modulen mit je einer Verantwortung
  abbilden (Single Responsibility).
- WHEN ein neuer Hazard-/Utility-Typ hinzukommt SHALL DAS SYSTEM dies über einen neuen
  Registry-Eintrag + ggf. ein neues Behavior ermöglichen, ohne bestehende Kind-spezifische
  Fallunterscheidungen in Szene/Kollisions-Code anfassen zu müssen (Open/Closed, siehe
  `docs/08`).
- WHEN dieses Feature umgesetzt wird SHALL DAS SYSTEM strikt testgetrieben (Rot-Grün-Refactor)
  entwickelt werden; alle pure/testbare Logik (Level-Validierung, Scoring, State-Building,
  Hazard-Behaviors, Kollisionsentscheidungen) SHALL DAS SYSTEM vor der jeweiligen
  Implementierung mit einem fehlschlagenden Test versehen.
- WHEN Phaser-Rendering-Code entsteht, der nicht sinnvoll ohne echten Browser/Canvas testbar
  ist, SHALL DAS SYSTEM dies explizit als "nicht unit-getestet, manuell verifiziert" im Design
  dokumentieren (analog zu `bot-decide-api`), statt ein aufwändiges Test-Harness zu bauen
  (YAGNI).

## Nicht-Ziele

- Kein Multi-Kamera-Grid, keine gleichzeitige Darstellung mehrerer Racer (das ist ein
  eigenständiges, späteres Feature für `/present`/Turniermodus).
- Kein Turniermodus, kein Bracket, kein Leaderboard-Persistenz (nur die reine
  Scoring-**Berechnung** für einen einzelnen Lauf, siehe US-5).
- Kein Datei-Import-UI für eigene Bot-Dateien (File System Access API) – der Bot-gesteuerte
  Testmodus (US-7) beschränkt sich auf mitgelieferte Beispiel-Bots; echter Datei-Import ist
  ein separates, späteres Feature.
- Keine Anbindung an `bot-collection-point`/den Hub-Server – dieses Feature ist rein
  clientseitig.
- Keine Persistenz von Läufen/Ergebnissen (Score wird berechnet und angezeigt, nicht
  gespeichert).

## Offene Fragen

- Exakte Sichtfeld-Größe (`nearbyTiles`) ist laut `docs/02-bot-api.md`/`docs/07-offene-punkte.md`
  offiziell noch offen; dieses Feature legt sich auf 7×5 als Startwert fest (änderbar über eine
  zentrale Konstante, siehe US-9 Open/Closed-Anforderung an Registries – analog für
  Sichtfeld-Konstante).
- Feinjustierung der Scoring-Konstanten bleibt laut `docs/05`/`docs/07` ein späteres
  Kalibrierungs-Thema mit echten Testbots; dieses Feature übernimmt nur die Vorschlagswerte.

## Begleitende Doku-Updates

Keine – `docs/05`, `docs/06`, `docs/08` beschreiben das Zielbild bereits korrekt; dieses
Feature setzt es um.
