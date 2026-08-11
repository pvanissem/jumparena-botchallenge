import type {
  BotArtifact,
  MatchResult,
  TournamentConfigureMessage,
  TournamentStateMessage,
} from "@arena/shared";
import { describe, expect, it, vi } from "vitest";
import { BotRegistry } from "../botRegistry/BotRegistry";
import { ClientRegistry } from "../ws/ClientRegistry";
import { SingleEliminationStrategy } from "./SingleEliminationStrategy";
import {
  type Clock,
  type ShowScheduler,
  TournamentSessionService,
} from "./TournamentSessionService";
import { TournamentService } from "./TournamentService";

class FakeClock implements Clock {
  currentMs = 0;

  now(): number {
    return this.currentMs;
  }
}

interface ScheduledTask {
  delayMs: number;
  callback: () => void;
  cleared: boolean;
}

class FakeScheduler implements ShowScheduler {
  readonly tasks: ScheduledTask[] = [];

  constructor(private readonly clock: FakeClock) {}

  set(delayMs: number, callback: () => void): ScheduledTask {
    const task = { delayMs, callback, cleared: false };
    this.tasks.push(task);
    return task;
  }

  clear(handle: unknown): void {
    (handle as ScheduledTask).cleared = true;
  }

  current(): ScheduledTask {
    for (let index = this.tasks.length - 1; index >= 0; index -= 1) {
      const task = this.tasks[index];
      if (!task.cleared) return task;
    }
    throw new Error("No current task");
  }

  fireCurrent(): void {
    const task = this.current();
    task.cleared = true;
    this.clock.currentMs += task.delayMs;
    task.callback();
  }
}

function bot(id: string): BotArtifact {
  return {
    id,
    name: `Bot ${id}`,
    author: "A",
    color: "#00ffff",
    sourceCode: "export default {}",
    uploadedAt: "2026-01-01T00:00:00.000Z",
  };
}

function configureMessage(): TournamentConfigureMessage {
  return {
    type: "tournament-configure",
    mode: "single-elimination",
    stageLevelIds: ["level-one"],
    botIds: ["b1", "b2"],
    groupSize: 2,
  };
}

function result(): MatchResult {
  return {
    entries: [
      {
        botId: "b1",
        rank: 1,
        score: 100,
        fruitScore: 10,
        coinsCollected: 2,
        deaths: 0,
        timeElapsedMs: 1_000,
        reachedGoal: true,
        disabled: false,
      },
      {
        botId: "b2",
        rank: 2,
        score: 50,
        fruitScore: 5,
        coinsCollected: 1,
        deaths: 1,
        timeElapsedMs: 1_200,
        reachedGoal: false,
        disabled: false,
      },
    ],
  };
}

function setup() {
  const clock = new FakeClock();
  const scheduler = new FakeScheduler(clock);
  const tournament = new TournamentService(
    new BotRegistry([bot("b1"), bot("b2")]),
    new SingleEliminationStrategy((participants) => [...participants], () => "match-1")
  );
  const publishSnapshot = vi.fn<(message: TournamentStateMessage) => void>();
  const session = new TournamentSessionService({
    tournament,
    readyPresentClients: new ClientRegistry(),
    clock,
    scheduler,
    createAttemptId: () => "attempt-1",
    publishSnapshot,
  });
  return { clock, scheduler, tournament, publishSnapshot, session };
}

describe("TournamentSessionService", () => {
  it("runs automatically through the final bracket before showing the champion", () => {
    const { scheduler, session } = setup();

    expect(session.configure(configureMessage())).toBe(true);
    expect(session.getSnapshot().show).toMatchObject({ phase: "ready" });
    expect(session.control("start")).toBe(true);
    expect(session.getSnapshot().show).toMatchObject({
      phase: "matchup-intro",
      activeMatchId: "match-1",
      phaseEndsAtMs: 5_000,
    });

    scheduler.fireCurrent();
    expect(session.getSnapshot().show).toMatchObject({
      phase: "countdown",
      phaseEndsAtMs: 8_000,
    });
    scheduler.fireCurrent();
    expect(session.getSnapshot().show?.phase).toBe("match-running");

    expect(
      session.acceptResult("present-1", {
        type: "match-result",
        matchId: "match-1",
        result: result(),
      })
    ).toBe(true);
    expect(session.getSnapshot().show).toMatchObject({
      phase: "match-result",
      phaseEndsAtMs: 14_000,
    });

    scheduler.fireCurrent();
    expect(session.getSnapshot().show).toMatchObject({
      phase: "bracket-update",
      phaseEndsAtMs: 24_000,
    });
    scheduler.fireCurrent();

    expect(session.getSnapshot().show?.phase).toBe("champion");
    expect(session.getSnapshot().state?.championBotId).toBe("b1");
  });

  it("freezes and resumes a timed phase while stale callbacks remain no-ops", () => {
    const { clock, scheduler, session } = setup();
    session.configure(configureMessage());
    session.control("start");
    const staleTask = scheduler.current();
    clock.currentMs = 2_000;

    expect(session.control("pause")).toBe(true);
    expect(session.getSnapshot().show).toMatchObject({
      holds: ["operator"],
      heldRemainingMs: 3_000,
      phaseEndsAtMs: null,
    });

    clock.currentMs = 10_000;
    expect(session.control("resume")).toBe(true);
    expect(session.getSnapshot().show?.phaseEndsAtMs).toBe(13_000);

    staleTask.callback();
    expect(session.getSnapshot().show?.phase).toBe("matchup-intro");
    scheduler.fireCurrent();
    expect(session.getSnapshot().show?.phase).toBe("countdown");
  });

  it("advances timed phases immediately but never advances match-running", () => {
    const { session } = setup();
    session.configure(configureMessage());
    session.control("start");

    expect(session.control("advance")).toBe(true);
    expect(session.getSnapshot().show?.phase).toBe("countdown");
    expect(session.control("advance")).toBe(true);
    expect(session.getSnapshot().show?.phase).toBe("match-running");
    expect(session.control("advance")).toBe(false);
  });

  it("publishes exactly once per successful state change", () => {
    const { publishSnapshot, session } = setup();

    session.configure(configureMessage());
    session.control("start");
    session.control("start");

    expect(publishSnapshot).toHaveBeenCalledTimes(2);
    expect(publishSnapshot.mock.calls[0][0].serverNowMs).toBe(0);
  });

  it("rejects reconfiguration until reset and clears both states on reset", () => {
    const { publishSnapshot, session } = setup();
    expect(session.configure(configureMessage())).toBe(true);

    expect(session.configure(configureMessage())).toBe(false);
    session.reset();
    expect(session.getSnapshot()).toEqual({ state: null, show: null });
    expect(session.configure(configureMessage())).toBe(true);
    expect(publishSnapshot).toHaveBeenCalledTimes(3);
  });
});
