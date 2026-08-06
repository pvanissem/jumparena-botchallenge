/**
 * Orchestriert Level, Racer, Steuerung und Spielregeln – siehe design.md,
 * Abschnitt "Ablauf/Sequenz", sowie `.features/arena-feel-and-graphics/bugfix.md`
 * für die Trennung von Tastatur-Frame-Input und Bot-Tick. Dünne Wiring-
 * Schicht: enthält selbst KEINE Spielregel-Entscheidungen (die liegen in
 * `rules/raceRules.ts`), bewusst nicht unit-getestet (Phaser/Canvas nötig),
 * manuell verifiziert.
 */
import type { Action, UtilityKind } from "@arena/bot-contract";
import Phaser from "phaser";
import { BotRunner, type BotRunnerPauseReasonKind } from "../../sandbox/BotRunner";
import { createBrowserWorker } from "../../sandbox/createBrowserWorker";
import { createAnimations } from "../assets/animations";
import { AUDIO_KEYS, AUDIO_SPECS, type AudioKey } from "../assets/audio";
import {
  BACKGROUND,
  FRUIT_FRAME,
  fruitSheetPath,
  SHEET_SPECS,
  SheetKeys,
  STATIC_IMAGE_KEYS,
  STATIC_IMAGE_SPECS,
} from "../assets/spriteSheets";
import { audioSettings } from "../audio/audioSettings";
import { BotController } from "../control/BotController";
import { KeyboardController } from "../control/KeyboardController";
import type { RacerController } from "../control/RacerController";
import { spikeheadState } from "../hazards/behaviors";
import { updateHazard } from "../hazards/factory";
import { UTILITY_REGISTRY } from "../hazards/registry";
import { DEFAULT_LEVEL_ID, getLevelById } from "../level/levelRegistry";
import { buildDynamicTileState } from "../level/tiles";
import type { FruitKind, LevelDef } from "../level/types";
import { FRUIT_VALUES } from "../level/types";
import {
  jumpVelocityForSpeed,
  MOVEMENT_TUNING,
  rampedSprintSpeed,
  shouldCutJump,
} from "../movement/movement";
import {
  applyBlockHit,
  applyCheckpointReached,
  applyCoinPickup,
  applyGoalReached,
  applyHazardContact,
  applyHazardTriggered,
  applyPitFall,
  applyTimeLimitReached,
  resolveHazardContact,
} from "../rules/raceRules";
import {
  createInitialRacerState,
  type RacerRuntimeState,
  RUN_TIME_LIMIT_MS,
} from "../rules/racerState";
import { buildBotState } from "../state/botStateBuilder";
import type { WorldSnapshot } from "../state/worldSnapshot";
import { type BuiltWorld, buildWorld, WORLD_DEPTH } from "../world/worldBuilder";

const BOT_TICK_INTERVAL_MS = 150;

// Wie oft die Live-HUD-Anzeige (Zeit/Coins) aktualisiert wird. ~10x/s reicht
// für eine flüssig wirkende Sekunden-Anzeige, ohne React zu überlasten.
const STATUS_EMIT_INTERVAL_MS = 100;
const STOMP_BOUNCE_VELOCITY = -280;
const BOINGO_JUMP_VELOCITY = -820;
/** Ab dieser horizontalen Geschwindigkeit gilt der Racer als "läuft" (Anim). */
const RUN_ANIM_THRESHOLD = 1;

