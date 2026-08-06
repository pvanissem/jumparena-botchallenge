/**
 * Baut die statische+dynamische Spielwelt (Terrain, Münzen, versteckte
 * Blöcke, Checkpoints, Hazards, Utilities, Ziel) aus einem `LevelDef`. Dünne
 * Wiring-Schicht, bewusst nicht unit-getestet (siehe design.md).
 */
import type Phaser from "phaser";
import {
  fruitAnimKey,
  fruitTextureKey,
  SheetKeys,
  spriteScale,
  STATIC_IMAGE_KEYS,
  TERRAIN_TILES,
} from "../assets/spriteSheets";
import {
  createHazard,
  createUtility,
  type HazardInstance,
  type UtilityInstance,
} from "../hazards/factory";
import { TILE_SIZE } from "../level/tiles";
import type { LevelDef, PlatformDef } from "../level/types";
import { BACKGROUND_REGISTRY, DEFAULT_BACKGROUND_KEY } from "./backgroundRegistry";

export const WORLD_DEPTH = {
  bg: -10,
  terrain: 0,
  checkpoint: 3,
  goal: 4,
  coin: 5,
  hazard: 6,
  utility: 6,
  player: 10,
};

/**
 * Resynchronisiert die Basis-Position eines `StaticBody` mit der AKTUELLEN
 * (ggf. skalierten) Sprite-Bounding-Box.
 *
 * Hintergrund: `StaticBody.position` wird bei Erstellung anhand der
 * damaligen Sprite-Größe (Scale 1) berechnet und danach von Phaser NICHT
 * automatisch nachgeführt ("if you make any change to the parent's origin,
 * position, or scale after creating the body, you'll need to update the
 * Static Body manually" – Phaser-Doku). Ruft man nach `setScale(...)` direkt
 * `body.setSize(...)`/`setOffset(...)` auf, rechnet Phaser zwar den neuen
 * Offset korrekt anhand der aktuellen `displayWidth`/`displayHeight` aus,
 * addiert ihn aber auf die alte, noch unskalierte Basis-Position drauf ->
 * die Hitbox landet verschoben statt zentriert. `updateFromGameObject()`
 * liest die Basis-Position frisch über `sprite.getTopLeft()` (mit aktuellem
 * Scale) neu ein und behebt damit den Versatz.
 */
function resyncStaticBody(sprite: Phaser.Physics.Arcade.Sprite): void {
  (sprite.body as Phaser.Physics.Arcade.StaticBody | undefined)?.updateFromGameObject();
}

export interface BuiltWorld {
  solids: Phaser.Physics.Arcade.StaticGroup;
  coins: Phaser.Physics.Arcade.StaticGroup;
  blocks: Phaser.Physics.Arcade.StaticGroup;
  checkpoints: Phaser.Physics.Arcade.StaticGroup;
  goal: Phaser.Physics.Arcade.Sprite;
  hazardGroup: Phaser.Physics.Arcade.Group;
  hazardInstances: HazardInstance[];
  utilityGroup: Phaser.Physics.Arcade.StaticGroup;
  utilityInstances: UtilityInstance[];
}

export function buildWorld(scene: Phaser.Scene, level: LevelDef): BuiltWorld {
  buildBackground(scene, level);
  const solids = buildPlatforms(scene, level);
  const coins = buildCoins(scene, level);
  const blocks = buildHiddenBlocks(scene, level);
  const checkpoints = buildCheckpoints(scene, level);
  const goal = buildGoal(scene, level);
  const { hazardGroup, hazardInstances } = buildHazards(scene, level);
  const { utilityGroup, utilityInstances } = buildUtilities(scene, level);

  return {
    solids,
    coins,
    blocks,
    checkpoints,
    goal,
    hazardGroup,
    hazardInstances,
    utilityGroup,
    utilityInstances,
  };
}

function buildBackground(scene: Phaser.Scene, level: LevelDef): void {
  const spec = BACKGROUND_REGISTRY[level.backgroundKey ?? DEFAULT_BACKGROUND_KEY];
  const textureKey =
    spec.kind === "procedural" ? spec.buildTexture(scene, level.worldHeight) : spec.textureKey;

  scene.add
    .tileSprite(0, 0, level.worldWidth, level.worldHeight, textureKey)
    .setOrigin(0, 0)
    .setScrollFactor(0.3)
    .setDepth(WORLD_DEPTH.bg);
}

