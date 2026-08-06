/**
 * Prozeduraler, SMB1-1-artiger Hintergrund (blauer Himmel, Wolken, Hügel,
 * Büsche) – siehe `.features/level-two-background/design.md` sowie
 * `bugfix-treetops-and-clouds.md`. Zeichnet einmalig per Phaser-`Graphics`
 * in eine wiederverwendbare Textur (`generateTexture`), statt ein neues
 * Bild-Asset zu benötigen.
 *
 * Die Textur-Höhe entspricht IMMER exakt der Level-Höhe (`worldHeight`) –
 * sonst würde Phasers `tileSprite` die Textur auch vertikal kacheln und
 * die am unteren Rand gezeichneten Hügel/Büsche würden ein zweites Mal
 * mittig im Bild erscheinen ("schwebend", siehe bugfix-Dokument).
 *
 * Bewusst nicht unit-getestet (Phaser/Canvas-Rendering nötig, siehe
 * design.md Test-Strategie) – dünne, rein visuelle Wiring-Schicht ohne
 * Spielregel-Verzweigung.
 */
import type Phaser from "phaser";

const TEXTURE_KEY_PREFIX = "bg-smb1-1";
const TILE_W = 512;

const SKY_COLOR = 0x5c94fc; // klassisches SMB1-Himmelblau
const CLOUD_COLOR = 0xffffff;
const HILL_COLOR = 0x00b800; // helles NES-Grün (Kuppe)
const HILL_SHADOW_COLOR = 0x009000; // dunkleres Grün (Basis/Schatten)
const BUSH_COLOR = 0x00c000; // Kuppe
const BUSH_SHADOW_COLOR = 0x008800; // Basis

/**
 * Liefert den Textur-Key eines SMB1-1-artigen Hintergrunds für die
 * angegebene Welt-Höhe, erzeugt ihn bei Bedarf einmalig (idempotent pro
 * Höhe – unterschiedliche Level-Höhen bekommen eigene, gecachte Texturen).
 */
export function buildSmb1StyleBackgroundTexture(scene: Phaser.Scene, worldHeight: number): string {
  const textureKey = `${TEXTURE_KEY_PREFIX}-${worldHeight}`;
  if (scene.textures.exists(textureKey)) {
    return textureKey;
  }

  const g = scene.add.graphics();
  g.fillStyle(SKY_COLOR, 1);
  g.fillRect(0, 0, TILE_W, worldHeight);

  drawClouds(g, worldHeight);
  drawHills(g, worldHeight);
  drawBushes(g, worldHeight);

  g.generateTexture(textureKey, TILE_W, worldHeight);
  g.destroy();

  return textureKey;
}

/**
 * Wolkenform als mehrere überlappende Kreise in zwei Reihen (untere Reihe
 * größer/durchgehend, obere Reihe als "Puffs") – ergibt eine runde,
 * wolkige Silhouette ohne harte Kante. `variant` wählt eine von drei leicht
 * unterschiedlichen Kompositionen (Formvariation zwischen den Wolken).
 */
function drawCloud(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  scale: number,
  variant: 0 | 1 | 2
): void {
  g.fillStyle(CLOUD_COLOR, 1);

  // Untere Reihe: durchgehende Basis aus überlappenden, großen Kreisen.
  const baseRadius = 16 * scale;
  const baseCircles =
    variant === 1 ? [-24, -8, 8, 24].map((dx) => dx * scale) : [-20, 0, 20].map((dx) => dx * scale);
  for (const dx of baseCircles) {
    g.fillCircle(x + dx, y + 8 * scale, baseRadius);
  }

  // Obere Reihe: kleinere "Puffs" für die charakteristische Buckel-Silhouette.
  const puffs =
    variant === 2
      ? [
          { dx: -18, dy: -4, r: 11 },
          { dx: -2, dy: -12, r: 14 },
          { dx: 16, dy: -6, r: 10 },
        ]
      : variant === 1
        ? [
            { dx: -16, dy: -6, r: 10 },
            { dx: 0, dy: -14, r: 13 },
            { dx: 16, dy: -6, r: 10 },
            { dx: 30, dy: -2, r: 8 },
          ]
        : [
            { dx: -14, dy: -6, r: 11 },
            { dx: 4, dy: -12, r: 13 },
            { dx: 20, dy: -5, r: 9 },
          ];
  for (const puff of puffs) {
    g.fillCircle(x + puff.dx * scale, y + puff.dy * scale, puff.r * scale);
  }
}

function drawClouds(g: Phaser.GameObjects.Graphics, worldHeight: number): void {
  const topBand = Math.min(90, worldHeight * 0.2);
  drawCloud(g, 60, topBand, 1, 0);
  drawCloud(g, 230, topBand - 30, 0.85, 1);
  drawCloud(g, 400, topBand + 10, 1.1, 2);
  drawCloud(g, 480, topBand - 45, 0.75, 1);
}

/**
 * Hügel-Silhouette mit zweifarbiger Schattierung (dunklere Basis-Ellipse +
 * hellere, kleinere Kuppen-Ellipse obendrauf) für etwas mehr Textur/Tiefe
 * als eine einzelne flache Farbe. Verankert an `baseY` (= true Bodenlinie).
 */
function drawHill(
  g: Phaser.GameObjects.Graphics,
  x: number,
  baseY: number,
  radius: number,
  height: number
): void {
  g.fillStyle(HILL_SHADOW_COLOR, 1);
  g.fillEllipse(x, baseY, radius * 2, height);
  g.fillStyle(HILL_COLOR, 1);
  g.fillEllipse(x, baseY - height * 0.12, radius * 1.6, height * 0.75);
}

