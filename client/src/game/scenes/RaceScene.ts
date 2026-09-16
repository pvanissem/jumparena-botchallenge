/**
 * Orchestriert Level, Racer, Steuerung und Spielregeln – siehe design.md,
 * Abschnitt "Ablauf/Sequenz", sowie `.features/arena-feel-and-graphics/bugfix.md`
 * für die Trennung von Tastatur-Frame-Input und Bot-Tick. Dünne Wiring-
 * Schicht: enthält selbst KEINE Spielregel-Entscheidungen (die liegen in
 * `rules/raceRules.ts`). Lifecycle-Wiring ist unit-getestet; reale Physik
 * braucht weiterhin eine Verifikation im Browser.
 */
import type { Action, UtilityKind } from "@arena/bot-contract";
import Phaser from "phaser";
import { BotRunner, type BotRunnerPauseReasonKind } from "../../sandbox/BotRunner";
import { createBrowserWorker } from "../../sandbox/createBrowserWorker";
import { createAnimations } from "../assets/animations";
import { AUDIO_KEYS, type AudioKey } from "../assets/audio";
import { preloadArenaAssets } from "../assets/preloadArenaAssets";
import { SheetKeys, STATIC_IMAGE_KEYS, spriteScale } from "../assets/spriteSheets";
import { audioSettings } from "../audio/audioSettings";
import { BotController } from "../control/BotController";
import { KeyboardController } from "../control/KeyboardController";
import type { RacerController } from "../control/RacerController";
import { spikeheadState } from "../hazards/behaviors";
import { updateHazard } from "../hazards/factory";
import { UTILITY_REGISTRY } from "../hazards/registry";
import { DEFAULT_LEVEL_ID, getLevelById } from "../level/levelRegistry";
import type { FruitKind, HazardInstanceDef, LevelDef } from "../level/types";
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
  isRacerTerminal,
  type RacerRuntimeState,
  RUN_TIME_LIMIT_MS,
} from "../rules/racerState";
import { buildBotState } from "../state/botStateBuilder";
import { computeHazardVelocities } from "../state/hazardVelocity";
import type { NavigationObservation, WorldRect, WorldSnapshot } from "../state/worldSnapshot";
import { BotRunRecorder } from "../trace/BotRunRecorder";
import { botRevisionForSource } from "../trace/botTraceIdentity";
import { RunTelemetryLifecycle } from "../trace/runLifecycle";
import type {
  BotRunTrace,
  NavigationDiagnostic,
  RacerSummaryInput,
  RunResult,
  TraceEventInput,
} from "../trace/types";
import { type BuiltWorld, buildWorld, WORLD_DEPTH } from "../world/worldBuilder";

const BOT_TICK_INTERVAL_MS = MOVEMENT_TUNING.BOT_TICK_INTERVAL_MS;

