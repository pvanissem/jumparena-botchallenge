/**
 * Factory: einziger Ort, der ein Hazard-/Utility-Kind in ein konkretes
 * Phaser-Sprite + Physik-Body übersetzt. `RaceScene` bleibt Kind-agnostisch
 * (Open/Closed, siehe design.md Abschnitt "hazards/registry.ts").
 *
 * Bewusst nicht unit-getestet (Phaser/Canvas nötig, siehe design.md
 * Test-Strategie) – dünne Wiring-Schicht ohne eigene Verzweigungslogik über
 * die bereits getesteten `hazards/behaviors.ts`-Funktionen hinaus.
 */
import type Phaser from "phaser";
import { spriteScale } from "../assets/spriteSheets";
import type { HazardInstanceDef, UtilityInstanceDef } from "../level/types";
import { isTimedActive, patrolFacing, patrolX, pendulumOffset, spikeheadState } from "./behaviors";
import { HAZARD_REGISTRY, type HitboxSpec, UTILITY_REGISTRY } from "./registry";

export interface HazardInstance {
  sprite: Phaser.Physics.Arcade.Sprite;
  def: HazardInstanceDef;
}

export interface UtilityInstance {
  sprite: Phaser.Physics.Arcade.Sprite;
  def: UtilityInstanceDef;
}

/**
 * Setzt den Sprite-Scale (aus `SPRITE_SCALES`/`spriteScale()`, siehe
 * assets/spriteSheets.ts) für Hazards (dynamische Arcade-Bodies, erzeugt via
 * `scene.physics.add.group(...)` in `worldBuilder.buildHazards`).
 *
 * WICHTIG: Bei dynamischen Bodies synchronisiert Phaser Breite/Höhe/Position
 * JEDEN Frame automatisch mit `sprite.scaleX`/`scaleY`
 * (`Body.updateFromGameObject()` multipliziert `sourceWidth`/`sourceHeight`
 * sowie `(offset - displayOrigin)` intern bereits mit dem aktuellen Scale).
 * Die native (unskalierte) `HitboxSpec` aus der Registry daher UNVERÄNDERT an
 * `setSize`/`setOffset` übergeben – ein zusätzliches manuelles Multiplizieren
 * mit `scale` würde zu einer doppelten Skalierung UND einer aus dem Zentrum
 * verschobenen Hitbox führen (das war der ursprüngliche Bug).
 */
function applyDynamicHitbox(
  sprite: Phaser.Physics.Arcade.Sprite,
  hb: HitboxSpec,
  textureKey: string
): void {
  sprite.setScale(spriteScale(textureKey));
  sprite.body?.setSize(hb.width, hb.height);
  sprite.body?.setOffset(hb.offsetX ?? 0, hb.offsetY ?? 0);
}

/**
 * Setzt den Sprite-Scale für Utilities (statische Arcade-Bodies, erzeugt via
 * `scene.physics.add.staticGroup()` in `worldBuilder.buildUtilities`).
 *
 * Ein `StaticBody` synchronisiert sich laut Phaser-Doku NICHT automatisch mit
 * Skalierung/Origin des Game Objects ("if you make any change to the
 * parent's origin, position, or scale after creating or adding the body,
 * you'll need to update the Static Body manually") – Breite/Höhe/Offset
 * müssen hier daher explizit mit dem Skalierungsfaktor multipliziert werden,
 * analog zu den statischen Bodies in `worldBuilder.ts` (Fruits, Blöcke,
 * Checkpoints, Goal).
 */
function applyStaticHitbox(
  sprite: Phaser.Physics.Arcade.Sprite,
  hb: HitboxSpec,
  textureKey: string
): void {
  const scale = spriteScale(textureKey);
  sprite.setScale(scale);
  // `StaticBody.position` bleibt sonst auf der (unskalierten) Position zur
  // Erstellungszeit fixiert -> Basis-Position anhand der aktuellen,
  // skalierten Sprite-Bounding-Box neu einlesen, BEVOR die eigene
  // Hitbox-Größe/-Offset gesetzt wird (sonst landet die Hitbox verschoben
  // statt zentriert, siehe worldBuilder.ts `resyncStaticBody`).
  (sprite.body as Phaser.Physics.Arcade.StaticBody | undefined)?.updateFromGameObject();
  sprite.body?.setSize(hb.width * scale, hb.height * scale);
  sprite.body?.setOffset((hb.offsetX ?? 0) * scale, (hb.offsetY ?? 0) * scale);
}

function spawnPosition(def: HazardInstanceDef): { x: number; y: number } {
  if (def.kind === "kugelblitz") {
    return { x: def.pivotX, y: def.pivotY + def.length };
  }
  if (def.kind === "spikehead") {
    return { x: def.x, y: def.originY };
  }
  return { x: def.x, y: def.y };
}

