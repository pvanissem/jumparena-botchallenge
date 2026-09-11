import { describe, expect, it } from "vitest";
import type { RacerRuntimeState } from "../game/rules/racerState";
import { computeScore } from "../game/scoring";
import { emptySnapshot, type InputSnapshot } from "./input/inputSnapshot";
import { DEFAULT_PLAYER_NAME, NAME_CHARSET, NAME_LENGTH } from "./nameEntry";
import {
  COUNTDOWN_MS,
  createStationState,
  currentLevelId,
  GAME_OVER_TIMEOUT_MS,
  LEVEL_RESULT_MS,
  PLAY_LEVEL_IDS,
  PLAY_LIVES,
  type StationState,
  stationReducer,
} from "./station";

function edges(...inputs: (keyof InputSnapshot)[]): InputSnapshot {
  const snapshot = emptySnapshot();
  for (const input of inputs) snapshot[input] = true;
  return snapshot;
}

function press(state: StationState, ...inputs: (keyof InputSnapshot)[]): StationState {
  return stationReducer(state, { type: "input", edges: edges(...inputs) });
}

function tick(state: StationState, deltaMs: number): StationState {
  return stationReducer(state, { type: "tick", deltaMs });
}

function racer(overrides: Partial<RacerRuntimeState> = {}): RacerRuntimeState {
  return {
    x: 0,
    y: 0,
    facing: "right",
    onGround: true,
    isAlive: true,
    finished: true,
    didNotFinish: false,
    coinsCollected: 3,
    fruitScore: 100,
    livesRemaining: PLAY_LIVES,
    deaths: 0,
    timeElapsedMs: 30_000,
    lastCheckpoint: { x: 0, y: 0 },
    collectedCoinIds: new Set(),
    resolvedBlockIds: new Set(),
    destroyedHazardIds: new Set(),
    hazardTriggeredAtMs: new Map(),
    ...overrides,
  };
}

/** Bis zum laufenden ersten Level durchspulen. */
function playing(): StationState {
  let state = press(createStationState(), "confirm");
  state = press(state, "confirm");
  return tick(state, COUNTDOWN_MS);
}

describe("Konstanten", () => {
  it("gibt fünf Leben für den gesamten Run", () => {
    expect(PLAY_LIVES).toBe(5);
  });

  it("umfasst die sechs regulären Level ohne das Bot-Testlevel", () => {
    expect(PLAY_LEVEL_IDS).toEqual([
      "level-one",
      "level-two",
      "level-three",
      "level-four",
      "level-five",
      "level-six",
    ]);
  });
});

describe("Phase attract -> name-entry (US-2)", () => {
  it("startet im Wartezustand", () => {
    expect(createStationState().phase).toBe("attract");
  });

  it("öffnet mit BESTÄTIGEN die Namenseingabe", () => {
    expect(press(createStationState(), "confirm").phase).toBe("name-entry");
  });

  it("reagiert im Wartezustand nicht auf andere Tasten", () => {
    expect(press(createStationState(), "jump").phase).toBe("attract");
  });

  it("ändert in der Namenseingabe Zeichen über Flanken", () => {
    const state = press(press(createStationState(), "confirm"), "down");
    expect(state.nameEntry.chars[0]).toBe(NAME_CHARSET[1]);
  });

  it("bewegt den Cursor in der Namenseingabe", () => {
    const state = press(press(createStationState(), "confirm"), "right");
    expect(state.nameEntry.cursor).toBe(1);
  });

  it("kehrt mit ZURÜCK in den Wartezustand zurück", () => {
    const state = press(press(createStationState(), "confirm"), "back");
    expect(state.phase).toBe("attract");
  });

  it("übernimmt den Namen mit BESTÄTIGEN und startet den Countdown", () => {
    const state = press(press(createStationState(), "confirm"), "confirm");
    expect(state.phase).toBe("countdown");
    // Unveränderte Eingabe = acht Mal das erste Zeichen des Zeichenvorrats.
    expect(state.name).toBe(NAME_CHARSET[0].repeat(NAME_LENGTH));
  });

  it("nutzt den Standardnamen, wenn nur Leerzeichen bestätigt werden", () => {
    let state = press(createStationState(), "confirm");
    for (let slot = 0; slot < NAME_LENGTH; slot++) {
      state = press(state, "up"); // umlaufend rückwärts -> Leerzeichen
      state = press(state, "right");
    }
    state = press(state, "confirm");
    expect(state.name).toBe(DEFAULT_PLAYER_NAME);
  });

  it("startet den Run mit vollem Lebensvorrat", () => {
    const state = press(press(createStationState(), "confirm"), "confirm");
    expect(state.livesRemaining).toBe(PLAY_LIVES);
    expect(state.totalScore).toBe(0);
  });
});