function buildPlatforms(scene: Phaser.Scene, level: LevelDef): Phaser.Physics.Arcade.StaticGroup {
  const solids = scene.physics.add.staticGroup();
  for (const p of level.platforms) {
    const segWidth = p.tilesWide * TILE_SIZE;
    const sprite = solids.create(
      p.x + segWidth / 2,
      p.y + TILE_SIZE / 2,
      SheetKeys.TERRAIN
    ) as Phaser.Physics.Arcade.Sprite;
    sprite.setVisible(false);
    sprite.setDisplaySize(segWidth, TILE_SIZE);
    sprite.refreshBody();

    if (p.kind === "float") {
      // Schwebeplattformen sind "Jump-Through"-Plattformen (klassisches
      // Platformer-Verhalten): von unten/seitlich durchspringbar, nur von
      // oben landbar. Arcade Physics realisiert das, indem man an der
      // Kollisionsprüfung des BODENS nur die Oberseite ("up") aktiv lässt.
      const staticBody = sprite.body as Phaser.Physics.Arcade.StaticBody;
      staticBody.checkCollision.up = true;
      staticBody.checkCollision.down = false;
      staticBody.checkCollision.left = false;
      staticBody.checkCollision.right = false;
    }

    paintTerrainSegment(scene, level, p);
  }
  return solids;
}

/**
 * Zeichnet ein Boden-/Plattform-Segment mit dem 3×2-Kachelset (Ober-/
 * Mittelkante × links/mitte/rechts), angelehnt an
 * `coin-quest-arena-tmp/src/game/race/worldBuilder.ts`. "ground"-Segmente
 * füllen bis zum Weltboden, "float"-Plattformen sind nur wenige Reihen dick.
 */
function paintTerrainSegment(scene: Phaser.Scene, level: LevelDef, platform: PlatformDef): void {
  const rows =
    platform.kind === "float" ? 2 : Math.ceil((level.worldHeight - platform.y) / TILE_SIZE);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < platform.tilesWide; col++) {
      const isTop = row === 0;
      const isLeft = col === 0;
      const isRight = col === platform.tilesWide - 1;

      const frame = isTop
        ? isLeft
          ? TERRAIN_TILES.topLeft
          : isRight
            ? TERRAIN_TILES.topRight
            : TERRAIN_TILES.topMid
        : isLeft
          ? TERRAIN_TILES.midLeft
          : isRight
            ? TERRAIN_TILES.midRight
            : TERRAIN_TILES.midMid;

      scene.add
        .image(
          platform.x + col * TILE_SIZE + TILE_SIZE / 2,
          platform.y + row * TILE_SIZE + TILE_SIZE / 2,
          SheetKeys.TERRAIN,
          frame
        )
        .setDepth(WORLD_DEPTH.terrain);
    }
  }
}

function buildCoins(scene: Phaser.Scene, level: LevelDef): Phaser.Physics.Arcade.StaticGroup {
  const coins = scene.physics.add.staticGroup();
  for (const c of level.coins) {
    const sprite = coins.create(c.x, c.y, fruitTextureKey(c.fruit)) as Phaser.Physics.Arcade.Sprite;
    sprite.setDepth(WORLD_DEPTH.coin);
    // Skalierungsfaktor kommt dynamisch aus `SPRITE_SCALES`/`spriteScale()`
    // (siehe assets/spriteSheets.ts) statt eines hartkodierten Faktors, damit
    // sich JEDES Sprite darüber tunen lässt.
    const scale = spriteScale(fruitTextureKey(c.fruit));
    sprite.setScale(scale);
    resyncStaticBody(sprite);
    sprite.play(fruitAnimKey(c.fruit));
    sprite.setData("id", c.id);
    sprite.setData("fruit", c.fruit);
    // Hitbox (Basis 20x20 in nativen Frame-Koordinaten) wächst/schrumpft mit
    // dem Skalierungsfaktor, damit die Fangzone optisch zur (skalierten)
    // Frucht passt. Arcade StaticBody.setSize() skaliert NICHT automatisch
    // mit dem Sprite-Scale, daher hier manuell multiplizieren; `center: true`
    // (Default) zentriert den Body neu auf dem skalierten Sprite.
    sprite.body?.setSize(20 * scale, 20 * scale);
  }
  return coins;
}

