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
export function buildNightStyleBackgroundTexture(scene: Phaser.Scene, worldHeight: number): string {
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
  const peakXs = [20, 110, 200, 290, 380, 470].map((x) => ((x + offset) % (TILE_W + 80)) - 40);

  g.fillStyle(color, 1);
  for (const peakX of peakXs) {
    const peakHeight = layerHeight * (0.7 + ((peakX + seed * 13) % 5) / 10);
    g.fillTriangle(peakX - 70, baseY, peakX + 70, baseY, peakX, baseY - peakHeight);
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

// --- Level 5: Wüsten-Hintergrund -----------------------------------------

const DESERT_TEXTURE_KEY_PREFIX = "bg-desert";
const DESERT_SKY_TOP = 0xf2c14e;
const DESERT_SKY_BOTTOM = 0xf7e1a0;
const SUN_COLOR = 0xfff3c4;
const DUNE_FAR_COLOR = 0xd9a441;
const DUNE_MID_COLOR = 0xc98f35;
const DUNE_NEAR_COLOR = 0xb87b2a;
const CACTUS_COLOR = 0x8a6a2a;

/**
 * Liefert den Textur-Key eines prozeduralen Wüsten-Hintergrunds für die
 * angegebene Welt-Höhe (Level 5 "Desert"), erzeugt ihn bei Bedarf
 * einmalig (idempotent pro Höhe). Analog zu den anderen prozeduralen
 * Hintergründen: Textur-Höhe = `worldHeight`, damit Phasers `tileSprite`
 * die Textur nicht auch vertikal kachelt (siehe Bugfix-Dokument zu
 * treetops-and-clouds).
 *
 * Siehe `.features/level-five-desert/design.md`, Abschnitt "Theming".
 */
export function buildDesertStyleBackgroundTexture(
  scene: Phaser.Scene,
  worldHeight: number
): string {
  const textureKey = `${DESERT_TEXTURE_KEY_PREFIX}-${worldHeight}`;
  if (scene.textures.exists(textureKey)) {
    return textureKey;
  }

  const g = scene.add.graphics();

  drawDesertSkyGradient(g, worldHeight);
  drawSun(g, worldHeight);
  drawDunes(g, worldHeight);
  drawCacti(g, worldHeight);

  g.generateTexture(textureKey, TILE_W, worldHeight);
  g.destroy();

  return textureKey;
}

function drawDesertSkyGradient(g: Phaser.GameObjects.Graphics, worldHeight: number): void {
  const bandHeight = Math.ceil(worldHeight / 6);
  for (let i = 0; i < 6; i++) {
    const t = i / 5;
    const hex = interpolateColor(DESERT_SKY_TOP, DESERT_SKY_BOTTOM, t);
    g.fillStyle(hex, 1);
    g.fillRect(0, i * bandHeight, TILE_W, bandHeight);
  }
}

function interpolateColor(from: number, to: number, t: number): number {
  const r1 = (from >> 16) & 0xff;
  const g1 = (from >> 8) & 0xff;
  const b1 = from & 0xff;
  const r2 = (to >> 16) & 0xff;
  const g2 = (to >> 8) & 0xff;
  const b2 = to & 0xff;
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return (r << 16) | (g << 8) | b;
}

function drawSun(g: Phaser.GameObjects.Graphics, worldHeight: number): void {
  const centerX = 400;
  const centerY = worldHeight * 0.22;
  const radius = 34;
  const haloRadius = 52;

  g.fillStyle(SUN_COLOR, 0.25);
  g.fillCircle(centerX, centerY, haloRadius);

  g.fillStyle(SUN_COLOR, 1);
  g.fillCircle(centerX, centerY, radius);
}

function drawDunes(g: Phaser.GameObjects.Graphics, worldHeight: number): void {
  const baseY = worldHeight;

  // Weit entfernte Dünen (heller durch Lufttrübung).
  g.fillStyle(DUNE_FAR_COLOR, 1);
  g.fillEllipse(180, baseY, 360, 110);
  g.fillEllipse(430, baseY, 280, 90);

  // Mittlere Ebene.
  g.fillStyle(DUNE_MID_COLOR, 1);
  g.fillEllipse(80, baseY, 260, 140);
  g.fillEllipse(320, baseY, 300, 160);

  // Nahe Ebene (dunkelste Silhouette).
  g.fillStyle(DUNE_NEAR_COLOR, 1);
  g.fillEllipse(220, baseY, 340, 130);
}

function drawCacti(g: Phaser.GameObjects.Graphics, worldHeight: number): void {
  const baseY = worldHeight;
  g.fillStyle(CACTUS_COLOR, 1);

  // Kaktus 1
  drawCactus(g, 80, baseY - 30, 1);
  // Kaktus 2 (kleiner)
  drawCactus(g, 460, baseY - 20, 0.7);
}

function drawCactus(g: Phaser.GameObjects.Graphics, x: number, baseY: number, scale: number): void {
  const stemW = 10 * scale;
  const stemH = 50 * scale;
  const armW = 8 * scale;
  const armH = 20 * scale;

  // Stamm
  g.fillRect(x - stemW / 2, baseY - stemH, stemW, stemH);
  // Rechter Arm
  g.fillRect(x, baseY - stemH * 0.55, armW, armH);
  // Linker Arm
  g.fillRect(x - armW, baseY - stemH * 0.4, armW, armH);
}

// --- Level 4: SMB-1-2-artiger "Underground"-Hintergrund -------------------

const UNDERGROUND_TEXTURE_KEY_PREFIX = "bg-underground";
const UNDERGROUND_BASE_COLOR = 0x000000; // klassisches SMB-Untergrund-Schwarz

/**
 * Liefert den Textur-Key eines SMB-1-2-artigen "Underground"-Hintergrunds für die angegebene
 * Welt-Höhe (Level 4), erzeugt ihn bei Bedarf einmalig (idempotent pro Höhe), analog zu
 * `buildSmb1StyleBackgroundTexture`/`buildNightStyleBackgroundTexture`. Das SMB-1-2-Vorbild
 * zeigt im Untergrund-Level eine durchgehend schwarze Fläche ohne jegliches Muster; die
 * Struktur kommt ausschließlich durch die blau getönten Terrain-Tiles (siehe
 * `terrainStyleRegistry.ts`).
 */
export function buildUndergroundStyleBackgroundTexture(
  scene: Phaser.Scene,
  worldHeight: number
): string {
  const textureKey = `${UNDERGROUND_TEXTURE_KEY_PREFIX}-${worldHeight}`;
  if (scene.textures.exists(textureKey)) {
    return textureKey;
  }

  const g = scene.add.graphics();
  g.fillStyle(UNDERGROUND_BASE_COLOR, 1);
  g.fillRect(0, 0, TILE_W, worldHeight);

  g.generateTexture(textureKey, TILE_W, worldHeight);
  g.destroy();

  return textureKey;
}

// --- Level 6: Eis-/Schnee-Hintergrund "Frost" ------------------------------

const ICE_TEXTURE_KEY_PREFIX = "bg-ice";
const ICE_SKY_TOP = 0x6fb7e0;
const ICE_SKY_BOTTOM = 0xeffbff;
const PALE_SUN_COLOR = 0xf3fbff;
const MOUNTAIN_FAR_COLOR = 0xdceffa;
const MOUNTAIN_MID_COLOR = 0xc7e3f2;
const MOUNTAIN_NEAR_COLOR = 0xb2d6ed;
const SNOW_DOT_COLOR = 0xffffff;

/**
 * Liefert den Textur-Key eines prozeduralen Eis-/Schnee-Hintergrunds für die
 * angegebene Welt-Höhe (Level 6 "Frost"), erzeugt ihn bei Bedarf einmalig
 * (idempotent pro Höhe). Analog zu `buildDesertStyleBackgroundTexture`:
 * Textur-Höhe = `worldHeight`, damit Phasers `tileSprite` die Textur nicht
 * auch vertikal kachelt (siehe Bugfix-Dokument zu treetops-and-clouds).
 *
 * Siehe `.features/level-six-frost/design.md`, Abschnitt "Theming".
 */
export function buildIceStyleBackgroundTexture(scene: Phaser.Scene, worldHeight: number): string {
  const textureKey = `${ICE_TEXTURE_KEY_PREFIX}-${worldHeight}`;
  if (scene.textures.exists(textureKey)) {
    return textureKey;
  }

  const g = scene.add.graphics();

  drawIceSkyGradient(g, worldHeight);
  drawPaleSun(g, worldHeight);
  drawMountains(g, worldHeight);
  drawSnowflakes(g, worldHeight);

  g.generateTexture(textureKey, TILE_W, worldHeight);
  g.destroy();

  return textureKey;
}

function drawIceSkyGradient(g: Phaser.GameObjects.Graphics, worldHeight: number): void {
  const bandHeight = Math.ceil(worldHeight / 6);
  for (let i = 0; i < 6; i++) {
    const t = i / 5;
    const hex = interpolateColor(ICE_SKY_TOP, ICE_SKY_BOTTOM, t);
    g.fillStyle(hex, 1);
    g.fillRect(0, i * bandHeight, TILE_W, bandHeight);
  }
}

/** Blasse "Wintersonne" – deutlich blasser/haziger als die Desert-Sonne. */
function drawPaleSun(g: Phaser.GameObjects.Graphics, worldHeight: number): void {
  const centerX = 400;
  const centerY = worldHeight * 0.2;
  const radius = 30;
  const haloRadius = 46;

  g.fillStyle(PALE_SUN_COLOR, 0.2);
  g.fillCircle(centerX, centerY, haloRadius);

  g.fillStyle(PALE_SUN_COLOR, 1);
  g.fillCircle(centerX, centerY, radius);
}

/**
 * Drei gestaffelte, verschneite Berg-Silhouetten am unteren Rand
 * (Dreieckszüge, an `baseY = worldHeight` verankert). Hinterste Ebene am
 * hellsten (Lufttrübung), gleiche Konvention wie die Desert-Dünen.
 */
function drawMountains(g: Phaser.GameObjects.Graphics, worldHeight: number): void {
  const baseY = worldHeight;

  g.fillStyle(MOUNTAIN_FAR_COLOR, 1);
  drawMountainRange(g, baseY, [
    { peakX: 60, halfWidth: 110, height: 150 },
    { peakX: 260, halfWidth: 130, height: 170 },
    { peakX: 440, halfWidth: 100, height: 130 },
  ]);

  g.fillStyle(MOUNTAIN_MID_COLOR, 1);
  drawMountainRange(g, baseY, [
    { peakX: 140, halfWidth: 120, height: 120 },
    { peakX: 340, halfWidth: 140, height: 140 },
  ]);

  g.fillStyle(MOUNTAIN_NEAR_COLOR, 1);
  drawMountainRange(g, baseY, [
    { peakX: 220, halfWidth: 150, height: 90 },
    { peakX: 480, halfWidth: 110, height: 80 },
  ]);
}

function drawMountainRange(
  g: Phaser.GameObjects.Graphics,
  baseY: number,
  peaks: ReadonlyArray<{ peakX: number; halfWidth: number; height: number }>
): void {
  for (const peak of peaks) {
    g.fillTriangle(
      peak.peakX - peak.halfWidth,
      baseY,
      peak.peakX + peak.halfWidth,
      baseY,
      peak.peakX,
      baseY - peak.height
    );
  }
}

/** Handvoll statischer Schneeflocken-Punkte als dezente Akzente. */
function drawSnowflakes(g: Phaser.GameObjects.Graphics, worldHeight: number): void {
  const spots = [
    { x: 40, y: worldHeight * 0.15 },
    { x: 150, y: worldHeight * 0.35 },
    { x: 250, y: worldHeight * 0.12 },
    { x: 330, y: worldHeight * 0.3 },
    { x: 410, y: worldHeight * 0.45 },
    { x: 470, y: worldHeight * 0.2 },
  ];
  g.fillStyle(SNOW_DOT_COLOR, 0.8);
  for (const spot of spots) {
    g.fillCircle(spot.x, spot.y, 3);
  }
}
