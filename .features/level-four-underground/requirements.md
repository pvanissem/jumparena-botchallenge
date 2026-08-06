# Requirements: Level-Four-Underground (viertes Level, echtes Untergrund-Level mit Decke)

## Kontext

`LEVEL_THREE` (`.features/level-three-underground/`, UI-Label "Level 3 – Night") ist trotz des
Beinamens "Underground" architektonisch kein echtes Untergrund-Level: Es hat wie `LEVEL_ONE`/
`LEVEL_TWO` nur Boden-/Schwebeplattformen, keine Decke, und sein "dunkles" Terrain entsteht rein
durch Tint (`terrainStyleKey: "night"`, `0x4a4a63`) auf den bestehenden hellen Gras-/Erd-Tiles,
nicht durch tatsächlich andere, graue Stein-Tiles aus dem Terrain-Tileset.

Dieses Feature führt ein **neues, fünftes Level-Registry-Element `LEVEL_FOUR`** ein (UI-Label
z.B. "Level 4 – Underground"), das erstmals wirklich als geschlossener Untergrund-Gang gebaut
ist:
- **Boden UND Decke** durchgehend über die Lauf-Passagen (kein offener Himmel wie in Level 1-3),
- **echte dunkelgraue Stein-Tiles** aus dem vorhandenen Tileset
  `client/public/assets/Terrain/Terrain (16x16).png` (nicht per Tint eingefärbte Gras-Tiles),
- ein **prozedural generierter Hintergrund**, der optisch an das klassische
  Untergrund-Level **1-2 aus Super Mario Bros.** angelehnt ist (schwarzer Hintergrund, grünliche
  Backstein-/Blockmuster-Wand, keine Himmel-/Wolken-/Hügel-Optik wie bei Level 1/2).

Betrifft `docs/06-level-design.md` (mehrere Level unterschiedlicher Optik/Schwierigkeit),
`docs/08-hazards-und-utilities.md` (nur Wiederverwendung bestehender Hazard-Typen) sowie
architektonisch `client/src/game/level/types.ts` (`PlatformDef`/`LevelDef`), `level/tiles.ts`
(Solid-/Sichtbarkeits-Logik für Bots) und `world/worldBuilder.ts` (Rendering), da eine Decke
bisher als Konzept nicht existiert.

## User Stories

### US-1: `LEVEL_FOUR` als geschlossenes Untergrund-Level mit Boden UND Decke

Als Entwicklerteam möchte ich `LEVEL_FOUR` als deklarative `LevelDef` (gleicher Grund-Typ wie
`LEVEL_ONE`-`LEVEL_THREE`) definiert haben, das durchgehend sowohl Boden- als auch
Decken-Segmente besitzt, damit die Arena optisch wie ein geschlossener Höhlen-/Minen-Tunnel
wirkt statt wie ein offenes Sidescroll-Level.

Akzeptanzkriterien:
- WHEN die Level-Registry geladen wird SHALL DAS SYSTEM zusätzlich zu `"level-one"` bis
  `"level-three"` einen Eintrag `"level-four"` (`LEVEL_FOUR`, Label "Level 4 – Underground")
  enthalten, ohne bestehende Einträge zu verändern.
- WHEN `LEVEL_FOUR` geladen wird SHALL DAS SYSTEM über die gesamte befahrbare Streckenlänge
  (Ausnahme: bewusste Boden-Lücken analog zu `LEVEL_ONE`-`LEVEL_THREE`) sowohl ein Boden- als
  auch ein Decken-Segment auf fester Korridorhöhe bereitstellen, sodass der Bot in einem
  geschlossenen Gang läuft statt in einem nach oben offenen Level.
- WHEN die Korridorhöhe festgelegt wird SHALL DAS SYSTEM sie so bemessen, dass reguläre Sprünge
  (siehe `RaceScene.ts`: `JUMP_VELOCITY=-560`, Gravity=900, max. Sprunghöhe ≈174px) unter der
  Decke möglich bleiben, ohne dass ein normaler Sprung zwingend den Kopf stößt.
- WHEN ein Bot von unten gegen ein Decken-Segment springt SHALL DAS SYSTEM ihn wie bei einer
  soliden Plattform gemäß Standard-Arcade-Physik gegen die Decke kollidieren lassen (kein
  Durchspringen), analog zum bestehenden Kollisionsverhalten von Boden-Segmenten.
- WHEN `buildNearbyTiles`/`tileTypeAt` für Bots die Umgebung berechnen SHALL DAS SYSTEM
  Decken-Tiles korrekt als `"solid"` ausweisen (Erweiterung von `isSolidAt`/`tileTypeAt` in
  `level/tiles.ts`), damit Bots über den Bot-State-Vision-Contract (`docs/02-bot-api.md`) auch
  die Decke wahrnehmen können.
