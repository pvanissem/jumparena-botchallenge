# Requirements: Level-Three-Underground (drittes, leichteres Untergrund-Level)

## Kontext

Aufbauend auf `level-one-arena` (Grundarchitektur: `LEVEL_REGISTRY`, `LevelDef`, Hazard-/
Utility-Registry, `BotState`-Builder, Scoring) und `level-two-kaizo`/`level-two-background`
(zweites, schwereres Level "Kaizo Light" inkl. neuem Hazard `spikehead` und prozeduralem
SMB1-1-Hintergrund) führt dieses Feature ein **drittes Level** ein: "Underground" – ein
Höhlen-/Untergrund-Level, das sich an den Hindernissen von Level 2 orientiert, aber spürbar
**leichter** ist. Betrifft `docs/06-level-design.md` (Level-Elemente, mehrere Level mit
unterschiedlichem Schwierigkeitsgrad) und `docs/08-hazards-und-utilities.md` (keine neuen
Hazard-Typen geplant, nur Wiederverwendung bestehender Typen).

Level 3 soll optisch klar als "Untergrund" erkennbar sein:
- ein dunkler, **prozedural generierter** Hintergrund (analog zum bestehenden Muster aus
  `level-two-background`: `BackgroundSpec`-Registry-Eintrag + neues Modul in
  `proceduralBackgrounds.ts`, per Phaser-`Graphics`/`generateTexture` einmalig gezeichnet),
- **dunkle Terrain-Sprites** für Boden/Plattformen (Wiederverwendung/Umfärbung bestehender
  Terrain-Tiles bzw. Nutzung ungenutzter Bereiche des vorhandenen Terrain-Tilesets
  `Terrain (16x16).png`, gemäß Projekt-Prinzip "keine neuen Bild-Assets", siehe
  `level-two-background`, Nicht-Ziele).

Level 3 ist als **Level 1** in Sachen Schwierigkeit ähnlich oder nur geringfügig
anspruchsvoller einzustufen (klar leichter als Level 2), da es an einem Messestand primär als
zugänglicher, aber thematisch abwechslungsreicher dritter Streckentyp dienen soll.

## User Stories

### US-1: `LEVEL_THREE`-Definition als Daten, leichter als Level 2

Als Entwicklerteam möchte ich `LEVEL_THREE` als reine, deklarative `LevelDef` (gleicher Typ
wie `LEVEL_ONE`/`LEVEL_TWO`) definiert haben, damit Level-Inhalt und Rendering/Physik-Code
getrennt bleiben und das Level über die bestehende `LEVEL_REGISTRY` referenzierbar ist.

Akzeptanzkriterien:
- WHEN die Level-Registry geladen wird SHALL DAS SYSTEM zusätzlich zu `"level-one"` und
  `"level-two"` einen Eintrag `"level-three"` (neues `LEVEL_THREE`, Label z.B.
  "Level 3 - Underground") enthalten, ohne bestehende Einträge zu verändern.
- WHEN `LEVEL_THREE` geladen wird SHALL DAS SYSTEM Weltgröße (ähnliche Größenordnung wie
  `LEVEL_ONE`/`LEVEL_TWO`, ca. 2400-3000px Breite), Spawn-Punkt, Ziel-Punkt, Boden-/
  Plattform-Segmente, sichtbare Münzen, versteckte Block-Münzen, mindestens 3 Checkpoints
  sowie Hazards und ggf. Utilities enthalten, analog zur bestehenden Struktur-Validierung von
  `LEVEL_TWO`.
- WHEN Boden-Lücken in `LEVEL_THREE` definiert werden SHALL DAS SYSTEM sie **schmaler oder
  gleich** den Lücken aus `LEVEL_ONE` (128px) auslegen (spürbar leichter als `LEVEL_TWO`s
  170-210px), damit Sprünge komfortabel gelingen.
- WHEN Hazards in `LEVEL_THREE` platziert werden SHALL DAS SYSTEM ausschließlich bereits
  bestehende Hazard-Typen aus `docs/08` wiederverwenden (z.B. Schnetzler, Stachlinger,
  Loderix; optional Kugelblitz/Spikehead in reduzierter Zahl) – **kein** neuer Hazard-Typ.