export interface RaceSceneInitData {
  controllerMode: "keyboard" | "bot";
  /** Level-ID aus `LEVEL_REGISTRY` (siehe `level/levelRegistry.ts`). Default
   *  `DEFAULT_LEVEL_ID`, falls nicht angegeben (z.B. bestehende Aufrufer). */
  levelId?: string;
  botSourceCode?: string;
  /** Start-Leben für diesen Lauf (Default: `LIVES_PER_RUN`, siehe
   *  `racerState.ts`). `/dev` übergibt hier `Infinity`, damit ein Testlauf
   *  beim Ausprobieren nicht durch "keine Leben mehr"/DNF vorzeitig stoppt -
   *  im späteren Turniermodus bleibt der reguläre Wert relevant. */
  startingLives?: number;
  onStatusChange?: (status: {
    racer: RacerRuntimeState;
    pausedReason: string | null;
    pausedReasonKind: BotRunnerPauseReasonKind | null;
    lastRuntimeError: string | null;
    consecutiveFailureCount: number;
  }) => void;
  /** Wird einmalig am Ende von `create()` aufgerufen - erlaubt Aufrufern
   *  (z.B. `ArenaView`), erst danach sicher `setControllerMode(...)`
   *  aufzurufen (siehe dort: Vermeidung einer Race Condition mit dem noch
   *  laufenden `preload()`/`create()`-Lifecycle). */
  onReady?: () => void;
}

export class RaceScene extends Phaser.Scene {
  /** Wird garantiert in `init()` gesetzt, bevor `create()` läuft (Phaser-
   *  Lifecycle) - siehe `getLevelById`/`DEFAULT_LEVEL_ID`. */
  private level!: LevelDef;
  private world!: BuiltWorld;
  private player!: Phaser.Physics.Arcade.Sprite;
  private racer!: RacerRuntimeState;
  private controller!: RacerController;
  /** Nicht-null nur im Tastatur-Modus – erlaubt den Multi-Input-Sonderpfad
   *  (siehe `applyKeyboardInput`), ohne den `RacerController`-Contract für
   *  Bots zu verändern. */
  private keyboardController: KeyboardController | null = null;
  private botRunner: BotRunner | null = null;
  private elapsedMs = 0;
  private sinceLastBotTick = 0;
  // Drosselt die Live-HUD-Aktualisierung (Zeit/Coins), damit `onStatusChange`
  // nicht jeden Frame (~60x/s) einen React-Re-Render auslöst.
  private sinceLastStatusEmit = 0;
  private tickCounter = 0;
  /** Zuletzt vom Bot gelieferte Action – wird jeden Frame erneut angewendet,
   *  bis der nächste Bot-Tick eine neue liefert (nicht-blockierend). */
  private lastBotAction: Action = "idle";
  /** Wie lange ununterbrochen in dieselbe Richtung gesprintet wurde (siehe
   *  `movement/movement.ts#rampedSprintSpeed`) – 0, solange nicht gesprintet
   *  wird. */
  private sprintHoldMs = 0;
  /** Zeitpunkt (elapsedMs) des zuletzt ausgelösten Sprungs, oder `null`
   *  zwischen Sprüngen (siehe `movement/movement.ts#shouldCutJump`). */
  private jumpStartMs: number | null = null;
  /** Frame-Delta des aktuellen `update()`-Aufrufs – als Feld zwischengespeichert,
   *  da `applyKeyboardInput`/`applyBotAction`/`applyMovement` es für die
   *  Sprint-Rampe brauchen, aber (historisch) kein `delta`-Argument haben. */
  private currentDelta = 0;
  private initData: RaceSceneInitData = { controllerMode: "keyboard" };
  /** Rein visuelle Buchführung (nicht Teil des Racer-/Rules-State): welche
   *  Checkpoints haben ihre Hiss-Animation bereits gezeigt. */
  private activatedCheckpointIds = new Set<string>();
  private music: Phaser.Sound.BaseSound | null = null;
  private unsubscribeAudio: (() => void) | null = null;

  constructor() {
    super("RaceScene");
  }

  init(data: RaceSceneInitData): void {
    this.initData = data;
    this.level = getLevelById(data.levelId ?? DEFAULT_LEVEL_ID);
  }

  preload(): void {
    this.load.image(BACKGROUND.key, BACKGROUND.path);

    for (const spec of SHEET_SPECS) {
      this.load.spritesheet(spec.key, spec.path, {
        frameWidth: spec.frameWidth,
        frameHeight: spec.frameHeight,
      });
    }
    for (const spec of STATIC_IMAGE_SPECS) {
      this.load.image(spec.key, spec.path);
    }
    for (const fruit of Object.keys(FRUIT_VALUES) as FruitKind[]) {
      this.load.spritesheet(`fruit-${fruit}`, fruitSheetPath(fruit), {
        frameWidth: FRUIT_FRAME.width,
        frameHeight: FRUIT_FRAME.height,
      });
    }
    for (const spec of AUDIO_SPECS) {
      this.load.audio(spec.key, spec.path);
    }
  }

