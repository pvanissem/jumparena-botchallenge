import type { MatchDef, MatchProgressMessage, MatchResult } from "@arena/shared";
import type Phaser from "phaser";
import { getLevelById } from "../game/level/levelRegistry";
import type { RacerRuntimeState } from "../game/rules/racerState";
import { RaceScene, type RaceSceneInitData } from "../game/scenes/RaceScene";
import type { BotRunnerPauseReasonKind } from "../sandbox/BotRunner";
import { computeGridViewports } from "./gridViewports";
import { MATCH_ASSETS_READY, MATCH_BOOT_SCENE_KEY, type MatchBootScene } from "./MatchBootScene";
import { computeMatchProgress } from "./matchProgress";
import { rankMatchResults } from "./rankMatchResults";

const PROGRESS_INTERVAL_MS = 500;

/** Alles, was ein Match zum Starten braucht. Options-Objekt statt vieler
 *  Positions-Parameter, damit weitere Turnier-Einstellungen ergänzt werden
 *  können, ohne jede Signatur anzufassen. */
export interface MatchStartOptions {
  match: MatchDef;
  levelId: string;
  /** Leben pro Racer aus `TournamentState.livesPerRun`. */
  livesPerRun: number;
  sourceById: ReadonlyMap<string, string>;
}

interface RacerSlot {
  botId: string;
  sceneKey: string;
  status: {
    racer: RacerRuntimeState;
    pausedReasonKind: BotRunnerPauseReasonKind | null;
  } | null;
}

export class MatchRunner {
  private slots: RacerSlot[] = [];
  private progressTimer: ReturnType<typeof setInterval> | null = null;
  private stopped = false;
  private reportedFinished = false;

  constructor(
    private readonly game: Phaser.Game,
    private readonly onProgress: (entries: MatchProgressMessage["entries"]) => void,
    private readonly onFinished: (result: MatchResult) => void
  ) {}

  start(options: MatchStartOptions): void {
    if (this.stopped) return;

    const boot = this.game.scene.getScene(MATCH_BOOT_SCENE_KEY) as MatchBootScene | null;

    // Racer-Szenen erst starten, wenn die Assets EINMAL geladen sind – sonst
    // laden alle vier parallel dieselben Keys (siehe `MatchBootScene`).
    if (boot && !boot.assetsReady) {
      this.game.events.once(MATCH_ASSETS_READY, () => {
        if (this.stopped) return;
        this.startRacerScenes(options);
      });
      return;
    }

    this.startRacerScenes(options);
  }

  private startRacerScenes({ match, levelId, livesPerRun, sourceById }: MatchStartOptions): void {
    const level = getLevelById(levelId);
    const canvasWidth = this.game.canvas.width;
    const canvasHeight = this.game.canvas.height;
    const viewports = computeGridViewports(match.participants.length, canvasWidth, canvasHeight);

    this.slots = match.participants.map((participant, index) => {
      const sceneKey = `match-${match.id}-${participant.botId}`;
      const viewport = viewports[index];
      const sourceCode = sourceById.get(participant.botId);

      this.game.scene.add(sceneKey, new RaceScene(sceneKey), true, {
        controllerMode: "bot",
        levelId,
        botSourceCode: sourceCode,
        startingLives: livesPerRun,
        viewport,
        audio: false,
        onStatusChange: (status) => {
          const slot = this.slots.find((s) => s.botId === participant.botId);
          if (slot) {
            slot.status = {
              racer: status.racer,
              pausedReasonKind: status.pausedReasonKind,
            };
          }
          this.checkFinished();
        },
      } as RaceSceneInitData);

      return { botId: participant.botId, sceneKey, status: null };
    });

    this.progressTimer = setInterval(() => this.emitProgress(level), PROGRESS_INTERVAL_MS);
  }

  stop(): void {
    if (this.progressTimer) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }

    for (const slot of this.slots) {
      const scene = this.game.scene.getScene(slot.sceneKey) as RaceScene | undefined;
      scene?.shutdown?.();
      this.game.scene.remove(slot.sceneKey);
    }

    this.slots = [];
    this.stopped = true;
  }

  private emitProgress(level: ReturnType<typeof getLevelById>): void {
    const entries: MatchProgressMessage["entries"] = this.slots
      .map((slot) => {
        const status = slot.status;
        if (!status) return null;
        const { racer } = status;
        return {
          botId: slot.botId,
          fruitScore: racer.fruitScore,
          livesRemaining: racer.livesRemaining,
          timeElapsedMs: racer.timeElapsedMs,
          progress: computeMatchProgress(level, racer),
          finished: racer.finished,
          didNotFinish: racer.didNotFinish,
          disabled: status.pausedReasonKind !== null,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

    this.onProgress(entries);
  }

  private checkFinished(): void {
    if (this.reportedFinished) return;

    const allDone = this.slots.every((slot) => {
      const status = slot.status;
      if (!status) return false;
      const { racer, pausedReasonKind } = status;
      return racer.finished || racer.didNotFinish || pausedReasonKind !== null;
    });

    if (!allDone || this.slots.length === 0) return;

    // Nur EIN Ergebnis pro Match melden: `onStatusChange` feuert mehrmals pro
    // Sekunde je Racer, sonst würde das Ergebnis mehrfach gesendet.
    this.reportedFinished = true;

    if (this.progressTimer) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }

    // Give the renderer one more frame, then rank and report.
    requestAnimationFrame(() => {
      const ranked = rankMatchResults(
        this.slots.map((slot) => ({
          botId: slot.botId,
          state: slot.status?.racer ?? this.defaultDnfState(),
          disabled: slot.status?.pausedReasonKind !== null,
        }))
      );
      this.onFinished({ entries: ranked });
    });
  }

  private defaultDnfState(): RacerRuntimeState {
    return {
      x: 0,
      y: 0,
      facing: "right",
      onGround: true,
      isAlive: true,
      finished: false,
      didNotFinish: true,
      coinsCollected: 0,
      fruitScore: 0,
      livesRemaining: 0,
      deaths: 0,
      timeElapsedMs: 0,
      lastCheckpoint: { x: 0, y: 0 },
      collectedCoinIds: new Set(),
      resolvedBlockIds: new Set(),
      hazardTriggeredAtMs: new Map(),
    };
  }
}