- WHEN Hazard-Abschnitte aus `LEVEL_TWO` als Vorlage dienen (z.B. Schnetzler-Gauntlet, enge
  Passage mit Spikehead) SHALL DAS SYSTEM diese in `LEVEL_THREE` mit **reduzierter Anzahl
  gleichzeitiger Hazards und/oder großzügigeren Zeitfenstern** (z.B. längere
  Patrouillen-Überlappungs-Pausen, längere `restMs`/kürzere `warnMs`-Bedrohungsdauer bei
  Spikehead) entschärfen, sodass die Passage ohne Mehrfach-Versuch bei normalem Timing
  durchquerbar ist.
- WHEN das Level geladen wird SHALL DAS SYSTEM eine mit `docs/06` vergleichbare
  Größenordnung an sichtbaren/versteckten Münzen einhalten (ca. 10-15 sichtbar, 3-5
  versteckt), analog zur bestehenden Validierung von `LEVEL_ONE`/`LEVEL_TWO`.
- WHEN `LEVEL_THREE` geladen wird SHALL DAS SYSTEM mindestens 3 Checkpoints enthalten, analog
  zu `LEVEL_TWO`.

### US-2: Dunkler, prozedural generierter Untergrund-Hintergrund

Als Standbetreuer möchte ich, dass Level 3 einen dunklen, höhlenartigen Hintergrund zeigt, der
das Level klar als "Untergrund" erkennbar macht (im Gegensatz zum hellen SMB1-1-Hintergrund
von Level 2).

Akzeptanzkriterien:
- WHEN `LEVEL_THREE` geladen wird SHALL DAS SYSTEM einen neuen `backgroundKey` (z.B.
  `"underground"`) referenzieren, der auf einen neuen `BackgroundSpec`-Eintrag vom Kind
  `"procedural"` in der bestehenden `backgroundRegistry.ts` verweist (Open/Closed, kein
  Sonderfall in `worldBuilder.ts`).
- WHEN der Untergrund-Hintergrund gezeichnet wird SHALL DAS SYSTEM ein dunkles,
  höhlenartiges Erscheinungsbild erzeugen (z.B. dunkler/schwarz-bläulicher Grundton,
  mehrere Ebenen von Fels-/Stein-Silhouetten in unterschiedlichen dunklen Grautönen als
  Tiefenwirkung, optional vereinzelte helle Akzente wie Kristalle/Glüh-Punkte für visuelles
  Interesse), analog zur Bau-Methode des bestehenden SMB1-1-Hintergrunds (Schichten aus
  einfachen Formen mit variierender Schattierung).
- WHEN der Hintergrund generiert wird SHALL DAS SYSTEM dies einmalig per Phaser-`Graphics`/
  `generateTexture` tun (keine neue Bild-Asset-Datei, keine Pro-Frame-Neuzeichnung), analog
  zu `proceduralBackgrounds.ts`.
- WHEN der Hintergrund gerendert wird SHALL DAS SYSTEM ihn wie den bisherigen Hintergrund
  über die gesamte Level-Breite mit Parallax-Scroll-Verhalten darstellen.

### US-3: Dunkle Terrain-Sprites für Untergrund-Optik

Als Standbetreuer möchte ich, dass Boden und Plattformen in Level 3 dunkel/höhlenartig statt
wie in Level 1/2 aussehen, damit das Level auch beim Terrain klar als Untergrund erkennbar
ist.

Akzeptanzkriterien:
- WHEN `LEVEL_THREE` gerendert wird SHALL DAS SYSTEM für Boden-/Plattform-Segmente ein
  dunkles Terrain-Erscheinungsbild verwenden – entweder durch Nutzung eines bereits im
  vorhandenen Tileset (`Terrain (16x16).png`) enthaltenen dunkleren Tile-Bereichs, oder durch
  Einfärbung (Tint) der bestehenden Terrain-Tiles (analog zum Spikehead-Tint-Muster aus
  `level-two-kaizo`) – **keine neue Bild-Asset-Datei**.