  create(): void {
    this.racer = createInitialRacerState(this.level, this.initData.startingLives);
    this.elapsedMs = 0;
    this.sinceLastBotTick = 0;
    this.tickCounter = 0;
    this.lastBotAction = "idle";
    this.sprintHoldMs = 0;
    this.jumpStartMs = null;
    this.activatedCheckpointIds = new Set<string>();

    createAnimations(this);
    this.world = buildWorld(this, this.level);

    this.player = this.physics.add.sprite(this.racer.x, this.racer.y, SheetKeys.PLAYER_IDLE);
    this.player.setDepth(10);
    this.player.setCollideWorldBounds(false);
    this.player.play("player-idle");

    this.physics.add.collider(this.player, this.world.solids);
    this.physics.add.overlap(this.player, this.world.coins, (_player, coin) =>
      this.onCoinOverlap(coin as Phaser.Physics.Arcade.Sprite)
    );
    this.physics.add.collider(this.player, this.world.blocks, (_player, block) =>
      this.onBlockCollide(block as Phaser.Physics.Arcade.Sprite)
    );
    this.physics.add.overlap(this.player, this.world.checkpoints, (_player, checkpoint) =>
      this.onCheckpointOverlap(checkpoint as Phaser.Physics.Arcade.Sprite)
    );
    this.physics.add.overlap(this.player, this.world.goal, () => this.onGoalOverlap());
    this.physics.add.overlap(this.player, this.world.utilityGroup, (_player, utility) =>
      this.onUtilityOverlap(utility as Phaser.Physics.Arcade.Sprite)
    );
    this.physics.add.overlap(this.player, this.world.hazardGroup, (_player, hazard) =>
      this.onHazardOverlap(hazard as Phaser.Physics.Arcade.Sprite)
    );

    this.controller = this.createController();
    // Sofortige Diagnose-Sichtbarkeit (Bezug: US-4 "bevor ein Testlauf
    // gestartet wird"): eine Guard-Ablehnung/ungültiges Modul pausiert den
    // BotRunner bereits synchron in init() - ohne diesen Aufruf würde das
    // erst mit dem ersten Bot-Tick (150ms später) sichtbar.
    this.notifyStatus();

    this.music = this.sound.add(AUDIO_KEYS.THEME, { loop: true });
    this.applyAudioVolume();
    this.music.play();
    this.unsubscribeAudio = audioSettings.subscribe(() => this.applyAudioVolume());

    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setBounds(0, 0, this.level.worldWidth, this.level.worldHeight);

    this.initData.onReady?.();
  }

  /** Wendet die aktuelle Master-Lautstärke (0 wenn stummgeschaltet) auf die
   *  laufende Hintergrundmusik an – wird initial und bei jeder Store-Änderung
   *  aufgerufen (siehe `audioSettings.subscribe` in `create()`). */
  private applyAudioVolume(): void {
    (this.music as Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound)?.setVolume(
      audioSettings.getEffectiveVolume()
    );
  }

  /** Spielt einen kurzen Soundeffekt einmalig mit der aktuellen
   *  Master-Lautstärke ab (Sprung/Collect). */
  private playSfx(key: AudioKey): void {
    this.sound.play(key, { volume: audioSettings.getEffectiveVolume() });
  }

  private createController(): RacerController {
    if (this.initData.controllerMode === "bot" && this.initData.botSourceCode) {
      this.botRunner = new BotRunner(createBrowserWorker());
      this.botRunner.init(this.initData.botSourceCode);
      return new BotController(this.botRunner);
    }
    const keys = this.input.keyboard?.createCursorKeys();
    this.keyboardController = new KeyboardController(keys as unknown as never);
    return this.keyboardController;
  }

