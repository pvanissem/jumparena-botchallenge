# Requirements: Level-Two-Background

## Kontext

Betrifft die Hintergrund-Darstellung in `client/src/game/world/worldBuilder.ts` (aktuell ein
einzelner, per Level fest verdrahteter `tileSprite` mit der Textur `"background"`, geladen aus
`client/public/assets/Background/Blue.png`, siehe `RaceScene.preload()`).

Level 2 (`LEVEL_TWO`, siehe `.features/level-two-kaizo/`) soll einen eigenen, an klassisches
Super Mario Bros Level 1-1 angelehnten Hintergrund bekommen (blauer Himmel, Pixel-Wolken,
grüne Hügel-Silhouetten, Büsche). Das vorhandene Asset-Paket enthält nur einfarbige
Hintergrundbilder (kein Hügel-/Wolken-/Busch-Motiv) – der neue Hintergrund wird daher
prozedural per Phaser-Grafikcode erzeugt, nicht als neue Bild-Datei.

## User Stories

### US-1: Level-spezifischer Hintergrund

Als Entwicklerteam möchte ich, dass jedes Level einen eigenen Hintergrund referenzieren kann,
damit Level 2 (und künftige Level) einen anderen Hintergrund als Level 1 nutzen können, ohne
`worldBuilder.ts`/`RaceScene.ts` pro Level anzupassen (Open/Closed).

Akzeptanzkriterien:
- WHEN ein `LevelDef` geladen wird SHALL DAS SYSTEM ein Feld enthalten, das bestimmt, welcher
  Hintergrund für dieses Level verwendet wird.
- WHEN `LEVEL_ONE` keinen neuen Wert für dieses Feld setzt SHALL DAS SYSTEM sich unverändert
  wie bisher verhalten (bestehender einfarbiger Blue-Hintergrund, keine Regression).
- WHEN ein neuer Hintergrund-Typ hinzugefügt wird SHALL DAS SYSTEM dies über einen
  zusätzlichen Eintrag in einer zentralen Stelle ermöglichen, ohne Kind-spezifische
  Fallunterscheidungen im übrigen Rendering-Code zu benötigen (analog zur
  Hazard-/Utility-Registry aus `docs/08`).

### US-2: Prozeduraler SMB1-1-artiger Hintergrund für Level 2

Als Standbetreuer möchte ich, dass Level 2 einen Hintergrund zeigt, der an das klassische
Super Mario Bros Level 1-1 erinnert.

Akzeptanzkriterien:
- WHEN Level 2 geladen wird SHALL DAS SYSTEM einen Hintergrund mit blauem Himmel, mehreren
  Pixel-Wolken, grünen Hügel-Silhouetten und Büschen anzeigen, gezeichnet per
  Phaser-`Graphics`-API (keine neue Bild-Asset-Datei).
- WHEN der Hintergrund gezeichnet wird SHALL DAS SYSTEM ihn (wie den bisherigen Hintergrund)
  über die gesamte Level-Breite mit Parallax-Scroll-Verhalten darstellen, sodass er sich beim
  Durchlaufen des Levels sichtbar, aber langsamer als das Terrain bewegt.
- WHEN der Hintergrund generiert wird SHALL DAS SYSTEM dies einmalig (z.B. via
  `generateTexture`) tun, nicht pro Frame neu zeichnen (Performance).

### US-3 (NFR): Saubere Architektur

Als Entwicklerteam möchten wir, dass die prozedurale Hintergrund-Erzeugung als eigenes,
in sich geschlossenes Modul existiert, analog zu `hazards/factory.ts`/`world/worldBuilder.ts`.

Akzeptanzkriterien:
- WHEN der prozedurale Hintergrund implementiert wird SHALL DAS SYSTEM dies in einem neuen
  Modul kapseln, das ausschließlich von `worldBuilder.ts` aufgerufen wird.
- WHEN dieses Modul nicht sinnvoll ohne echten Browser/Canvas testbar ist SHALL DAS SYSTEM
  dies explizit als "nicht unit-getestet, manuell verifiziert" dokumentieren (analog zu
  `hazards/factory.ts`).

## Nicht-Ziele

- Keine neuen Bild-Assets/Dateien.
- Kein Tag-Nacht-Wechsel, keine Wetter-Effekte, keine Animation der Hintergrund-Elemente
  (statische Silhouetten wie im Original).
- Keine Änderung an Level 1s Hintergrund.

## Begleitende Doku-Updates

Keine – rein visuelle Ergänzung ohne Auswirkung auf `docs/02`, `docs/05`, `docs/06`, `docs/08`.