describe("Countdown (US-7)", () => {
  it("bleibt vor Ablauf im Countdown", () => {
    const state = tick(press(press(createStationState(), "confirm"), "confirm"), COUNTDOWN_MS - 1);
    expect(state.phase).toBe("countdown");
  });

  it("gibt nach Ablauf das Spiel frei", () => {
    expect(playing().phase).toBe("playing");
  });

  it("startet beim ersten Level", () => {
    expect(currentLevelId(playing())).toBe("level-one");
  });
});

describe("Levelablauf & Score (US-4)", () => {
  it("addiert die Punkte des Levels nach der bestehenden Formel", () => {
    const state = stationReducer(playing(), { type: "level-ended", racer: racer() });
    const expected = computeScore({
      fruitScore: 100,
      timeElapsedMs: 30_000,
      deaths: 0,
      reachedGoal: true,
    });
    expect(state.totalScore).toBe(expected);
    expect(state.results[0].score).toBe(expected);
  });

  it("zeigt nach dem Level das Zwischenergebnis", () => {
    const state = stationReducer(playing(), { type: "level-ended", racer: racer() });
    expect(state.phase).toBe("level-result");
  });

  it("wechselt nach der Zwischenanzeige zum nächsten Level", () => {
    let state = stationReducer(playing(), { type: "level-ended", racer: racer() });
    state = tick(state, LEVEL_RESULT_MS);
    expect(state.phase).toBe("countdown");
    expect(currentLevelId(state)).toBe("level-two");
  });

  it("überspringt die Zwischenanzeige auf Tastendruck", () => {
    let state = stationReducer(playing(), { type: "level-ended", racer: racer() });
    state = press(state, "confirm");
    expect(state.phase).toBe("countdown");
  });

  it("übernimmt die verbleibenden Leben ins nächste Level (keine Auffrischung)", () => {
    let state = stationReducer(playing(), {
      type: "level-ended",
      racer: racer({ livesRemaining: 3, deaths: 2 }),
    });
    state = tick(state, LEVEL_RESULT_MS);
    expect(state.livesRemaining).toBe(3);
  });

  it("summiert die Punkte über mehrere Level", () => {
    let state = stationReducer(playing(), { type: "level-ended", racer: racer() });
    const afterFirst = state.totalScore;
    state = tick(state, LEVEL_RESULT_MS);
    state = tick(state, COUNTDOWN_MS);
    state = stationReducer(state, { type: "level-ended", racer: racer() });
    expect(state.totalScore).toBe(afterFirst * 2);
  });

  it("zählt nur erreichte Ziele als geschaffte Level", () => {
    let state = stationReducer(playing(), {
      type: "level-ended",
      racer: racer({ finished: false, didNotFinish: true, livesRemaining: 4 }),
    });
    state = tick(state, LEVEL_RESULT_MS);
    expect(state.results.filter((result) => result.reachedGoal)).toHaveLength(0);
  });
});

describe("Zeitlimit (US-4)", () => {
  it("führt nach abgelaufener Zeit zum nächsten Level, ohne ein Leben zu kosten", () => {
    let state = stationReducer(playing(), {
      type: "level-ended",
      racer: racer({ finished: false, didNotFinish: true, livesRemaining: 5 }),
    });
    state = tick(state, LEVEL_RESULT_MS);
    expect(state.phase).toBe("countdown");
    expect(state.livesRemaining).toBe(5);
    expect(currentLevelId(state)).toBe("level-two");
  });
});