  /**
   * Wechselt die Steuerungsquelle zur Laufzeit, OHNE Level/Racer-Fortschritt
   * (Position, Coins, Leben, Zeit) zurückzusetzen - nur "wer steuert das
   * Sprite" ändert sich. Nur nach `onReady` sicher aufrufbar (siehe
   * `RaceSceneInitData.onReady`), da vor Abschluss von `create()` weder
   * `this.input.keyboard` noch die übrige Szene verlässlich existieren.
   */
  setControllerMode(mode: "keyboard" | "bot", botSourceCode?: string): void {
    const unchanged =
      mode === this.initData.controllerMode &&
      (mode === "keyboard" || botSourceCode === this.initData.botSourceCode);
    if (unchanged) return;

    this.controller?.dispose();
    this.keyboardController = null;
    this.botRunner = null;
    this.initData = { ...this.initData, controllerMode: mode, botSourceCode };
    this.controller = this.createController();
    this.lastBotAction = "idle";
    this.notifyStatus();
  }

  update(_time: number, delta: number): void {
    if (this.racer.finished || this.racer.didNotFinish) return;

    this.currentDelta = delta;
    this.elapsedMs += delta;
    this.racer = { ...this.racer, timeElapsedMs: this.elapsedMs };

    for (const instance of this.world.hazardInstances) {
      updateHazard(instance, this.elapsedMs, this.racer.hazardTriggeredAtMs);
    }

    if (this.elapsedMs >= RUN_TIME_LIMIT_MS && !this.racer.finished) {
      this.racer = applyTimeLimitReached(this.racer);
      this.notifyStatus();
      return;
    }

    if (this.player.y > this.level.worldHeight + 100) {
      this.racer = applyPitFall(this.racer);
      this.player.setPosition(this.racer.x, this.racer.y);
      this.playSfx(AUDIO_KEYS.FALL);
      this.notifyStatus();
    }

    if (this.keyboardController) {
      // Tastatur: jeden Frame synchron gelesen, Multi-Input (Bewegung +
      // Sprung gleichzeitig) – siehe bugfix.md, "Root Cause" Punkt 1+2.
      this.applyKeyboardInput(this.keyboardController);
    } else {
      // Bot: eigenes, langsameres Tick-Raster, nicht-blockierend (siehe
      // `fireBotTick`) – die zuletzt aufgelöste Action wird bis zum nächsten
      // Tick jeden Frame erneut angewendet.
      this.sinceLastBotTick += delta;
      if (this.sinceLastBotTick >= BOT_TICK_INTERVAL_MS) {
        this.sinceLastBotTick = 0;
        this.fireBotTick();
      }
      this.applyBotAction(this.lastBotAction);
    }

    this.updatePlayerAnimation();
    this.syncRacerPositionFromPhysics();
    this.updateSpikeheadTriggers();

    // Live-HUD (Zeit/Coins) gedrosselt aktualisieren.
    this.sinceLastStatusEmit += delta;
    if (this.sinceLastStatusEmit >= STATUS_EMIT_INTERVAL_MS) {
      this.sinceLastStatusEmit = 0;
      this.notifyStatus();
    }
  }

  /**
   * Feuert einen Bot-Tick, OHNE den `update()`-Loop zu blockieren: Die
   * Promise wird nicht awaited, sondern füllt `lastBotAction` asynchron,
   * sobald der `BotRunner` antwortet (siehe bugfix.md, Fix-Ansatz A).
   */
  private fireBotTick(): void {
    const snapshot = this.buildSnapshot();
    const botState = buildBotState(snapshot, this.racer, this.tickCounter++);
    // `getNextAction` ist laut `RacerController`-Interface `Action |
    // Promise<Action>` (der Bot-Pfad liefert immer ein Promise, siehe
    // `BotController`) – `Promise.resolve` normalisiert beide Fälle einheitlich.
    void Promise.resolve(this.controller.getNextAction({ botState })).then((action) => {
      this.lastBotAction = action;
      this.notifyStatus();
    });
  }