- WHEN `LEVEL_FOUR` geladen wird SHALL DAS SYSTEM Weltgröße (vergleichbare Größenordnung wie
  `LEVEL_ONE`-`LEVEL_THREE`, ca. 2400-3000px Breite), Spawn-Punkt, Ziel-Punkt, mindestens 3
  Checkpoints, sichtbare Münzen (ca. 10-15) und versteckte Blockmünzen (ca. 3-5) enthalten,
  analog zur bestehenden Struktur-Validierung der übrigen Level.
- WHEN Boden-Lücken in `LEVEL_FOUR` definiert werden SHALL DAS SYSTEM sie in einer mit
  `LEVEL_ONE`/`LEVEL_THREE` vergleichbaren, komfortablen Größenordnung halten (nicht enger als
  `LEVEL_TWO`s 170-210px), da das Level thematisch, nicht primär als Schwierigkeitssteigerung,
  eingeführt wird.
- WHEN Hazards in `LEVEL_FOUR` platziert werden SHALL DAS SYSTEM ausschließlich bereits
  bestehende Hazard-Typen aus `docs/08` wiederverwenden – kein neuer Hazard-Typ.

### US-2: Echte dunkelgraue Stein-Tiles für Boden UND Decke

Als Standbetreuer möchte ich, dass Boden und Decke in Level 4 mit den **tatsächlichen** dunklen,
grauen Stein-Tiles aus dem vorhandenen Terrain-Tileset dargestellt werden (nicht per Tint auf
den Gras-Tiles wie bei Level 3), damit das Level auch beim Terrain klar und "echt" als
Stein-/Höhlen-Untergrund erkennbar ist.

Akzeptanzkriterien:
- WHEN `LEVEL_FOUR` gerendert wird SHALL DAS SYSTEM für Boden- UND Decken-Segmente Tile-Frames
  aus dem grauen Stein-Bereich des vorhandenen Tilesets `Terrain (16x16).png` verwenden (nicht
  den bisherigen Gras-/Erd-Bereich Spalten 6-8), gemäß Projekt-Prinzip "keine neuen
  Bild-Asset-Dateien".
- WHEN das Decken-Terrain gezeichnet wird SHALL DAS SYSTEM die Stein-Tiles vertikal gespiegelt
  bzw. passend orientiert einsetzen, sodass die "Oberkante" der Decken-Optik sichtbar nach unten
  (Richtung Spielfläche) zeigt statt wie ein invertiertes Boden-Segment zu wirken.
- WHEN das Terrain-Rendering erweitert wird SHALL DAS SYSTEM dies additiv lösen (z.B. neuer
  Tile-Frame-Satz + ggf. Erweiterung von `terrainStyleRegistry.ts`/`paintTerrainSegment()` um
  einen Decken-Fall), ohne bestehendes Verhalten von `LEVEL_ONE`-`LEVEL_THREE` zu verändern
  (Open/Closed, keine Regression an deren Optik).
- WHEN `LEVEL_ONE`-`LEVEL_THREE` geladen werden SHALL DAS SYSTEM sich unverändert wie bisher
  verhalten (bestehendes Terrain-Rendering, keine Regression).

### US-3: Prozedural generierter Hintergrund im Stil von Super Mario Bros. Level 1-2

Als Standbetreuer möchte ich, dass Level 4 einen Hintergrund zeigt, der optisch an das klassische
Untergrund-Level 1-2 aus Super Mario Bros. erinnert (schwarzer Hintergrund, sich wiederholende
grünliche Backstein-/Blockstruktur), damit das Level auch im Hintergrund klar als "klassisches
Mario-Underground" erkennbar ist – abgegrenzt vom hellen Himmel-Hintergrund (Level 1/2) und vom
höhlenartigen "Night"-Hintergrund (Level 3).

Akzeptanzkriterien:
- WHEN `LEVEL_FOUR` geladen wird SHALL DAS SYSTEM einen neuen `backgroundKey` (z.B.
  `"underground"`) referenzieren, der auf einen neuen `BackgroundSpec`-Eintrag vom Kind
  `"procedural"` in der bestehenden `backgroundRegistry.ts` verweist (Open/Closed, kein
  Sonderfall in `worldBuilder.ts`).
- WHEN der Hintergrund gezeichnet wird SHALL DAS SYSTEM einen einheitlich schwarzen/sehr
  dunklen Grundton verwenden, überlagert von einem regelmäßigen Muster aus grünlichen
  Backstein-/Blockformen (angelehnt an die klassische SMB-1-2-Optik), analog zur Bau-Methode der
  bestehenden prozeduralen Hintergründe (`proceduralBackgrounds.ts`: Schichten aus einfachen
  Formen per Phaser-`Graphics`).
