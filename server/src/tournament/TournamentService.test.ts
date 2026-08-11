import type { BotArtifact, MatchResult } from "@arena/shared";
import {
  DEFAULT_GROUP_SIZE,
  DEFAULT_LIVES_PER_RUN,
  MAX_LIVES_PER_RUN,
  MIN_LIVES_PER_RUN,
} from "@arena/shared";
import { describe, expect, it, vi } from "vitest";
import { BotRegistry } from "../botRegistry/BotRegistry";
import { SingleEliminationStrategy } from "./SingleEliminationStrategy";
import type { TournamentService } from "./TournamentService";
import { TournamentService as TournamentServiceImpl } from "./TournamentService";

function bot(id: string): BotArtifact {
  return {
    id,
    name: `Bot ${id}`,
    author: "A",
    color: "#000",
    sourceCode: "export default {}",
    uploadedAt: "2024-01-01T00:00:00.000Z",
  };
}

function noShuffle<T>(array: readonly T[]): T[] {
  return [...array];
}

function configureCommand(
  stageLevelIds: string[],
  botIds: string[],
  livesPerRun?: number,
  groupSize?: number
): {
  type: "tournament-configure";
  mode: "single-elimination";
  stageLevelIds: string[];
  botIds: string[];
  livesPerRun?: number;
  groupSize?: number;
} {
  return {
    type: "tournament-configure",
    mode: "single-elimination",
    stageLevelIds,
    botIds,
    livesPerRun,
    groupSize,
  };
}

function firstMatchId(svc: TournamentService): string {
  return svc.getState()!.rounds[0][0].id;
}

function service(bots: BotArtifact[] = []): TournamentService {
  const registry = new BotRegistry(bots);
  return new TournamentServiceImpl(registry, new SingleEliminationStrategy(noShuffle));
}

function result(botId: string): MatchResult {
  const loserBotId = botId === "b1" ? "b2" : "b1";
  return {
    entries: [
      {
        botId,
        rank: 1,
        score: 100,
        fruitScore: 50,
        coinsCollected: 5,
        deaths: 0,
        timeElapsedMs: 1000,
        reachedGoal: true,
        disabled: false,
      },
      {
        botId: loserBotId,
        rank: 2,
        score: 50,
        fruitScore: 20,
        coinsCollected: 2,
        deaths: 1,
        timeElapsedMs: 1200,
        reachedGoal: false,
        disabled: false,
      },
    ],
  };
}

describe("configure", () => {
  it("rejects fewer than 2 participants", () => {
    const svc = service([bot("b1")]);
    const state = svc.configure(configureCommand(["level-one"], ["b1"]));

    expect(state).toBeNull();
    expect(svc.getState()).toBeNull();
  });

  it("creates a tournament with metadata from the registry", () => {
    const svc = service([bot("b1"), bot("b2")]);
    const state = svc.configure(configureCommand(["level-one"], ["b1", "b2"]));

    expect(state).not.toBeNull();
    expect(state?.stageLevelIds).toEqual(["level-one"]);
    expect(state?.rounds[0][0].participants.map((p) => p.botId)).toEqual(["b1", "b2"]);
  });

  it("preserves registry order when selecting a subset", () => {
    const svc = service([bot("b1"), bot("b2"), bot("b3")]);
    const state = svc.configure(configureCommand(["level-one"], ["b3", "b1"]));

    expect(state?.rounds[0][0].participants.map((p) => p.botId)).toEqual(["b3", "b1"]);
  });

  it("übernimmt mehrere Stage-Level-IDs in den Turnierzustand", () => {
    const svc = service([bot("b1"), bot("b2"), bot("b3"), bot("b4")]);
    const state = svc.configure(
      configureCommand(["level-one", "level-two"], ["b1", "b2", "b3", "b4"])
    );

    expect(state?.stageLevelIds).toEqual(["level-one", "level-two"]);
  });

  it("lehnt eine leere Stage-Level-Liste ab", () => {
    const svc = service([bot("b1"), bot("b2")]);
    const before = svc.getState();

    const state = svc.configure(configureCommand([], ["b1", "b2"]));

    expect(state).toBeNull();
    expect(svc.getState()).toBe(before);
  });

  it("lehnt unbekannte Level-IDs ab", () => {
    const svc = service([bot("b1"), bot("b2")]);

    expect(svc.configure(configureCommand(["level-unknown"], ["b1", "b2"]))).toBeNull();
    expect(svc.getState()).toBeNull();
  });

  it("nennt im Log alle unbekannten Level-IDs", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const svc = service([bot("b1"), bot("b2")]);

    svc.configure(configureCommand(["level-a", "level-b"], ["b1", "b2"]));

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("level-a"));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("level-b"));
    warnSpy.mockRestore();
  });
});