function drawHills(g: Phaser.GameObjects.Graphics, worldHeight: number): void {
  const baseY = worldHeight;
  // Mehr Hügel als zuvor, mit größerer Höhenvarianz (teils deutlich höher).
  drawHill(g, 40, baseY, 60, 90);
  drawHill(g, 150, baseY, 80, 130);
  drawHill(g, 300, baseY, 100, 160);
  drawHill(g, 420, baseY, 70, 100);
  drawHill(g, 500, baseY, 55, 80);
}

/**
 * Busch-Cluster aus mehreren überlappenden Kreisen mit zweifarbiger
 * Schattierung (analog zu den Hügeln), verankert an `baseY`.
 */
function drawBush(g: Phaser.GameObjects.Graphics, x: number, baseY: number, scale: number): void {
  const offsets = [-14, 0, 14, -7, 7].map((dx) => dx * scale);
  g.fillStyle(BUSH_SHADOW_COLOR, 1);
  for (const dx of offsets) {
    g.fillCircle(x + dx, baseY - 2 * scale, 13 * scale);
  }
  g.fillStyle(BUSH_COLOR, 1);
  for (const dx of offsets) {
    g.fillCircle(x + dx, baseY - 6 * scale, 10 * scale);
  }
}

function drawBushes(g: Phaser.GameObjects.Graphics, worldHeight: number): void {
  const baseY = worldHeight;
  drawBush(g, 100, baseY, 1);
  drawBush(g, 250, baseY, 0.85);
  drawBush(g, 380, baseY, 1.05);
}

// --- Level 3: dunkler, "Night"-artiger Hintergrund -----------------------

const NIGHT_TEXTURE_KEY_PREFIX = "bg-night";
const CAVE_BASE_COLOR = 0x0d0d1a; // fast schwarzer, leicht bläulicher Grundton
const CAVE_ROCK_FAR_COLOR = 0x1c1c2e; // entfernte Fels-Silhouette
const CAVE_ROCK_MID_COLOR = 0x2a2a40; // mittlere Fels-Ebene
const CAVE_ROCK_NEAR_COLOR = 0x38384f; // nahe Fels-Ebene (hellstes, weiterhin dunkel)
const CRYSTAL_GLOW_COLOR = 0x66e0ff; // helle Akzent-Kristalle/Glüh-Punkte

/**
 * Liefert den Textur-Key eines dunklen, "Night"-artigen Hintergrunds für die
 * angegebene Welt-Höhe (Level 3 "Night"), erzeugt ihn bei Bedarf
 * einmalig (idempotent pro Höhe), analog zu `buildSmb1StyleBackgroundTexture`.
 */
export function buildNightStyleBackgroundTexture(
  scene: Phaser.Scene,
  worldHeight: number
): string {
  const textureKey = `${NIGHT_TEXTURE_KEY_PREFIX}-${worldHeight}`;
  if (scene.textures.exists(textureKey)) {
    return textureKey;
  }

  const g = scene.add.graphics();
  g.fillStyle(CAVE_BASE_COLOR, 1);
  g.fillRect(0, 0, TILE_W, worldHeight);

  drawRockLayer(g, worldHeight, CAVE_ROCK_FAR_COLOR, 0.55, 1);
  drawRockLayer(g, worldHeight, CAVE_ROCK_MID_COLOR, 0.75, 2);
  drawRockLayer(g, worldHeight, CAVE_ROCK_NEAR_COLOR, 0.92, 3);
  drawCrystals(g, worldHeight);

  g.generateTexture(textureKey, TILE_W, worldHeight);
  g.destroy();

  return textureKey;
}

/**
 * Fels-Silhouette-Ebene aus überlappenden, spitzeren Dreiecken (statt der
 * runden Hügel-Ellipsen) am unteren Rand - wirkt kantiger/felsiger.
 * `seed` verschiebt die x-Positionen deterministisch zwischen den drei
 * Ebenen (keine Laufzeit-Zufälligkeit, identische Optik bei jedem Load).
 */
function drawRockLayer(
  g: Phaser.GameObjects.Graphics,
  worldHeight: number,
  color: number,
  heightFactor: number,
  seed: number
): void {
  const baseY = worldHeight;
  const layerHeight = worldHeight * heightFactor * 0.3;
  const offset = seed * 37;
  const peakXs = [20, 110, 200, 290, 380, 470].map((x) => (x + offset) % (TILE_W + 80) - 40);

  g.fillStyle(color, 1);
  for (const peakX of peakXs) {
    const peakHeight = layerHeight * (0.7 + ((peakX + seed * 13) % 5) / 10);
    g.fillTriangle(
      peakX - 70,
      baseY,
      peakX + 70,
      baseY,
      peakX,
      baseY - peakHeight
    );
  }
}

/** Wenige, dezente Kristall-Glühpunkte als rein dekorative Akzente. */
function drawCrystals(g: Phaser.GameObjects.Graphics, worldHeight: number): void {
  const spots = [
    { x: 60, y: worldHeight * 0.55 },
    { x: 170, y: worldHeight * 0.4 },
    { x: 260, y: worldHeight * 0.6 },
    { x: 340, y: worldHeight * 0.35 },
    { x: 440, y: worldHeight * 0.5 },
  ];
  g.fillStyle(CRYSTAL_GLOW_COLOR, 0.6);
  for (const spot of spots) {
    g.fillCircle(spot.x, spot.y, 4);
  }
}
