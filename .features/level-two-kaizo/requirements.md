# Requirements: Level-Two-Kaizo (zweites, schwereres Level)

## Kontext

Aufbauend auf `level-one-arena` (existierendes `LEVEL_ONE`, Phaser-Rendering, Rules Engine,
`BotState`-Builder, Scoring) liefert dieses Feature ein zweites, spürbar schwereres Level
("Kaizo Light", angelehnt an Mario-Kaizo-Hacks), betrifft `docs/06-level-design.md` (Level-
Elemente, Schwierigkeitskurve) und `docs/08-hazards-und-utilities.md` (neuer Hazard-Typ).

Bisher ist genau ein Level fest verdrahtet (`RaceScene` importiert `LEVEL_ONE` direkt, siehe
`client/src/game/level/levelOne.ts`). Dieses Feature führt zusätzlich eine **Level-Registry**
und eine **Level-Auswahl in `/dev`** ein, damit Level 1 und Level 2 nebeneinander existieren
und getestet werden können. Die Auswahl bleibt in diesem Feature rein lokal in `/dev`
(kein WebSocket/`/admin`-Anbindung) – die Architektur (Level-Registry mit stabilen
String-IDs) wird aber bewusst so gebaut, dass ein späteres Feature (`/admin`-Fernsteuerung,
analog zum bestehenden Audio-Settings-Broadcast-Muster aus `game-audio`) die gleichen IDs
wiederverwenden kann, ohne die Registry umzubauen.

Zusätzlich wird ein neuer Hazard-Typ eingeführt: **Spikehead** (fallender Stachelkopf,
"Rock/Spike Head" aus `docs/08`, Abschnitt "Bewusst (noch) nicht enthalten"). Visuell nutzt
Spikehead das bestehende Stachlinger-Sprite in einer anderen Farbe (kein neues Asset nötig).

Architektur-Vorgabe wie in `level-one-arena`: striktes SOLID-Design, Clean-Code (Uncle Bob),
YAGNI/DRY/KISS, strikt testgetrieben (Rot-Grün-Refactor).

## User Stories

### US-1: Level-Registry mit stabilen IDs

Als Entwicklerteam möchte ich alle Level zentral über eine `LEVEL_REGISTRY` (ID → `LevelDef`)
referenzieren, damit Level-Auswahl (aktuell `/dev`, später ggf. `/admin`) nie ein Level direkt
importieren muss und neue Level rein additiv (neuer Registry-Eintrag) ergänzt werden können
(Open/Closed).

Akzeptanzkriterien:
- WHEN die Level-Registry geladen wird SHALL DAS SYSTEM mindestens die Einträge
  `"level-one"` (bestehendes `LEVEL_ONE`) und `"level-two"` (neues `LEVEL_TWO`) enthalten,
  jeweils mit einem menschenlesbaren Anzeigenamen (`label`) für die UI.
- WHEN ein neues Level hinzugefügt wird SHALL DAS SYSTEM dies durch einen zusätzlichen
  Registry-Eintrag ermöglichen, ohne `RaceScene`, `ArenaView` oder `DevPage` inhaltlich
  ändern zu müssen (nur die Registry wächst).
- WHEN eine unbekannte Level-ID angefragt wird SHALL DAS SYSTEM einen klaren Fehler werfen
  (Fail-Fast), statt still ein Default-Level zu laden.

### US-2: `LEVEL_TWO`-Definition als Daten

Als Entwicklerteam möchte ich `LEVEL_TWO` als reine, deklarative `LevelDef` (gleicher Typ wie
`LEVEL_ONE`) definiert haben, damit Level-Inhalt und Rendering/Physik-Code getrennt bleiben.

Akzeptanzkriterien:
- WHEN `LEVEL_TWO` geladen wird SHALL DAS SYSTEM Weltgröße (ähnliche Größenordnung wie
  `LEVEL_ONE`, ca. 3000-3600px Breite), Spawn-Punkt, Ziel-Punkt, Boden-/Plattform-Segmente
  (inkl. Lücken), sichtbare Münzen, versteckte Block-Münzen, mindestens 3 Checkpoints, alle
  fünf Hazard-Typen (die vier bestehenden + neu `spikehead`) und mindestens ein
  Boingo-Utility enthalten.