export function createHazard(
  group: Phaser.Physics.Arcade.Group,
  def: HazardInstanceDef,
  depth: number
): HazardInstance {
  const spec = HAZARD_REGISTRY[def.kind];
  const pos = spawnPosition(def);

  const sprite = group.create(pos.x, pos.y, spec.texture) as Phaser.Physics.Arcade.Sprite;
  sprite.setDepth(depth);
  applyDynamicHitbox(sprite, spec.hitbox, spec.texture);
  if (spec.anim) sprite.play(spec.anim, true);
  if (spec.tint !== undefined) sprite.setTint(spec.tint);
  sprite.setData("id", def.id);
  sprite.setData("kind", def.kind);
  sprite.setData("stompable", spec.stompable);
  // Merkt sich den zuletzt dargestellten Aktiv-Zustand, damit `updateHazard`
  // Textur/Animation nur beim tatsächlichen Wechsel neu setzt (nicht jeden
  // Frame erneut) – siehe unten.
  sprite.setData("wasActive", true);

  return { sprite, def };
}

/**
 * Aktualisiert Position/Sichtbarkeit eines Hazard-Sprites gemäß der pure
 * `hazards/behaviors.ts`-Funktionen. Wird von `RaceScene` einmal pro Frame
 * für jeden Hazard aufgerufen. `hazardTriggeredAtMs` wird nur von
 * Trigger-Hazards (Spikehead) benötigt, wird der Einfachheit halber aber
 * einheitlich durchgereicht (dünne Wiring-Schicht, kein Sonderfall pro
 * Aufrufer nötig).
 */
export function updateHazard(
  instance: HazardInstance,
  elapsedMs: number,
  hazardTriggeredAtMs: ReadonlyMap<string, number>
): void {
  const { sprite, def } = instance;
  if (def.kind === "schnetzler" || def.kind === "ninjafrog") {
    sprite.x = patrolX(def, elapsedMs);
    // Nur der Ninja-Frog hat eine Blickrichtung; das Sprite läuft im Asset
    // nach rechts, beim Rückweg wird es gespiegelt.
    if (def.kind === "ninjafrog") sprite.setFlipX(patrolFacing(def, elapsedMs) === -1);
    return;
  }
  if (def.kind === "loderix") {
    updateLoderix(sprite, def, elapsedMs);
    return;
  }
  if (def.kind === "kugelblitz") {
    const offset = pendulumOffset(def, elapsedMs);
    sprite.x = def.pivotX + offset.x;
    sprite.y = def.pivotY + offset.y;
    return;
  }
  if (def.kind === "spikehead") {
    updateSpikehead(sprite, def, elapsedMs, hazardTriggeredAtMs);
    return;
  }
  // "stachlinger": statisch, keine Aktualisierung nötig.
}

/**
 * Setzt Position + Kollisions-Aktivität eines Spikehead gemäß der pure
 * `spikeheadState`-Funktion. Der Auslöse-Zeitpunkt selbst wird NICHT hier
 * ermittelt (das ist Racer-Positions-abhängig, siehe `RaceScene
 * .updateSpikeheadTriggers`) - diese Funktion liest ihn nur aus.
 */
function updateSpikehead(
  sprite: Phaser.Physics.Arcade.Sprite,
  def: Extract<HazardInstanceDef, { kind: "spikehead" }>,
  elapsedMs: number,
  hazardTriggeredAtMs: ReadonlyMap<string, number>
): void {
  const triggeredAt = hazardTriggeredAtMs.get(def.id);
  const msSinceTrigger = triggeredAt === undefined ? null : elapsedMs - triggeredAt;
  const state = spikeheadState(def, msSinceTrigger);
  sprite.y = state.y;
  if (sprite.body?.checkCollision) {
    sprite.body.checkCollision.none = !state.active;
  }
}

/**
 * Loderix zeigt im "Aus"-Zustand die erloschene Feuer-Textur (`inactiveTexture`,
 * `Traps/Fire/Off.png`) statt einfach unsichtbar zu werden – vorher sah ein
 * inaktives Loderix wie ein fehlendes Asset aus. Textur/Animation werden nur
 * beim tatsächlichen Aktiv/Inaktiv-Wechsel neu gesetzt (nicht jeden Frame).
 */
function updateLoderix(
  sprite: Phaser.Physics.Arcade.Sprite,
  def: Extract<HazardInstanceDef, { kind: "loderix" }>,
  elapsedMs: number
): void {
  const spec = HAZARD_REGISTRY.loderix;
  const active = isTimedActive(def, elapsedMs);
  const wasActive = sprite.getData("wasActive") as boolean;

  if (sprite.body?.checkCollision) {
    sprite.body.checkCollision.none = !active;
  }

  if (active === wasActive) return;
  sprite.setData("wasActive", active);

  if (active) {
    if (spec.anim) sprite.play(spec.anim, true);
  } else {
    sprite.anims.stop();
    if (spec.inactiveTexture) sprite.setTexture(spec.inactiveTexture);
  }
}

export function createUtility(
  group: Phaser.Physics.Arcade.StaticGroup,
  def: UtilityInstanceDef,
  depth: number
): UtilityInstance {
  const spec = UTILITY_REGISTRY[def.kind];
  // Ruhe-Darstellung ist die statische `texture` (kein idleAnim, siehe
  // registry.ts) – nur der Sprung-Auslöser wird als echte Animation gespielt.
  const sprite = group.create(def.x, def.y, spec.texture) as Phaser.Physics.Arcade.Sprite;
  sprite.setDepth(depth);
  applyStaticHitbox(sprite, spec.hitbox, spec.texture);
  sprite.setData("id", def.id);
  sprite.setData("kind", def.kind);

  return { sprite, def };
}
