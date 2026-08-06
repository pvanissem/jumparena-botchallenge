# Bugfix: Level-2-Hintergrund – schwebende Hügel/Büsche & abgeschnittene Wolken

## Aktuelles Verhalten (Bug)

Die Hintergrund-Textur (`proceduralBackgrounds.ts`) ist 512×288px groß und wird als
`tileSprite` über die volle Level-Höhe (`LEVEL_TWO.worldHeight = 540`) gelegt. Da 540 > 288,
kachelt Phaser die Textur **auch vertikal** – die am unteren Rand der 288px-Kachel gezeichneten
Hügel/Büsche erscheinen dadurch ein zweites Mal mittig im Bild ("in der Luft schwebend").
Zusätzlich wirken die Wolken durch ein flach gezeichnetes Rechteck an ihrer Unterseite
"abgeschnitten" statt organisch/wolkig, und es gibt bisher nur 2-3 Hügel-/Wolkenformen ohne
Variation.

## Erwartetes Verhalten

- Hügel/Büsche sitzen ausschließlich am tatsächlichen unteren Rand der Welt (kein
  zweites, "schwebendes" Vorkommen weiter oben).
- Am Boden dürfen es gerne mehr, teils höhere Hügel mit etwas detaillierterer Textur sein
  (z.B. zweifarbiges Grün: dunklere Basis + hellere Kuppe).
- Wolken sehen runder/wolkiger aus (kein hartkantiges Rechteck an der Unterseite), mit etwas
  mehr Detail (mehrere überlappende Radien) und leichter Formvariation zwischen den Wolken.

## Was bleibt unverändert (Regressions-Schutz)

- Level 1 bleibt unberührt (`backgroundKey` weiterhin `undefined`/`"default"`).
- Weiterhin rein prozedural per Phaser-`Graphics` + `generateTexture` (kein neues Bild-Asset).
- Parallax-Scroll-Verhalten (`scrollFactor(0.3)`) und Depth (`WORLD_DEPTH.bg`) unverändert.
- `BACKGROUND_REGISTRY`-Struktur (Open/Closed) bleibt gleich, nur `buildSmb1StyleBackgroundTexture`
  bekommt zusätzlich die Level-Höhe als Parameter, um die Textur exakt darauf zuzuschneiden.

## Root Cause (nach Analyse)

Feste Textur-Höhe (288px) unabhängig von `level.worldHeight` (540px) → Phaser kachelt den
`tileSprite` vertikal → Boden-Elemente erscheinen doppelt.

## Fix-Ansatz

1. `buildSmb1StyleBackgroundTexture(scene, worldHeight)`: Textur-Höhe entspricht exakt
   `worldHeight` (keine vertikale Kachelung mehr nötig), Textur-Key inkl. Höhe
   (`bg-smb1-1-${worldHeight}`), damit unterschiedliche Level-Höhen nicht kollidieren.
2. Hügel/Büsche werden relativ zu `worldHeight` (statt der alten festen `TILE_H`) am unteren
   Rand verankert, mehr Instanzen, größere Höhenvarianz, zweifarbige Schattierung.
3. Wolken: neue, mehrteilige Kreis-Komposition ohne abschließendes Rechteck, mit 2-3 leicht
   unterschiedlichen Formvarianten (unterschiedliche Anzahl/Anordnung der "Puffs").
4. `BackgroundSpec.buildTexture`/`BACKGROUND_REGISTRY`/`worldBuilder.buildBackground` reichen
   `level.worldHeight` durch.