describe("configure – Gruppengröße", () => {
  it("übernimmt eine gültige Gruppengröße in den Turnierzustand", () => {
    const svc = service([bot("b1"), bot("b2")]);
    const state = svc.configure(configureCommand(["level-one"], ["b1", "b2"], undefined, 2));

    expect(state?.groupSize).toBe(2);
    expect(svc.getState()?.groupSize).toBe(2);
    expect(state?.rounds[0][0].participants).toHaveLength(2);
  });

  it("fällt ohne Angabe auf den Standardwert 4 zurück", () => {
    const svc = service([bot("b1"), bot("b2")]);
    const state = svc.configure(configureCommand(["level-one"], ["b1", "b2"]));

    expect(state?.groupSize).toBe(DEFAULT_GROUP_SIZE);
  });

  it.each([3, 1, 5, 8, 2.5, Number.NaN])("lehnt die ungültige Gruppengröße %p ab", (groupSize) => {
    const svc = service([bot("b1"), bot("b2")]);
    const state = svc.configure(
      configureCommand(["level-one"], ["b1", "b2"], undefined, groupSize)
    );

    expect(state).toBeNull();
    expect(svc.getState()).toBeNull();
  });

  it("lässt einen bestehenden Turnierzustand bei ungültiger Gruppengröße unverändert", () => {
    const svc = service([bot("b1"), bot("b2")]);
    svc.configure(configureCommand(["level-one"], ["b1", "b2"], undefined, 2));
    const before = svc.getState();

    svc.configure(configureCommand(["level-two"], ["b1", "b2"], undefined, 3));

    expect(svc.getState()).toBe(before);
    expect(svc.getState()?.groupSize).toBe(2);
  });
});

describe("configure – Leben pro Lauf", () => {
  it("übernimmt einen gültigen Wert in den Turnierzustand", () => {
    const svc = service([bot("b1"), bot("b2")]);
    const state = svc.configure(configureCommand(["level-one"], ["b1", "b2"], 7));

    expect(state?.livesPerRun).toBe(7);
    expect(svc.getState()?.livesPerRun).toBe(7);
  });

  it("fällt ohne Angabe auf den Standardwert zurück", () => {
    const svc = service([bot("b1"), bot("b2")]);
    const state = svc.configure(configureCommand(["level-one"], ["b1", "b2"]));

    expect(state?.livesPerRun).toBe(DEFAULT_LIVES_PER_RUN);
  });

  it.each([0, 100, 2.5, Number.NaN])("lehnt den ungültigen Wert %p ab", (lives) => {
    const svc = service([bot("b1"), bot("b2")]);
    const state = svc.configure(configureCommand(["level-one"], ["b1", "b2"], lives));

    expect(state).toBeNull();
    expect(svc.getState()).toBeNull();
  });

  it("lässt einen bestehenden Turnierzustand bei ungültigem Wert unverändert", () => {
    const svc = service([bot("b1"), bot("b2")]);
    svc.configure(configureCommand(["level-one"], ["b1", "b2"], 5));
    const before = svc.getState();

    svc.configure(configureCommand(["level-two"], ["b1", "b2"], 0));

    expect(svc.getState()).toBe(before);
    expect(svc.getState()?.livesPerRun).toBe(5);
  });

  it.each([MIN_LIVES_PER_RUN, MAX_LIVES_PER_RUN])("akzeptiert den Grenzwert %i", (lives) => {
    const svc = service([bot("b1"), bot("b2")]);

    expect(svc.configure(configureCommand(["level-one"], ["b1", "b2"], lives))?.livesPerRun).toBe(
      lives
    );
  });
});