  private buildSnapshot(): WorldSnapshot {
    const dynamic = buildDynamicTileState(this.level, this.racer, this.elapsedMs);
    return {
      level: this.level,
      dynamic,
      visibleCoins: this.level.coins
        .filter((c) => !this.racer.collectedCoinIds.has(c.id))
        .map((c) => ({ id: c.id, x: c.x, y: c.y, value: FRUIT_VALUES[c.fruit] })),
      hazards: this.level.hazards.map((h) => ({
        id: h.id,
        kind: h.kind,
        x: h.kind === "kugelblitz" ? h.pivotX : h.x,
        y: h.kind === "kugelblitz" ? h.pivotY : h.kind === "spikehead" ? h.fallToY : h.y,
        active: dynamic.activeHazardIds.has(h.id),
      })),
      utilities: this.level.utilities.map((u) => ({ id: u.id, kind: u.kind, x: u.x, y: u.y })),
    };
  }

  /**
   * Erkennt, wenn der Racer die Trigger-Zone eines Spikehead betritt (nur
   * relevant, wenn dessen aktueller Zyklus bereits abgeklungen ist -
   * `phase === "idle"`, siehe `spikeheadState`) und merkt den Auslöse-
   * Zeitpunkt im Racer-State (`applyHazardTriggered`). Rein positions-/
   * zeitbasiert, keine eigene Spielregel-Entscheidung über hinaus
   * (delegiert komplett an die pure `spikeheadState`-Funktion).
   */
  private updateSpikeheadTriggers(): void {
    for (const hazard of this.level.hazards) {
      if (hazard.kind !== "spikehead") continue;
      const triggeredAt = this.racer.hazardTriggeredAtMs.get(hazard.id);
      const msSinceTrigger = triggeredAt === undefined ? null : this.elapsedMs - triggeredAt;
      const phase = spikeheadState(hazard, msSinceTrigger).phase;
      if (phase !== "idle") continue;

      const inZone = this.racer.x >= hazard.triggerMinX && this.racer.x <= hazard.triggerMaxX;
      if (inZone) {
        this.racer = applyHazardTriggered(this.racer, hazard.id, this.elapsedMs);
      }
    }
  }

  /** Mehrachsiger Tastatur-Input: Bewegung, Sprung UND Sprint unabhängig, im selben Frame. */
  private applyKeyboardInput(keyboard: KeyboardController): void {
    const { dir, jump, sprint } = keyboard.getInput();
    this.applyMovement(dir, sprint, jump);
  }

  /** Einzelne Action (Bot-Contract) – links/rechts/sprint-links/sprint-rechts/springen/idle. */
  private applyBotAction(action: Action): void {
    if (action === "jump") {
      // Horizontale Bewegung/Sprint-Rampe bewusst UNVERÄNDERT lassen (siehe
      // .features/movement-sprint-and-variable-jump/requirements.md, US-3,
      // letztes Akzeptanzkriterium) - sonst wäre der Sprung-Boost für Bots
      // wirkungslos, da die Geschwindigkeit sonst in diesem Tick auf 0 fiele.
      this.applyJumpOnly(true);
      return;
    }
    if (action === "idle") {
      this.sprintHoldMs = 0;
      (this.player.body as Phaser.Physics.Arcade.Body).setVelocityX(0);
      this.applyJumpOnly(false);
      return;
    }

    const dir: -1 | 0 | 1 =
      action === "left" || action === "sprint-left"
        ? -1
        : action === "right" || action === "sprint-right"
          ? 1
          : 0;
    const sprint = action === "sprint-left" || action === "sprint-right";
    this.applyMovement(dir, sprint, false);
  }

  /**
   * Gemeinsame Bewegungs-Pipeline für Tastatur UND Bot (`left`/`right`/
   * `sprint-left`/`sprint-right`/Multi-Input-Richtung): pflegt die
   * Sprint-Rampe (`sprintHoldMs`), setzt die horizontale Geschwindigkeit
   * gemäß `rampedSprintSpeed`, delegiert die Sprung-/Cutoff-Logik an
   * `applyJumpOnly` (DRY - keine doppelte Sprung-Logik pro Steuerquelle).
   */
  private applyMovement(dir: -1 | 0 | 1, sprint: boolean, jumpHeld: boolean): void {
    const body = this.player.body as Phaser.Physics.Arcade.Body;

    if (dir !== 0 && sprint) {
      this.sprintHoldMs += this.currentDelta;
    } else if (dir !== 0) {
      this.sprintHoldMs = 0;
    }

    if (dir !== 0) {
      body.setVelocityX(dir * rampedSprintSpeed(this.sprintHoldMs));
      this.racer = { ...this.racer, facing: dir < 0 ? "left" : "right" };
    } else {
      body.setVelocityX(0);
    }

    this.applyJumpOnly(jumpHeld);
  }