- WHEN Boden-Lücken in `LEVEL_TWO` definiert werden SHALL DAS SYSTEM sie spürbar breiter als
  in `LEVEL_ONE` (128px) auslegen (Ziel-Spanne ca. 170-210px), aber innerhalb der
  physikalisch überspringbaren Distanz (< ca. 250px bei `MOVE_SPEED=200`/
  `JUMP_VELOCITY=-560`/Gravity=900 aus `RaceScene.ts`) bleiben, sodass jede Lücke mit einem
  regulären Sprung (ohne Boingo) überwindbar ist.
- WHEN mindestens ein Abschnitt mit mehreren Schnetzler-Gegnern definiert wird SHALL DAS
  SYSTEM 2-3 Schnetzler mit eng bemessenen, sich potenziell überlappenden Patrouillen-
  Fenstern auf einer einzigen, schmalen Plattform platzieren, sodass ein Bot mehrfach
  hintereinander timen/springen/stompen muss, um die Passage zu durchqueren (keine
  Möglichkeit, alle Gegner mit einer einzigen, ungezielten Aktion zu passieren).
- WHEN mindestens ein `spikehead`-Hazard platziert wird SHALL DAS SYSTEM ihn über einer engen
  Boden-Passage (nicht über einer Lücke) positionieren, sodass er eine zusätzliche
  Zeit-/Positions-Hürde beim Durchlaufen darstellt.
- WHEN das Level geladen wird SHALL DAS SYSTEM eine mit `docs/06` vergleichbare
  Größenordnung an sichtbaren/versteckten Münzen einhalten (ca. 10-15 sichtbar, 3-5
  versteckt), analog zur bestehenden Validierung von `LEVEL_ONE`.

### US-3: Neuer Hazard-Typ "Spikehead" (fallender Stachelkopf)

Als Standbetreuer möchte ich einen neuen, herabfallenden Hazard-Typ, der eine zusätzliche
Timing-/Positions-Herausforderung darstellt (anders als die bereits vorhandenen
Patrol-/Static-/Timed-/Pendulum-Verhalten).

Akzeptanzkriterien:
- WHEN ein Racer eine definierte horizontale Trigger-Zone (`triggerX`-Bereich) unterhalb/vor
  einem `spikehead`-Hazard betritt SHALL DAS SYSTEM nach einer kurzen, festen Verzögerung
  (`warnMs`, Default z.B. 400ms) den Stachelkopf von seiner Ausgangsposition (`originY`) bis
  zu einer Zielposition (`fallToY`, z.B. Bodenhöhe) fallen lassen.
- WHEN der Stachelkopf fällt oder am Boden liegt (`fallToY` erreicht, für `restMs`, Default
  z.B. 600ms) SHALL DAS SYSTEM ihn als aktiv/gefährlich werten (jede Berührung kostet ein
  Leben, nicht stompbar – analog Stachlinger).
- WHEN `restMs` nach dem Aufprall verstrichen ist SHALL DAS SYSTEM den Stachelkopf zu seiner
  Ausgangsposition (`originY`) zurücksetzen und wieder scharf für einen neuen Trigger machen
  (deterministischer Zyklus, kein Zufall – wie bei den bestehenden Hazards).
- WHEN sich der Racer außerhalb der Trigger-Zone befindet UND der Stachelkopf sich in
  Ausgangsposition befindet SHALL DAS SYSTEM ihn als inaktiv/ungefährlich werten.
- WHEN `spikehead` im `BotState` (`nearestHazard`/`nearbyTiles`) sichtbar wird SHALL DAS
  SYSTEM ihn wie jeden anderen Hazard-`kind` generisch behandeln (kein Sonderfall in
  `botStateBuilder`/`tiles.ts` nötig, siehe US-9 Open/Closed-Anforderung).
- WHEN das Sprite gerendert wird SHALL DAS SYSTEM das bestehende Stachlinger-Sprite mit einer
  anderen Einfärbung (Tint) nutzen (kein neues Asset erforderlich).

### US-4: Level-Auswahl in `/dev`

Als Standbetreuer möchte ich in `/dev` per Dropdown zwischen den registrierten Leveln
wechseln können, um Level 1 und Level 2 zu testen.

Akzeptanzkriterien:
- WHEN `/dev` geöffnet wird SHALL DAS SYSTEM standardmäßig `"level-one"` laden und ein
  Dropdown mit allen `LEVEL_REGISTRY`-Einträgen (Anzeigenamen) anzeigen, im bestehenden
  Pixel-UI-Design (`pixel-*`-Klassen, siehe `DevPage.tsx`/vorhandenes Stylesheet).