describe("startMatch", () => {
  it("returns true and marks a pending match as running", () => {
    const svc = service([bot("b1"), bot("b2")]);
    svc.configure(configureCommand(["level-one"], ["b1", "b2"]));

    const started = svc.startMatch(firstMatchId(svc));

    expect(started).toBe(true);
    expect(svc.getState()?.rounds[0][0].status).toBe("running");
    expect(svc.getState()?.status).toBe("running");
  });

  it("returns false when no tournament is configured", () => {
    const svc = service();
    expect(svc.startMatch("m1")).toBe(false);
  });

  it("returns false for an already running match", () => {
    const svc = service([bot("b1"), bot("b2")]);
    svc.configure(configureCommand(["level-one"], ["b1", "b2"]));
    svc.startMatch(firstMatchId(svc));

    expect(svc.startMatch(firstMatchId(svc))).toBe(false);
  });

  it("returns false for an already finished match", () => {
    const svc = service([bot("b1"), bot("b2")]);
    svc.configure(configureCommand(["level-one"], ["b1", "b2"]));
    const matchId = firstMatchId(svc);
    svc.startMatch(matchId);
    svc.submitResult(matchId, result("b1"));

    expect(svc.startMatch(matchId)).toBe(false);
  });
});

describe("submitResult", () => {
  it("advances the bracket and returns true for a running match", () => {
    const svc = service([bot("b1"), bot("b2")]);
    svc.configure(configureCommand(["level-one"], ["b1", "b2"]));
    const matchId = firstMatchId(svc);
    svc.startMatch(matchId);

    const advanced = svc.submitResult(matchId, result("b1"));

    expect(advanced).toBe(true);
    expect(svc.getState()?.status).toBe("finished");
    expect(svc.getState()?.championBotId).toBe("b1");
  });

  it("returns false for an unknown match", () => {
    const svc = service([bot("b1"), bot("b2")]);
    svc.configure(configureCommand(["level-one"], ["b1", "b2"]));

    expect(svc.submitResult("unknown", result("b1"))).toBe(false);
  });

  it("returns false for a pending match", () => {
    const svc = service([bot("b1"), bot("b2")]);
    svc.configure(configureCommand(["level-one"], ["b1", "b2"]));

    expect(svc.submitResult(firstMatchId(svc), result("b1"))).toBe(false);
  });

  it("returns false for a finished match (double-present guard)", () => {
    const svc = service([bot("b1"), bot("b2")]);
    svc.configure(configureCommand(["level-one"], ["b1", "b2"]));
    const matchId = firstMatchId(svc);
    svc.startMatch(matchId);
    svc.submitResult(matchId, result("b1"));

    expect(svc.submitResult(matchId, result("b1"))).toBe(false);
  });

  it("rejects an invalid result without mutating the running match", () => {
    const svc = service([bot("b1"), bot("b2")]);
    svc.configure(configureCommand(["level-one"], ["b1", "b2"]));
    const matchId = firstMatchId(svc);
    svc.startMatch(matchId);
    const before = svc.getState();

    const accepted = svc.submitResult(matchId, { entries: [] });

    expect(accepted).toBe(false);
    expect(svc.getState()).toBe(before);
    expect(svc.getState()?.rounds[0][0]).toMatchObject({ status: "running", result: null });
  });
});

describe("reset", () => {
  it("clears the tournament state", () => {
    const svc = service([bot("b1"), bot("b2")]);
    svc.configure(configureCommand(["level-one"], ["b1", "b2"]));
    svc.reset();

    expect(svc.getState()).toBeNull();
  });
});

describe("single-participant tournament", () => {
  it("is finished immediately with champion set", () => {
    const svc = service([bot("b1")]);
    const state = svc.configure(configureCommand(["level-one"], ["b1"]));

    // TournamentService requires >=2 participants, matching US-1.
    expect(state).toBeNull();
  });
});

describe("participants missing from registry", () => {
  it("are ignored when building the bracket", () => {
    const svc = service([bot("b1")]);
    const state = svc.configure(configureCommand(["level-one"], ["b1", "b2"]));

    expect(state).toBeNull();
  });
});