  /**
   * Wendet NUR die Sprung-/Cutoff-Logik an, ohne horizontale
   * Velocity/Sprint-Rampe zu verändern (Bot-"jump"-Tick UND der
   * Sprung-Anteil von `applyMovement` teilen sich diese Logik, DRY).
   * Sprung-Boost (`jumpVelocityForSpeed`) nutzt die AKTUELLE horizontale
   * Geschwindigkeit des Bodies zum Absprungzeitpunkt (siehe design.md).
   */
  private applyJumpOnly(jumpHeld: boolean): void {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const onGround = body.blocked.down || body.touching.down;
    this.racer = { ...this.racer, onGround };

    if (onGround && this.jumpStartMs !== null) {
      this.jumpStartMs = null;
    }

    if (jumpHeld && onGround) {
      const currentSpeed = Math.abs(body.velocity.x) || MOVEMENT_TUNING.BASE_MOVE_SPEED;
      body.setVelocityY(jumpVelocityForSpeed(currentSpeed));
      this.jumpStartMs = this.elapsedMs;
      this.playSfx(AUDIO_KEYS.JUMP);
      return;
    }

    if (!onGround && this.jumpStartMs !== null && body.velocity.y < 0) {
      const msSinceJumpStart = this.elapsedMs - this.jumpStartMs;
      if (shouldCutJump(msSinceJumpStart, jumpHeld)) {
        body.setVelocityY(0);
      }
    }
  }

  /** Wählt Idle/Run/Jump/Fall/Hit-Animation + Blickrichtung nach Bewegungszustand. */
  private updatePlayerAnimation(): void {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const vx = body.velocity.x;
    const vy = body.velocity.y;
    const onGround = body.blocked.down || body.touching.down;

    this.player.setFlipX(this.racer.facing === "left");

    const current = this.player.anims.currentAnim?.key;
    if (current === "player-hit" && this.player.anims.isPlaying) return;

    const next = !onGround
      ? vy < 0
        ? "player-jump"
        : "player-fall"
      : Math.abs(vx) > RUN_ANIM_THRESHOLD
        ? "player-run"
        : "player-idle";

    if (current !== next) this.player.play(next, true);
  }

  private syncRacerPositionFromPhysics(): void {
    this.racer = { ...this.racer, x: this.player.x, y: this.player.y };
  }

  private onCoinOverlap(coin: Phaser.Physics.Arcade.Sprite): void {
    const id = coin.getData("id") as string;
    if (this.racer.collectedCoinIds.has(id)) return;
    const fruit = coin.getData("fruit") as keyof typeof FRUIT_VALUES;
    this.racer = applyCoinPickup(this.racer, id, FRUIT_VALUES[fruit]);
    this.playPickupEffect(coin.x, coin.y);
    this.playSfx(AUDIO_KEYS.COLLECT);
    coin.destroy();
  }