- WHEN im Dropdown ein anderes Level ausgewählt wird SHALL DAS SYSTEM den aktuellen Lauf
  zurücksetzen (Racer zurück auf Spawn des neu gewählten Levels, Leben/Coins/Zeit
  zurückgesetzt, analog zum bestehenden "Neu"-Reset-Mechanismus) und das gewählte Level
  laden.
- WHEN zwischen Leveln gewechselt wird SHALL DAS SYSTEM den aktuellen Steuerungsmodus
  (Selbst/Bot) beibehalten (keine ungewollte Rücksetzung des Modus durch den Level-Wechsel).

### US-5 (NFR): Saubere, skalierbare Architektur

Als Entwicklerteam möchten wir, dass dieses Feature nach SOLID, Clean Code (Uncle Bob) und
YAGNI/DRY/KISS umgesetzt wird, strikt testgetrieben.

Akzeptanzkriterien:
- WHEN der neue Hazard-Typ implementiert wird SHALL DAS SYSTEM dies über einen neuen
  `HazardKind`-Wert (`"spikehead"`) im bestehenden `@arena/bot-contract`-Package, einen
  neuen Registry-Eintrag (`HAZARD_REGISTRY.spikehead`) und ein neues, pures Behavior
  (`hazards/behaviors.ts`) umsetzen, ohne bestehende Kind-spezifische Fallunterscheidungen
  in Szene-/Kollisions-/State-Builder-Code anfassen zu müssen (Open/Closed, wie in
  `docs/08` beschrieben).
- WHEN Level-Registry, `LEVEL_TWO`-Daten, Spikehead-Behavior und die
  Level-Auswahl-UI-Logik implementiert werden SHALL DAS SYSTEM diese in getrennten Modulen
  mit je einer Verantwortung abbilden (Single Responsibility), analog zur bestehenden
  Struktur aus `level-one-arena`.
- WHEN dieses Feature umgesetzt wird SHALL DAS SYSTEM strikt testgetrieben (Rot-Grün-
  Refactor) entwickelt werden; alle pure/testbare Logik (Level-Struktur-Validierung,
  Spikehead-Zeit-/Trigger-Verhalten, Registry-Lookup) SHALL DAS SYSTEM vor der jeweiligen
  Implementierung mit einem fehlschlagenden Test versehen.
- WHEN Phaser-Rendering-/UI-Code entsteht, der nicht sinnvoll ohne echten Browser/Canvas
  testbar ist, SHALL DAS SYSTEM dies explizit als "nicht unit-getestet, manuell verifiziert"
  im Design dokumentieren (analog zu `level-one-arena`).

## Nicht-Ziele

- Keine `/admin`-Fernsteuerung der Level-Auswahl (kein WebSocket-Broadcast für Level-Wechsel)
  – nur die Registry-Struktur mit stabilen IDs wird so vorbereitet, dass ein späteres Feature
  dies ergänzen kann.
- Kein drittes Level, keine automatische Schwierigkeitskurve/Level-Rotation über den Tag.
- Kein neues Asset/Spritesheet für Spikehead – ausschließlich Tint-Variante des bestehenden
  Stachlinger-Sprites.
- Keine Änderung an Turniermodus/Scoring-Konstanten (`docs/05`/`docs/09`) – Level 2 nutzt die
  bestehende Scoring-Formel unverändert.
- Kein Multi-Kamera-Grid-Bezug (bleibt wie in `level-one-arena` außen vor).

## Offene Fragen

- Exakte Timing-Werte für Spikehead (`warnMs`/`restMs`) werden im Design als sinnvolle
  Startwerte festgelegt und bleiben, wie die übrigen Hazard-Timings, ein späteres
  Kalibrierungs-Thema (siehe `docs/07`).
- Ob künftig mehr als 2 Level in der Registry existieren und ob dann ein Dropdown weiterhin
  UI-technisch ausreicht, ist nicht Teil dieses Features (YAGNI – aktuell 2 Einträge).

## Begleitende Doku-Updates

- `docs/08-hazards-und-utilities.md`: neuer Abschnitt/Tabellen-Zeile für "Spikehead"
  (Mechanik, Stompbar: nein, dauerhaft gefährlich: nur während Fallen/Liegen).
- `docs/06-level-design.md`: Hinweis ergänzen, dass es nun mehrere Level mit steigendem
  Schwierigkeitsgrad gibt (beantwortet die bisher offene Frage "mehrere Level vs. immer
  dasselbe").