- WHEN der Hintergrund generiert wird SHALL DAS SYSTEM dies einmalig per Phaser-`Graphics`/
  `generateTexture` tun (keine neue Bild-Asset-Datei, keine Pro-Frame-Neuzeichnung), analog zu
  den bestehenden Hintergrund-Buildern.
- WHEN der Hintergrund gerendert wird SHALL DAS SYSTEM ihn wie die bisherigen Hintergründe über
  die gesamte Level-Breite mit Parallax-Scroll-Verhalten darstellen.

### US-4 (NFR): Saubere, skalierbare Architektur

Als Entwicklerteam möchten wir, dass dieses Feature nach SOLID, Clean Code (Uncle Bob) und
YAGNI/DRY/KISS umgesetzt wird, strikt testgetrieben.

Akzeptanzkriterien:
- WHEN `LEVEL_FOUR`, das Decken-Konzept, der neue Hintergrund und die neuen Terrain-Frames
  implementiert werden SHALL DAS SYSTEM diese in getrennten Modulen/Funktionen mit je einer
  Verantwortung abbilden (Single Responsibility), analog zur bestehenden Struktur aus
  `level-three-underground`.
- WHEN dieses Feature umgesetzt wird SHALL DAS SYSTEM strikt testgetrieben (Rot-Grün-Refactor)
  entwickelt werden; alle pure/testbare Logik (Level-Struktur-Validierung, Registry-Lookup,
  Decken-Solid-/Tile-Type-Erkennung in `level/tiles.ts`) SHALL DAS SYSTEM vor der jeweiligen
  Implementierung mit einem fehlschlagenden Test versehen.
- WHEN Phaser-Rendering-Code entsteht (prozeduraler Hintergrund, Decken-Terrain-Zeichnung), der
  nicht sinnvoll ohne echten Browser/Canvas testbar ist, SHALL DAS SYSTEM dies explizit als
  "nicht unit-getestet, manuell verifiziert" im Design dokumentieren (analog zu
  `level-three-underground`).

## Nicht-Ziele

- Kein neuer Hazard-Typ – ausschließlich Wiederverwendung bestehender Hazard-Kinds aus
  `docs/08`.
- Keine neuen Bild-Assets/Dateien – Hintergrund weiterhin prozedural, Terrain weiterhin aus dem
  vorhandenen Tileset `Terrain (16x16).png`.
- Keine generische "Decke für jedes beliebige Level" als konfigurierbares Feature für
  `LEVEL_ONE`-`LEVEL_THREE` – Decken-Unterstützung wird nur soweit gebaut, wie sie für
  `LEVEL_FOUR` gebraucht wird (YAGNI); die zugrunde liegende Erweiterung von `PlatformDef`/
  `tiles.ts` ist aber so zu gestalten, dass sie sich später ohne Bruch wiederverwenden ließe.
- Keine `/admin`-Fernsteuerung, keine automatische Schwierigkeitskurve/Level-Rotation über den
  Tag.
- Keine Änderung an Turniermodus/Scoring-Konstanten (`docs/05`/`docs/09`).
- Keine Animation der Hintergrund-Elemente (statische Muster, analog Level 2/3).
- Kein Umbenennen oder inhaltliches Ändern von `LEVEL_THREE` ("Night") – bleibt unverändert
  bestehen.

## Offene Fragen

- Exakte Korridorhöhe (Abstand Boden-Oberkante zu Decken-Unterkante) wird im Design als
  konkreter Pixelwert festgelegt, ausgehend von der maximalen Sprunghöhe (≈174px) plus
  Sicherheitsabstand.
- Ob die grauen Stein-Tiles aus dem bereits im Tileset vorhandenen "Castle"/"Grey-Block"-Bereich
  (siehe `Terrain (16x16).png`, Spalten 0-2 bzw. 12-14) direkt im bestehenden
  Top/Mid-Links/Mitte/Rechts-Schema wiederverwendbar sind oder ob für die Decke ein eigenes,
  vertikal gespiegeltes Frame-Mapping nötig ist, wird im Design nach genauer Sichtung der
  Tile-Geometrie entschieden.
- Ob durchgehend auf der ganzen Strecke eine Decke existiert, oder ob es (z.B. für die
  Bonus-/Schwebeplattform-Idee aus Level 3) einzelne offene Abschnitte ohne Decke gibt, wird im
  Design konkretisiert – Grundannahme laut dieser Requirements: durchgehend geschlossener
  Korridor über die gesamte Lauf-Strecke.

## Begleitende Doku-Updates

- `docs/06-level-design.md`: Ergänzung, dass nun vier Level existieren (Level 1 leicht,
  Level 2 schwer/Kaizo, Level 3 leicht/Night-Höhle, Level 4 thematisch/echtes
  Underground-Level mit Boden+Decke).
- `docs/08-hazards-und-utilities.md`: keine inhaltliche Änderung nötig (keine neuen
  Hazard-Typen).