describe("Ende eines Runs (US-4, US-6)", () => {
  it("beendet den Run sofort, wenn keine Leben mehr übrig sind", () => {
    const state = stationReducer(playing(), {
      type: "level-ended",
      racer: racer({ finished: false, didNotFinish: true, livesRemaining: 0, deaths: 5 }),
    });
    expect(state.phase).toBe("game-over");
  });

  it("beendet den Run nach dem letzten Level", () => {
    let state = playing();
    for (let level = 0; level < PLAY_LEVEL_IDS.length; level++) {
      state = stationReducer(state, { type: "level-ended", racer: racer() });
      if (level < PLAY_LEVEL_IDS.length - 1) {
        state = tick(state, LEVEL_RESULT_MS);
        state = tick(state, COUNTDOWN_MS);
      }
    }
    expect(state.phase).toBe("game-over");
    expect(state.results).toHaveLength(PLAY_LEVEL_IDS.length);
  });

  it("kehrt mit BESTÄTIGEN in den Wartezustand zurück", () => {
    let state = stationReducer(playing(), {
      type: "level-ended",
      racer: racer({ livesRemaining: 0, finished: false, didNotFinish: true }),
    });
    state = press(state, "confirm");
    expect(state.phase).toBe("attract");
  });

  it("kehrt nach Zeitablauf von selbst in den Wartezustand zurück", () => {
    let state = stationReducer(playing(), {
      type: "level-ended",
      racer: racer({ livesRemaining: 0, finished: false, didNotFinish: true }),
    });
    state = tick(state, GAME_OVER_TIMEOUT_MS);
    expect(state.phase).toBe("attract");
  });

  it("setzt beim nächsten Run Score und Leben zurück", () => {
    let state = stationReducer(playing(), {
      type: "level-ended",
      racer: racer({ livesRemaining: 0, finished: false, didNotFinish: true }),
    });
    state = press(state, "confirm");
    state = press(state, "confirm");
    state = press(state, "confirm");
    expect(state.totalScore).toBe(0);
    expect(state.livesRemaining).toBe(PLAY_LIVES);
    expect(state.results).toEqual([]);
    expect(currentLevelId(state)).toBe("level-one");
  });

  it("nimmt eine von außen ermittelte Platzierung auf", () => {
    let state = stationReducer(playing(), {
      type: "level-ended",
      racer: racer({ livesRemaining: 0, finished: false, didNotFinish: true }),
    });
    state = stationReducer(state, { type: "rank-assigned", rank: 3 });
    expect(state.rank).toBe(3);
  });
});

describe("Abbruch & Gamepad-Verlust (US-3, US-5)", () => {
  it("bricht den laufenden Run mit ZURÜCK ab", () => {
    expect(press(playing(), "back").phase).toBe("attract");
  });

  it("wechselt bei Gamepad-Verlust in den Getrennt-Zustand", () => {
    const state = stationReducer(playing(), { type: "gamepad-lost" });
    expect(state.phase).toBe("disconnected");
  });

  it("setzt den Run bei Wiederverbindung fort", () => {
    let state = stationReducer(playing(), { type: "gamepad-lost" });
    state = stationReducer(state, { type: "gamepad-found" });
    expect(state.phase).toBe("playing");
  });

  it("behält Level, Leben und Score über die Trennung hinweg", () => {
    let state = stationReducer(playing(), { type: "level-ended", racer: racer() });
    state = tick(state, LEVEL_RESULT_MS);
    state = tick(state, COUNTDOWN_MS);
    const before = { ...state };
    state = stationReducer(state, { type: "gamepad-lost" });
    state = stationReducer(state, { type: "gamepad-found" });
    expect(state.levelIndex).toBe(before.levelIndex);
    expect(state.totalScore).toBe(before.totalScore);
    expect(state.livesRemaining).toBe(before.livesRemaining);
  });

  it("ignoriert einen Gamepad-Verlust im Wartezustand", () => {
    expect(stationReducer(createStationState(), { type: "gamepad-lost" }).phase).toBe("attract");
  });
});