// Wie oft die Live-HUD-Anzeige (Zeit/Coins) aktualisiert wird. ~10x/s reicht
// für eine flüssig wirkende Sekunden-Anzeige, ohne React zu überlasten.
const STATUS_EMIT_INTERVAL_MS = 100;
// Covers accumulated floating-point error, not a fraction of a physics frame.
const TIME_LIMIT_EPSILON_MS = 0.000001;
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
  /** Optionaler Prüfstart an einem bestehenden Checkpoint in einer frischen Welt. */
  startCheckpointId?: string;
  onStatusChange?: (status: {
    racer: RacerRuntimeState;
    pausedReason: string | null;
    pausedReasonKind: BotRunnerPauseReasonKind | null;
    lastRuntimeError: string | null;
    consecutiveFailureCount: number;
    navigation?: NavigationDiagnostic;
  }) => void;
  /** Wird einmalig am Ende von `create()` aufgerufen - erlaubt Aufrufern
   *  (z.B. `ArenaView`), erst danach sicher `setControllerMode(...)`
   *  aufzurufen (siehe dort: Vermeidung einer Race Condition mit dem noch
   *  laufenden `preload()`/`create()`-Lifecycle). */
  onReady?: () => void;
  /** Kamera-Ausschnitt im Canvas. Default: ganzes Canvas (heutiges Verhalten). */
  viewport?: { x: number; y: number; width: number; height: number };
  /** Musik UND Soundeffekte dieser Szene. Default `true` (heutiges Verhalten).
   *  Im Match für ALLE Racer-Szenen `false`. */
  audio?: boolean;
  /** MatchBootScene hat den gemeinsamen Cache bereits vollständig geladen. */
  assetsPreloaded?: boolean;
  /** Nur `/dev`: ohne diese explizite Option bleibt Telemetrie vollständig aus. */
  telemetry?: { sessionId: string; onTrace: (trace: BotRunTrace) => void };
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
  private frameCounter = 0;
  private epoch = 0;
  private generation = 0;
  private botReady = false;
  private awaitingBotPhysics = false;
  private pendingDecision: Promise<void> | null = null;
  private pendingState: { tick: number; generation: number } | null = null;
  private lastDecision: { stateTick: number; stateFrame: number; epoch: number } | null = null;
  /** Zuletzt vom Bot gelieferte Actions – werden jeden Frame erneut angewendet,
   *  bis der nächste Bot-Tick neue liefert (nicht-blockierend). */
  private lastBotActions: Action[] = [];
  private lastNavigationDiagnostic: NavigationDiagnostic | undefined;
  /** Wie lange ununterbrochen in dieselbe Richtung gesprintet wurde (siehe
   *  `movement/movement.ts#rampedSprintSpeed`) – 0, solange nicht gesprintet
   *  wird. */
  private sprintHoldMs = 0;
  private sprintDirection: -1 | 0 | 1 = 0;
  private lastImpulse: NavigationObservation["lastImpulse"] = null;
  private impulse: NavigationObservation["movement"] = {
    jumpStartedAtMs: null,
    impulseKind: "none",
    impulseAtMs: null,
    sourceId: null,
  };
  /** Weltpositionen der Hazards zum Zeitpunkt des vorherigen Bot-Ticks – Basis
   *  für `computeHazardVelocities` (US-7, siehe `state/hazardVelocity.ts`). */
  private previousHazardPositions = new Map<string, { x: number; y: number }>();
  private previousHazardTickElapsedMs: number | null = null;
  /** Zeitpunkt (elapsedMs) des zuletzt ausgelösten Sprungs, oder `null`
   *  zwischen Sprüngen (siehe `movement/movement.ts#shouldCutJump`). */
  private jumpStartMs: number | null = null;
  /** Frame-Delta der aktuellen Physikvorbereitung – als Feld zwischengespeichert,
   *  da `applyKeyboardInput`/`applyBotAction`/`applyMovement` es für die
   *  Sprint-Rampe brauchen, aber (historisch) kein `delta`-Argument haben. */
  private currentDelta = 0;
  /** Ereignis-Flags für den State des nächsten Bot-Ticks: gesetzt, wenn seit dem
   *  letzten Bot-Tick ein Leben verloren / respawnt wurde. Nach dem Bau des
   *  BotState im jeweiligen Tick zurückgesetzt (siehe `fireBotTick`). */
  private pendingTookDamage = false;
  private pendingJustRespawned = false;
  private initData: RaceSceneInitData = { controllerMode: "keyboard" };
  /** Rein visuelle Buchführung (nicht Teil des Racer-/Rules-State): welche
   *  Checkpoints haben ihre Hiss-Animation bereits gezeigt. */
  private activatedCheckpointIds = new Set<string>();
  private music: Phaser.Sound.BaseSound | null = null;
  private unsubscribeAudio: (() => void) | null = null;
  private audioEnabled = true;
  /** Stellt sicher, dass `haltRacer()` nur einmal wirkt (der Früh-Ausstieg in
   *  `update()` würde es sonst jeden Frame erneut aufrufen). */
  private terminalHandled = false;
  private telemetry: RunTelemetryLifecycle | null = null;

  constructor(key = "RaceScene") {
    super(key);
  }

  init(data: RaceSceneInitData): void {
    this.initData = data;
    this.level = getLevelById(data.levelId ?? DEFAULT_LEVEL_ID);
    this.audioEnabled = data.audio ?? true;
  }

  preload(): void {
    if (!this.initData.assetsPreloaded) preloadArenaAssets(this);
  }

  create(): void {
    this.racer = createInitialRacerState(
      this.level,
      this.initData.startingLives,
      this.initData.startCheckpointId
    );
    this.elapsedMs = 0;
    this.sinceLastBotTick = 0;
    this.tickCounter = 0;
    this.frameCounter = 0;
    this.invalidateObservation();
    this.lastBotActions = [];
    this.pendingTookDamage = false;
    this.pendingJustRespawned = false;
    this.sprintHoldMs = 0;
    this.jumpStartMs = null;
    this.terminalHandled = false;
    this.activatedCheckpointIds = new Set<string>();

    if (this.initData.telemetry && this.initData.controllerMode === "bot") {
      this.telemetry = new RunTelemetryLifecycle(
        (initial) =>
          new BotRunRecorder({
            levelId: this.initData.levelId ?? DEFAULT_LEVEL_ID,
            sessionId: this.initData.telemetry?.sessionId ?? "unknown-session",
            botRevision: botRevisionForSource(this.initData.botSourceCode ?? ""),
            startedAt: new Date().toISOString(),
            initial,
          }),
        this.initData.telemetry.onTrace,
        this.traceSummary()
      );
    } else {
      this.telemetry = null;
    }

    createAnimations(this);
    this.world = buildWorld(this, this.level);

    this.player = this.physics.add.sprite(this.racer.x, this.racer.y, SheetKeys.PLAYER_IDLE);
    this.player.setDepth(10);
    this.player.setCollideWorldBounds(false);
    this.player.play("player-idle");
    // Spieler-Body ist ein DYNAMISCHER Arcade-Body: Phaser synchronisiert
    // Breite/Höhe/Position bei dynamischen Bodies jeden Frame automatisch mit
    // `sprite.scaleX/scaleY` (siehe `Body.updateFromGameObject()`), daher hier
    // die native (unskalierte) Hitbox-Größe übergeben – NICHT manuell mit dem
    // Skalierungsfaktor multiplizieren (das würde doppelt skalieren und die
    // Hitbox aus dem Zentrum schieben, siehe hazards/factory.ts).
    this.player.setScale(spriteScale(SheetKeys.PLAYER_IDLE));
    this.player.body?.setSize(
      MOVEMENT_TUNING.PLAYER_BODY_SIZE.width,
      MOVEMENT_TUNING.PLAYER_BODY_SIZE.height
    );

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

    // Lautstärke bewusst bereits in der `add()`-Config setzen: Phasers eigenes
    // `play()` setzt `currentConfig` auf diese Ausgangs-Config zurück und
    // wendet sie erneut an (`applyConfig()`, siehe
    // node_modules/phaser/src/sound/BaseSound.js) - ein `setVolume()`-Aufruf
    // VOR `play()` würde dadurch sofort wieder auf den Default (1.0)
    // zurückgesetzt. Der zusätzliche `applyAudioVolume()`-Aufruf NACH `play()`
    // fängt nur noch den seltenen Fall ab, dass sich die Einstellung zwischen
    // `add()` und `play()` geändert hat.
    if (this.audioEnabled) {
      this.music = this.sound.add(AUDIO_KEYS.THEME, {
        loop: true,
        volume: audioSettings.getEffectiveVolume(),
      });
      this.music.play();
      this.applyAudioVolume();
      this.unsubscribeAudio = audioSettings.subscribe(() => this.applyAudioVolume());
    }

    // Kamera-Ausschnitt für den Turniermodus (Grid mehrerer Racer-Szenen im
    // selben Canvas). Ohne `viewport` bleibt es beim Vollbild-Default.
    if (this.initData.viewport) {
      const { x, y, width, height } = this.initData.viewport;
      this.cameras.main.setViewport(x, y, width, height);
    }

    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setBounds(0, 0, this.level.worldWidth, this.level.worldHeight);

    // Arcade registers its POST_UPDATE body->sprite sync before create().
    this.events.on("preupdate", this.preparePhysics, this);
    this.events.on("postupdate", this.observeAndAct, this);
    this.events.once("shutdown", this.shutdown, this);
    this.events.once("destroy", this.shutdown, this);
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
    if (!this.audioEnabled) return;
    this.sound.play(key, { volume: audioSettings.getEffectiveVolume() });
  }

  private createController(): RacerController {
    if (this.initData.controllerMode === "bot" && this.initData.botSourceCode) {
      this.botReady = false;
      this.awaitingBotPhysics = true;
      this.physics.world.pause();
      this.botRunner = new BotRunner(createBrowserWorker(), {
        observer: {
          onDecision: (result) => {
            if (this.pendingState?.generation !== this.generation) return;
            this.lastNavigationDiagnostic = result.kind === "ok" ? result.navigation : undefined;
            this.telemetry?.current?.recordDecision({
              ...result,
              tick: this.pendingState.tick,
            });
          },
          onPaused: (reason, message) => {
            this.lastBotActions = [];
            this.lastDecision = null;
            this.lastNavigationDiagnostic = undefined;
            if (reason === "disposed") return;
            this.notifyStatus();
            this.recordTraceEvent("bot-paused", { reason, message });
            this.finishTrace("bot-paused", reason);
          },
        },
      });
      const runner = this.botRunner;
      runner.init(this.initData.botSourceCode);
      void runner.whenReady().then((ready) => {
        if (this.botRunner === runner) this.botReady = ready && runner.status === "running";
      });
      return new BotController(this.botRunner);
    }
    if (this.awaitingBotPhysics) this.physics.world.resume();
    this.awaitingBotPhysics = false;
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

    this.finishTrace("aborted", "manual-mode");
    this.invalidateObservation();
    this.controller?.dispose();
    this.keyboardController = null;
    this.botRunner = null;
    this.initData = { ...this.initData, controllerMode: mode, botSourceCode };
    if (mode === "bot" && this.initData.telemetry) {
      this.telemetry = new RunTelemetryLifecycle(
        (initial) =>
          new BotRunRecorder({
            levelId: this.initData.levelId ?? DEFAULT_LEVEL_ID,
            sessionId: this.initData.telemetry?.sessionId ?? "unknown-session",
            botRevision: botRevisionForSource(this.initData.botSourceCode ?? ""),
            startedAt: new Date().toISOString(),
            initial,
          }),
        this.initData.telemetry.onTrace,
        this.traceSummary()
      );
    } else {
      this.telemetry = null;
    }
    this.controller = this.createController();
    this.lastBotActions = [];
    this.notifyStatus();
  }

  private preparePhysics(_time: number, delta: number): void {
    if (isRacerTerminal(this.racer)) {
      this.haltRacer();
      return;
    }
    if (this.botRunner && !this.botReady) return;
    if (this.awaitingBotPhysics) {
      this.physics.world.resume();
      this.awaitingBotPhysics = false;
    }
    this.currentDelta = delta;
    this.frameCounter += 1;
    // Apply once, at step start: replies since POST_UPDATE affect the next
    // Arcade update. Promise callbacks only replace the held input.
    if (this.keyboardController) {
      this.applyKeyboardInput(this.keyboardController);
    } else {
      const appliedActions = this.applyBotActions(this.lastBotActions);
      if (this.lastDecision) {
        this.telemetry?.current?.recordEvent({
          kind: "action-applied",
          tick: this.lastDecision.stateTick,
          timeMs: Math.round(this.elapsedMs),
          position: { x: this.racer.x, y: this.racer.y },
          details: {
            ...this.lastDecision,
            appliedFrame: this.frameCounter,
            actions: JSON.stringify(appliedActions),
          },
        });
        this.lastDecision = null;
      }
    }
    const nextElapsedMs = this.elapsedMs + delta;
    this.elapsedMs =
      nextElapsedMs >= RUN_TIME_LIMIT_MS - TIME_LIMIT_EPSILON_MS
        ? RUN_TIME_LIMIT_MS
        : nextElapsedMs;
    this.racer = { ...this.racer, timeElapsedMs: this.elapsedMs };
    for (const instance of this.world.hazardInstances) {
      if (instance.sprite.active && instance.sprite.body?.enable) {
        updateHazard(instance, this.elapsedMs, this.racer.hazardTriggeredAtMs);
      }
    }
  }

  private observeAndAct(_time: number, delta: number): void {
    if (this.botRunner && !this.botReady) return;
    if (!this.terminalHandled) this.syncRacerPositionFromPhysics();
    if (isRacerTerminal(this.racer)) {
      // Einmalig aktiv stoppen: Ohne das behält der Arcade-Body seine letzte
      // Geschwindigkeit und die Gravitation wirkt weiter – der Racer würde
      // sichtbar weiterrutschen bzw. aus dem Level fallen, obwohl er raus ist
      // (siehe `.features/tournament-lives/`, US-2).
      this.haltRacer();
      return;
    }

    if (this.elapsedMs >= RUN_TIME_LIMIT_MS && !this.racer.finished) {
      this.finishTrace("time-limit", "time-limit");
      this.racer = applyTimeLimitReached(this.racer);
      this.haltRacer();
      return;
    }

    if (this.player.y > this.level.worldHeight + 100) {
      const deathPosition = { x: this.player.x, y: this.player.y };
      this.recordTraceEvent("pit-fall", undefined, deathPosition);
      this.finishTrace("death", "pit-fall", { ...this.traceSummary(), position: deathPosition });
      this.racer = applyPitFall(this.racer);
      this.markDamageAndRespawn();
      (this.player.body as Phaser.Physics.Arcade.Body).reset(this.racer.x, this.racer.y);
      this.telemetry?.start(this.traceSummary());
      this.playSfx(AUDIO_KEYS.FALL);
      this.notifyStatus();
    }

    if (!this.keyboardController) {
      // Observe completed physics; request the input for a following PRE_UPDATE.
      this.sinceLastBotTick += delta;
      if (this.sinceLastBotTick >= BOT_TICK_INTERVAL_MS) {
        this.sinceLastBotTick %= BOT_TICK_INTERVAL_MS;
        this.fireBotTick();
      }
    }

    this.updatePlayerAnimation();
    this.updateSpikeheadTriggers();
    this.telemetry?.advance(delta, this.traceSummary());

    // Live-HUD (Zeit/Coins) gedrosselt aktualisieren.
    this.sinceLastStatusEmit += delta;
    if (this.sinceLastStatusEmit >= STATUS_EMIT_INTERVAL_MS) {
      this.sinceLastStatusEmit = 0;
      this.notifyStatus();
    }
  }

  /**
   * Hält den Racer endgültig an, sobald er das Ziel erreicht hat oder
   * ausgeschieden ist. Läuft genau einmal pro Szene.
   *
   * Warum das nötig ist: `update()` steigt bei einem Endzustand früh aus, die
   * Arcade-Physik läuft aber weiter. Ohne aktiven Stopp behält der Body seine
   * Restgeschwindigkeit und fällt weiter – der ausgeschiedene Bot sieht für das
   * Publikum aus, als würde er einfach weiterspielen.
   */
  private haltRacer(): void {
    if (this.terminalHandled) return;
    this.terminalHandled = true;
    this.physics.world.pause();
    this.invalidateObservation();

    const body = this.player.body as Phaser.Physics.Arcade.Body | null;
    if (body) {
      body.setVelocity(0, 0);
      body.setAcceleration(0, 0);
      body.setAllowGravity(false);
      body.moves = false;
    }

    // Bot-Worker freigeben: keine weiteren `decide`-Aufrufe (US-2).
    this.controller?.dispose();
    this.lastBotActions = [];

    // Die Kamera soll nicht weiter einem stehenden Sprite folgen.
    this.cameras.main.stopFollow();

    if (this.racer.didNotFinish) {
      this.dimRacerSprite();
    }

    this.notifyStatus();
  }

  /** Visuelle Abdunklung eines ausgeschiedenen Racers. Das Ergebnis-Fenster
   *  wird in `/present` als React-Overlay über der Kachel gerendert; hier
   *  bleibt nur die sprite-basierte Rückmeldung, damit der Bot nicht
   *  scheinbar weiterläuft (US-1 Regressions-Schutz). */
  private dimRacerSprite(): void {
    this.player.setTint(0x555566);
    this.player.setAlpha(0.55);
    this.player.anims.stop();
  }

  /**
   * Feuert einen Bot-Tick, OHNE den `update()`-Loop zu blockieren: Die
   * Promise wird nicht awaited, sondern füllt `lastBotActions` asynchron,
   * sobald der `BotRunner` antwortet (siehe bugfix.md, Fix-Ansatz A).
   */
  private fireBotTick(): void {
    if (
      this.pendingDecision ||
      (this.botRunner && (!this.botReady || this.botRunner.status === "paused")) ||
      isRacerTerminal(this.racer)
    )
      return;
    const generation = this.generation;
    const epoch = this.epoch;
    const stateFrame = this.frameCounter;
    this.syncRacerPositionFromPhysics();
    const snapshot = this.buildSnapshot();
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const botState = buildBotState(snapshot, this.racer, this.tickCounter++, {
      velocity: { vx: body.velocity.x, vy: body.velocity.y },
      isSprinting: this.sprintHoldMs > 0,
      sprintHoldMs: this.sprintHoldMs,
      justRespawned: this.pendingJustRespawned,
      tookDamage: this.pendingTookDamage,
      navigation: {
        epoch,
        frame: this.frameCounter,
        observedAtMs: this.elapsedMs,
        physicsStepMs: 1000 / this.physics.world.fps,
        body: this.bodyBounds(body),
        movement: { ...this.impulse, jumpStartedAtMs: this.jumpStartMs },
        lastImpulse: this.lastImpulse ? { ...this.lastImpulse } : null,
      },
    });
    this.telemetry?.current?.recordState(botState);
    // Ereignis-Flags gelten nur für den EINEN Tick unmittelbar nach dem
    // Ereignis – nach dem Konsum zurücksetzen.
    this.pendingJustRespawned = false;
    this.pendingTookDamage = false;

    // `getNextActions` ist laut `RacerController`-Interface `Action[] |
    // Promise<Action[]>` (der Bot-Pfad liefert immer ein Promise, siehe
    // `BotController`) – `Promise.resolve` normalisiert beide Fälle einheitlich.
    this.pendingState = { tick: botState.tick, generation };
    const pending = Promise.resolve(this.controller.getNextActions({ botState }))
      .then((actions) => {
        if (
          generation !== this.generation ||
          isRacerTerminal(this.racer) ||
          this.botRunner?.status === "paused"
        )
          return;
        this.lastBotActions = actions;
        this.lastDecision = {
          stateTick: botState.tick,
          stateFrame,
          epoch,
        };
        this.notifyStatus();
      })
      .finally(() => {
        if (this.pendingDecision === pending) {
          this.pendingDecision = null;
          this.pendingState = null;
        }
      });
    this.pendingDecision = pending;
  }

  private invalidateObservation(): void {
    this.generation += 1;
    this.epoch += 1;
    this.lastImpulse = null;
    this.previousHazardPositions.clear();
    this.previousHazardTickElapsedMs = null;
    this.lastBotActions = [];
    this.lastDecision = null;
    this.lastNavigationDiagnostic = undefined;
    this.sprintHoldMs = 0;
    this.sprintDirection = 0;
    this.jumpStartMs = null;
    this.impulse = {
      jumpStartedAtMs: null,
      impulseKind: "none",
      impulseAtMs: null,
      sourceId: null,
    };
  }

  /** Merkt Schadens-/Respawn-Ereignis für den nächsten Bot-Tick-State (US-7).
   *  Jeder Lebensverlust im aktuellen Spiel ist zugleich ein Respawn. */
  private markDamageAndRespawn(): void {
    this.invalidateObservation();
    this.pendingTookDamage = true;
    this.pendingJustRespawned = true;
  }

  private buildSnapshot(): WorldSnapshot {
    const hazards = this.world.hazardInstances.flatMap(({ sprite, def }) => {
      const body = sprite.body;
      if (!sprite.active || !body?.enable || this.racer.destroyedHazardIds.has(def.id)) return [];
      return [
        {
          id: def.id,
          kind: def.kind,
          x: sprite.x,
          y: sprite.y,
          bounds: this.bodyBounds(body),
          active: !body.checkCollision.none,
          warning: this.isHazardWarning(def),
        },
      ];
    });
    const blocks = (this.world.blocks.getChildren() as Phaser.Physics.Arcade.Sprite[]).flatMap(
      (sprite) => {
        const body = sprite.body;
        if (!sprite.active || !body?.enable) return [];
        return [
          {
            id: sprite.getData("id") as string,
            bounds: this.bodyBounds(body),
          },
        ];
      }
    );
    const dynamic = {
      activeHazardIds: new Set(hazards.filter((h) => h.active).map((h) => h.id)),
      resolvedBlockIds: this.racer.resolvedBlockIds,
      hazards,
      blocks,
    };
    const hazardPositions = hazards.map((h) => ({
      id: h.id,
      x: h.x,
      y: h.y,
    }));
    const deltaMs =
      this.previousHazardTickElapsedMs === null
        ? 0
        : this.elapsedMs - this.previousHazardTickElapsedMs;
    const velocities = computeHazardVelocities(
      hazardPositions,
      this.previousHazardPositions,
      deltaMs
    );
    this.previousHazardPositions = new Map(hazardPositions.map((h) => [h.id, { x: h.x, y: h.y }]));
    this.previousHazardTickElapsedMs = this.elapsedMs;

    return {
      levelId: this.initData.levelId ?? DEFAULT_LEVEL_ID,
      level: this.level,
      dynamic,
      goalBounds:
        this.world.goal.active && this.world.goal.body?.enable
          ? this.bodyBounds(this.world.goal.body)
          : undefined,
      checkpoints: (this.world.checkpoints.getChildren() as Phaser.Physics.Arcade.Sprite[]).flatMap(
        (sprite) => {
          if (!sprite.active || !sprite.body?.enable) return [];
          return [
            {
              id: sprite.getData("id") as string,
              x: sprite.x,
              y: sprite.y,
              bounds: this.bodyBounds(sprite.body),
            },
          ];
        }
      ),
      visibleCoins: (this.world.coins.getChildren() as Phaser.Physics.Arcade.Sprite[]).flatMap(
        (c) => {
          const body = c.body;
          if (!c.active || !body?.enable || this.racer.collectedCoinIds.has(c.getData("id")))
            return [];
          return [
            {
              id: c.getData("id") as string,
              x: c.x,
              y: c.y,
              value: FRUIT_VALUES[c.getData("fruit") as FruitKind],
              bounds: this.bodyBounds(body),
            },
          ];
        }
      ),
      hazards: hazards.map((h) => ({ ...h, ...velocities.get(h.id) })),
      utilities: this.world.utilityInstances.flatMap(({ sprite, def }) => {
        const body = sprite.body;
        if (!sprite.active || !body?.enable) return [];
        return [
          {
            id: def.id,
            kind: def.kind,
            x: sprite.x,
            y: sprite.y,
            bounds: this.bodyBounds(body),
          },
        ];
      }),
    };
  }

  private bodyBounds(body: WorldRect): WorldRect {
    return { x: body.x, y: body.y, width: body.width, height: body.height };
  }

  /** Ob sich eine Gefahr gerade ankündigt (nur Spikehead in der Vorwarnphase –
   *  `active: false`, aber gleich gefährlich). Delegiert an die pure
   *  `spikeheadState`-Funktion; alle anderen Hazards nie in "warning". */
  private isHazardWarning(hazard: HazardInstanceDef): boolean {
    if (hazard.kind !== "spikehead") return false;
    const triggeredAt = this.racer.hazardTriggeredAtMs.get(hazard.id);
    const msSinceTrigger = triggeredAt === undefined ? null : this.elapsedMs - triggeredAt;
    return spikeheadState(hazard, msSinceTrigger).phase === "warning";
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

  /**
   * Wendet mehrere gleichzeitige Bot-Actions eines Ticks an (Multi-Action).
   * Interpretiert die Liste zu demselben mehrachsigen Signal wie der
   * Tastatur-Pfad (`dir`/`sprint`/`jump`) und nutzt dieselbe
   * `applyMovement`-Pipeline (DRY). Konfliktregel: die ZULETZT genannte
   * horizontale Bewegungs-Action gewinnt; `jump` ist frei kombinierbar; `idle`
   * bzw. eine leere Liste bedeutet "keine horizontale Bewegung".
   */
  private applyBotActions(actions: readonly Action[]): Action[] {
    let dir: -1 | 0 | 1 = 0;
    let sprint = false;
    for (const action of actions) {
      if (action === "left" || action === "sprint-left") {
        dir = -1;
        sprint = action === "sprint-left";
      } else if (action === "right" || action === "sprint-right") {
        dir = 1;
        sprint = action === "sprint-right";
      }
    }
    const jump = actions.includes("jump");
    this.applyMovement(dir, sprint, jump);
    const applied: Action[] = [];
    if (dir === -1) applied.push(sprint ? "sprint-left" : "left");
    if (dir === 1) applied.push(sprint ? "sprint-right" : "right");
    if (jump) applied.push("jump");
    return applied;
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
      this.sprintHoldMs =
        (dir === this.sprintDirection ? this.sprintHoldMs : 0) + this.currentDelta;
    } else {
      this.sprintHoldMs = 0;
    }
    this.sprintDirection = sprint ? dir : 0;

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
    // Ground flags can still describe the contact which just caused a bounce.
    if (
      (this.impulse.impulseKind === "boingo" || this.impulse.impulseKind === "stomp") &&
      body.velocity.y < 0
    )
      return;
    const onGround = body.blocked.down;
    this.racer = { ...this.racer, onGround };

    if (onGround && this.jumpStartMs !== null) {
      this.jumpStartMs = null;
    }

    if (jumpHeld && onGround) {
      const currentSpeed = Math.abs(body.velocity.x) || MOVEMENT_TUNING.BASE_MOVE_SPEED;
      body.setVelocityY(jumpVelocityForSpeed(currentSpeed));
      this.jumpStartMs = this.elapsedMs;
      this.impulse = {
        jumpStartedAtMs: this.elapsedMs,
        impulseKind: "jump",
        impulseAtMs: this.elapsedMs,
        sourceId: null,
      };
      this.lastImpulse = {
        sequence: (this.lastImpulse?.sequence ?? 0) + 1,
        kind: "jump",
        atMs: this.elapsedMs,
        sourceId: null,
      };
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
    const onGround = body.blocked.down;

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
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    this.racer = {
      ...this.racer,
      x: this.player.x,
      y: this.player.y,
      // Overlap-only contacts (e.g. checkpoint flags) also set touching.down.
      // All supporting level colliders are static; only blocked.down proves support.
      onGround: body.blocked.down,
    };
    if (this.racer.onGround && body.velocity.y >= 0) {
      this.jumpStartMs = null;
      this.impulse = {
        jumpStartedAtMs: null,
        impulseKind: "none",
        impulseAtMs: null,
        sourceId: null,
      };
    }
  }

  private onCoinOverlap(coin: Phaser.Physics.Arcade.Sprite): void {
    const id = coin.getData("id") as string;
    if (this.racer.collectedCoinIds.has(id)) return;
    const fruit = coin.getData("fruit") as keyof typeof FRUIT_VALUES;
    this.recordTraceEvent("coin-collected", { id, value: FRUIT_VALUES[fruit] });
    this.racer = applyCoinPickup(this.racer, id, FRUIT_VALUES[fruit]);
    this.playPickupEffect(coin.x, coin.y);
    this.playSfx(AUDIO_KEYS.COLLECT);
    coin.destroy();
  }

  private playPickupEffect(x: number, y: number): void {
    const pop = this.add.sprite(x, y, SheetKeys.FRUIT_COLLECTED).setDepth(20);
    pop.setScale(spriteScale(SheetKeys.FRUIT_COLLECTED));
    pop.play("fruit-collected");
    pop.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => pop.destroy());
  }

  private onBlockCollide(block: Phaser.Physics.Arcade.Sprite): void {
    const id = block.getData("id") as string;
    if (this.racer.resolvedBlockIds.has(id)) return;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const hitFromBelow = body.blocked.up || body.touching.up;
    if (!hitFromBelow) return;

    this.recordTraceEvent("block-hit", { id });

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
    this.recordTraceEvent("checkpoint-reached", { id });
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
    this.recordTraceEvent("goal-reached");
    this.finishTrace("finished", "goal");
    this.racer = applyGoalReached(this.racer);
    this.world.goal.play("goal-pressed");
    this.playSfx(AUDIO_KEYS.COMPLETE);
    this.notifyStatus();
  }

  private onUtilityOverlap(utility: Phaser.Physics.Arcade.Sprite): void {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    if (body.velocity.y <= 0) return;

    body.setVelocityY(MOVEMENT_TUNING.BOINGO_JUMP_VELOCITY);
    this.jumpStartMs = null;
    this.impulse = {
      jumpStartedAtMs: null,
      impulseKind: "boingo",
      impulseAtMs: this.elapsedMs,
      sourceId: utility.getData("id") as string,
    };
    this.lastImpulse = {
      sequence: (this.lastImpulse?.sequence ?? 0) + 1,
      kind: "boingo",
      atMs: this.elapsedMs,
      sourceId: utility.getData("id") as string,
    };
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
    const isActive =
      hazard.active &&
      !!hazard.body?.enable &&
      !hazard.body.checkCollision.none &&
      !this.racer.destroyedHazardIds.has(id);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const contactFromAbove = body.velocity.y > 0 && this.player.y < hazard.y;

    const contact = resolveHazardContact(kind, isActive, contactFromAbove);
    if (contact === "none") return;
    if (contact === "stomped") {
      this.recordTraceEvent("hazard-stomped", { hazardKind: kind, hazardId: id });
      body.setVelocityY(MOVEMENT_TUNING.STOMP_JUMP_VELOCITY);
      this.jumpStartMs = null;
      this.impulse = {
        jumpStartedAtMs: null,
        impulseKind: "stomp",
        impulseAtMs: this.elapsedMs,
        sourceId: id,
      };
      this.lastImpulse = {
        sequence: (this.lastImpulse?.sequence ?? 0) + 1,
        kind: "stomp",
        atMs: this.elapsedMs,
        sourceId: id,
      };
      this.playVanishEffect(hazard.x, hazard.y);
      if (!this.racer.destroyedHazardIds.has(id)) {
        this.racer = {
          ...this.racer,
          destroyedHazardIds: new Set(this.racer.destroyedHazardIds).add(id),
        };
      }
      hazard.destroy();
      this.playSfx(AUDIO_KEYS.DAMAGED);
      return;
    }

    const deathPosition = { x: this.player.x, y: this.player.y };
    this.recordTraceEvent("hazard-hit", { hazardKind: kind, hazardId: id }, deathPosition);
    this.finishTrace("death", `hazard:${kind}`, {
      ...this.traceSummary(),
      position: deathPosition,
    });
    this.racer = applyHazardContact(this.racer, contact);
    this.markDamageAndRespawn();
    body.reset(this.racer.x, this.racer.y);
    this.telemetry?.start(this.traceSummary());
    this.player.play("player-hit", true);
    this.playSfx(AUDIO_KEYS.PLAYER_DAMAGED);
    this.notifyStatus();
  }

  /**
   * Einmaliger "Puff"-Effekt an der Stelle, an der ein gestompter Gegner
   * verschwindet. Bewusst ein eigenes, physikloses Sprite (kein Umfärben des
   * Hazards): Der Hazard selbst wird sofort zerstört, damit er in derselben
   * Frame keine weitere Kollision mehr auslöst, während der Effekt noch läuft.
   * Räumt sich nach der Animation selbst auf.
   */
  private playVanishEffect(x: number, y: number): void {
    const puff = this.add.sprite(x, y, SheetKeys.DISAPPEARING);
    puff.setDepth(WORLD_DEPTH.player + 1);
    puff.setScale(spriteScale(SheetKeys.DISAPPEARING));
    puff.play("disappearing");
    puff.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => puff.destroy());
  }

  private notifyStatus(): void {
    const runner = this.botRunner;
    const normalStop = this.terminalHandled && runner?.pausedReasonKind === "disposed";
    this.initData.onStatusChange?.({
      racer: this.racer,
      pausedReason: normalStop ? null : (runner?.pausedReason ?? null),
      pausedReasonKind: normalStop ? null : (runner?.pausedReasonKind ?? null),
      lastRuntimeError: runner?.lastRuntimeError ?? null,
      consecutiveFailureCount: runner?.consecutiveFailureCount ?? 0,
      ...(this.lastNavigationDiagnostic ? { navigation: this.lastNavigationDiagnostic } : {}),
    });
  }

  private traceSummary(): RacerSummaryInput {
    return {
      position: { x: this.racer.x, y: this.racer.y },
      coinsCollected: this.racer.coinsCollected,
      fruitScore: this.racer.fruitScore,
    };
  }

  private recordTraceEvent(
    kind: string,
    details?: TraceEventInput["details"],
    position = { x: this.racer.x, y: this.racer.y }
  ): void {
    this.telemetry?.current?.recordEvent({
      kind,
      tick: Math.max(0, this.tickCounter - 1),
      timeMs: Math.round(this.elapsedMs),
      position,
      details,
    });
  }

  private finishTrace(result: RunResult, reason: string, summary = this.traceSummary()): void {
    this.telemetry?.finish(result, reason, summary);
  }

  shutdown(): void {
    this.events.off("shutdown", this.shutdown, this);
    this.events.off("destroy", this.shutdown, this);
    this.botReady = false;
    this.events.off("preupdate", this.preparePhysics, this);
    this.events.off("postupdate", this.observeAndAct, this);
    this.invalidateObservation();
    this.finishTrace("aborted", "scene-shutdown");
    this.controller?.dispose();
    this.music?.stop();
    this.unsubscribeAudio?.();
  }
}

type HazardKindLike = Parameters<typeof resolveHazardContact>[0];