function buildHiddenBlocks(
  scene: Phaser.Scene,
  level: LevelDef
): Phaser.Physics.Arcade.StaticGroup {
  const blocks = scene.physics.add.staticGroup();
  for (const b of level.hiddenCoinBlocks) {
    const sprite = blocks.create(
      b.x,
      b.y,
      STATIC_IMAGE_KEYS.BLOCK_IDLE
    ) as Phaser.Physics.Arcade.Sprite;
    sprite.setDepth(WORLD_DEPTH.coin);
    // Idle-Textur ist exakt 28x24 – Body explizit darauf festlegen (statt sich
    // auf die Textur-Größe zu verlassen), damit die Kollisionsbox auch nach
    // einem Textur-/Frame-Wechsel (z.B. Hit-Animation) stabil bleibt.
    const scale = spriteScale(STATIC_IMAGE_KEYS.BLOCK_IDLE);
    sprite.setScale(scale);
    resyncStaticBody(sprite);
    sprite.body?.setSize(28 * scale, 24 * scale);
    sprite.setData("id", b.id);
    sprite.setData("fruit", b.fruit);
  }
  return blocks;
}

function buildCheckpoints(scene: Phaser.Scene, level: LevelDef): Phaser.Physics.Arcade.StaticGroup {
  const checkpoints = scene.physics.add.staticGroup();
  for (const c of level.checkpoints) {
    // Gleiche Boden-Ausrichtung wie das Ziel (`buildGoal`): `c.y` ist die
    // Baseline auf Bodenhöhe, das 64x64-Sprite hat zentrierten Origin ->
    // um die halbe Höhe anheben, damit die Fahnenstab-Basis auf dem Boden
    // steht statt in der Luft zu schweben.
    const sprite = checkpoints.create(
      c.x,
      c.y - 32,
      STATIC_IMAGE_KEYS.CHECKPOINT_POLE
    ) as Phaser.Physics.Arcade.Sprite;
    sprite.setDepth(WORLD_DEPTH.checkpoint);
    // Kein individueller Hitbox-Override -> Body-Größe generisch anhand der
    // (ggf. skalierten) Sprite-Displaygröße nachziehen, statt an der nativen
    // 64x64-Frame-Größe kleben zu bleiben.
    const scale = spriteScale(STATIC_IMAGE_KEYS.CHECKPOINT_POLE);
    sprite.setScale(scale);
    resyncStaticBody(sprite);
    sprite.body?.setSize(sprite.width * scale, sprite.height * scale);
    sprite.setData("id", c.id);
  }
  return checkpoints;
}

function buildGoal(scene: Phaser.Scene, level: LevelDef): Phaser.Physics.Arcade.Sprite {
  const goal = scene.physics.add.staticSprite(level.goal.x, level.goal.y - 32, SheetKeys.GOAL_IDLE);
  goal.setDepth(WORLD_DEPTH.goal);
  goal.play("goal-idle");
  const scale = spriteScale(SheetKeys.GOAL_IDLE);
  goal.setScale(scale);
  resyncStaticBody(goal);
  goal.body?.setSize(40 * scale, 96 * scale);
  goal.body?.setOffset(12 * scale, 8 * scale);
  return goal;
}

function buildHazards(
  scene: Phaser.Scene,
  level: LevelDef
): { hazardGroup: Phaser.Physics.Arcade.Group; hazardInstances: HazardInstance[] } {
  const hazardGroup = scene.physics.add.group({ allowGravity: false });
  const hazardInstances = level.hazards.map((def) =>
    createHazard(hazardGroup, def, WORLD_DEPTH.hazard)
  );
  return { hazardGroup, hazardInstances };
}

function buildUtilities(
  scene: Phaser.Scene,
  level: LevelDef
): { utilityGroup: Phaser.Physics.Arcade.StaticGroup; utilityInstances: UtilityInstance[] } {
  const utilityGroup = scene.physics.add.staticGroup();
  const utilityInstances = level.utilities.map((def) =>
    createUtility(utilityGroup, def, WORLD_DEPTH.utility)
  );
  return { utilityGroup, utilityInstances };
}