  private playPickupEffect(x: number, y: number): void {
    const pop = this.add.sprite(x, y, SheetKeys.FRUIT_COLLECTED).setDepth(20);
    pop.play("fruit-collected");
    pop.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => pop.destroy());
  }

  private onBlockCollide(block: Phaser.Physics.Arcade.Sprite): void {
    const id = block.getData("id") as string;
    if (this.racer.resolvedBlockIds.has(id)) return;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const hitFromBelow = body.blocked.up || body.touching.up;
    if (!hitFromBelow) return;

    this.racer = applyBlockHit(this.racer, id);

    // Kurzer "angestoßen"-Ruckler, danach zurück zur Idle-Textur (der Block
    // bleibt sichtbar/solide liegen – klassisches Mario-Verhalten: nur der
    // Inhalt wird einmalig freigegeben, der Block selbst verschwindet nicht).
    block.play("block-hit");
    block.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      block.setTexture(STATIC_IMAGE_KEYS.BLOCK_IDLE);
    });

    // Münze deutlich ÜBER dem Block spawnen (nicht exakt an derselben
    // Position), damit sie sichtbar vom weiterhin soliden Block getrennt ist.
    const fruit = block.getData("fruit") as FruitKind;
    const spawned = this.world.coins.create(
      block.x,
      block.y - 28,
      `fruit-${fruit}`
    ) as Phaser.Physics.Arcade.Sprite;
    spawned.play(`fruit-${fruit}-idle`);
    spawned.setData("id", id);
    spawned.setData("fruit", fruit);
    spawned.setDepth(WORLD_DEPTH.coin);
  }

  private onCheckpointOverlap(checkpoint: Phaser.Physics.Arcade.Sprite): void {
    const id = checkpoint.getData("id") as string;
    const def = this.level.checkpoints.find((c) => c.id === id);
    if (!def) return;
    this.racer = applyCheckpointReached(this.racer, def);

    if (this.activatedCheckpointIds.has(id)) return;
    this.activatedCheckpointIds.add(id);

    // Erstes Erreichen: Fahne einmalig hissen, danach dauerhaft winkend
    // (Fahnenstab ohne Fahne = noch nicht erreicht, siehe Chat-Verlauf).
    checkpoint.play("checkpoint-activate");
    checkpoint.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      checkpoint.play("checkpoint-idle");
    });
    this.playSfx(AUDIO_KEYS.CHECKPOINT);
  }

  private onGoalOverlap(): void {
    if (this.racer.finished) return;
    this.racer = applyGoalReached(this.racer);
    this.world.goal.play("goal-pressed");
    this.playSfx(AUDIO_KEYS.COMPLETE);
    this.notifyStatus();
  }

  private onUtilityOverlap(utility: Phaser.Physics.Arcade.Sprite): void {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    if (body.velocity.y <= 0) return;

    body.setVelocityY(BOINGO_JUMP_VELOCITY);
    this.playSfx(AUDIO_KEYS.BOINGO);

    const kind = utility.getData("kind") as UtilityKind;
    const spec = UTILITY_REGISTRY[kind];
    utility.play(spec.triggerAnim, true);
    utility.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      utility.setTexture(spec.texture);
    });
  }

  private onHazardOverlap(hazard: Phaser.Physics.Arcade.Sprite): void {
    const kind = hazard.getData("kind") as HazardKindLike;
    const id = hazard.getData("id") as string;
    const isActive = this.buildSnapshot().dynamic.activeHazardIds.has(id);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const contactFromAbove = body.velocity.y > 0 && this.player.y < hazard.y;

    const contact = resolveHazardContact(kind, isActive, contactFromAbove);
    if (contact === "none") return;
    if (contact === "stomped") {
      body.setVelocityY(STOMP_BOUNCE_VELOCITY);
      hazard.destroy();
      this.playSfx(AUDIO_KEYS.DAMAGED);
      return;
    }

    this.racer = applyHazardContact(this.racer, contact);
    this.player.setPosition(this.racer.x, this.racer.y);
    this.player.play("player-hit", true);
    this.playSfx(AUDIO_KEYS.PLAYER_DAMAGED);
    this.notifyStatus();
  }

  private notifyStatus(): void {
    this.initData.onStatusChange?.({
      racer: this.racer,
      pausedReason: this.botRunner?.pausedReason ?? null,
      pausedReasonKind: this.botRunner?.pausedReasonKind ?? null,
      lastRuntimeError: this.botRunner?.lastRuntimeError ?? null,
      consecutiveFailureCount: this.botRunner?.consecutiveFailureCount ?? 0,
    });
  }

  shutdown(): void {
    this.controller?.dispose();
    this.music?.stop();
    this.unsubscribeAudio?.();
  }
}

type HazardKindLike = Parameters<typeof resolveHazardContact>[0];