- WHEN das Terrain-Erscheinungsbild pro Level konfigurierbar gemacht wird SHALL DAS SYSTEM
  dies über eine zentrale, additive Stelle lösen (z.B. ein Terrain-Style-Feld in `LevelDef`
  oder eine kleine Terrain-Style-Registry analog zur Background-Registry), ohne
  `paintTerrainSegment()`/`worldBuilder.ts` mit Level-spezifischen Fallunterscheidungen zu
  durchsetzen (Open/Closed).
- WHEN `LEVEL_ONE`/`LEVEL_TWO` geladen werden SHALL DAS SYSTEM sich unverändert wie bisher
  verhalten (bestehendes helles Terrain, keine Regression).

### US-4 (NFR): Saubere, skalierbare Architektur

Als Entwicklerteam möchten wir, dass dieses Feature nach SOLID, Clean Code (Uncle Bob) und
YAGNI/DRY/KISS umgesetzt wird, strikt testgetrieben.

Akzeptanzkriterien:
- WHEN `LEVEL_THREE`, der neue Hintergrund und der Terrain-Style implementiert werden SHALL
  DAS SYSTEM diese in getrennten Modulen mit je einer Verantwortung abbilden (Single
  Responsibility), analog zur bestehenden Struktur aus `level-two-kaizo`/
  `level-two-background`.
- WHEN dieses Feature umgesetzt wird SHALL DAS SYSTEM strikt testgetrieben (Rot-Grün-
  Refactor) entwickelt werden; alle pure/testbare Logik (Level-Struktur-Validierung,
  Registry-Lookup, Terrain-Style-Auflösung) SHALL DAS SYSTEM vor der jeweiligen
  Implementierung mit einem fehlschlagenden Test versehen.
- WHEN Phaser-Rendering-Code entsteht (prozeduraler Hintergrund, Terrain-Tint), der nicht
  sinnvoll ohne echten Browser/Canvas testbar ist, SHALL DAS SYSTEM dies explizit als "nicht
  unit-getestet, manuell verifiziert" im Design dokumentieren (analog zu
  `level-two-background`).

## Nicht-Ziele

- Kein neuer Hazard-Typ – ausschließlich Wiederverwendung/Entschärfung bestehender Hazard-
  Kinds aus Level 2.
- Keine neuen Bild-Assets/Dateien – Hintergrund prozedural, Terrain per Tint/vorhandenem
  Tileset-Bereich.
- Keine `/admin`-Fernsteuerung, kein viertes Level, keine automatische
  Schwierigkeitskurve/Level-Rotation über den Tag (bleibt wie bei `level-two-kaizo`
  außen vor).
- Keine Änderung an Turniermodus/Scoring-Konstanten (`docs/05`/`docs/09`).
- Keine Animation der Hintergrund-Elemente (statische Silhouetten, analog Level 2).

## Offene Fragen

- Exakte Werte für "leichter als Level 2" (Lückenbreite, Hazard-Anzahl/-Timing) werden im
  Design als konkrete Zahlen festgelegt, orientiert an `LEVEL_ONE` (leicht) und `LEVEL_TWO`
  (schwer) als obere/untere Referenzpunkte.
- Ob ein dedizierter dunkler Bereich im vorhandenen Tileset existiert oder Tint auf die
  bestehenden Tiles angewendet werden muss, wird im Design nach Sichtung der PNG-Datei
  entschieden.

## Begleitende Doku-Updates

- `docs/06-level-design.md`: Ergänzung, dass nun drei Level mit unterschiedlichem
  Schwierigkeitsgrad existieren (Level 1 leicht, Level 2 schwer/Kaizo, Level 3 leicht/
  Underground-Thema).
- `docs/08-hazards-und-utilities.md`: keine inhaltliche Änderung nötig (keine neuen Hazard-
  Typen), ggf. kurzer Hinweis, dass Level 3 bestehende Hazards in entschärfter Form nutzt.
