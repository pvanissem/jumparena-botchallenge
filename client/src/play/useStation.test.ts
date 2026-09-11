import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HumanInputSource } from "../game/control/RacerController";
import type { RacerRuntimeState } from "../game/rules/racerState";
import type { StationSceneHost } from "./StationSceneHost";
import { COUNTDOWN_MS, LEVEL_RESULT_MS } from "./station";
import { useStation } from "./useStation";

const humanInput: HumanInputSource = {
  getInput: () => ({ dir: 0, jump: false, sprint: false }),
  getNextActions: () => [],
  dispose: () => {},
};

function racer(overrides: Partial<RacerRuntimeState> = {}): RacerRuntimeState {
  return {
    x: 0,
    y: 0,
    facing: "right",
    onGround: true,
    isAlive: true,
    finished: true,
    didNotFinish: false,
    coinsCollected: 0,
    fruitScore: 50,
    livesRemaining: 4,
    deaths: 1,
    timeElapsedMs: 10_000,
    lastCheckpoint: { x: 0, y: 0 },
    collectedCoinIds: new Set(),
    resolvedBlockIds: new Set(),
    destroyedHazardIds: new Set(),
    hazardTriggeredAtMs: new Map(),
    ...overrides,
  };
}

function fakeHost() {
  const started: { levelId: string; startingLives: number }[] = [];
  let statusCallback: ((status: { racer: RacerRuntimeState }) => void) | null = null;

  const host = {
    startLevel: vi.fn((options) => {
      started.push({ levelId: options.levelId, startingLives: options.startingLives });
      statusCallback = options.onStatusChange;
    }),
    stopLevel: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    destroy: vi.fn(),
  } as unknown as StationSceneHost;

  return {
    host,
    started,
    emitStatus(state: RacerRuntimeState) {
      statusCallback?.({ racer: state });
    },
  };
}

describe("useStation", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function setup(onRunFinished = vi.fn()) {
    const scene = fakeHost();
    const view = renderHook(() =>
      useStation({
        stationId: "left",
        host: scene.host,
        humanInput,
        connected: true,
        onRunFinished,
      })
    );
    return { ...scene, view, onRunFinished };
  }

  /** Eingaben kommen im Betrieb als Flanken aus `useGamepadEdges`. */
  function press(view: ReturnType<typeof setup>["view"], input: "confirm" | "back") {
    act(() => view.result.current.handleEdges({ ...emptyEdges(), [input]: true }));
  }

  function emptyEdges() {
    return {
      left: false,
      right: false,
      up: false,
      down: false,
      jump: false,
      sprint: false,
      confirm: false,
      back: false,
    };
  }

  function advance(view: ReturnType<typeof setup>["view"], ms: number) {
    act(() => view.result.current.tick(ms));
  }

  it("startet ohne laufende Szene", () => {
    const { host } = setup();
    expect(host.startLevel).not.toHaveBeenCalled();
  });

  it("startet die Szene erst nach dem Countdown", () => {
    const { view, host } = setup();
    press(view, "confirm");
    press(view, "confirm");
    expect(host.startLevel).not.toHaveBeenCalled();

    advance(view, COUNTDOWN_MS);
    expect(host.startLevel).toHaveBeenCalledTimes(1);
  });

  it("startet das erste Level mit fünf Leben", () => {
    const { view, started } = setup();
    press(view, "confirm");
    press(view, "confirm");
    advance(view, COUNTDOWN_MS);
    expect(started[0]).toEqual({ levelId: "level-one", startingLives: 5 });
  });

  it("übergibt das Ende eines Levels an den Reducer", () => {
    const { view, emitStatus } = setup();
    press(view, "confirm");
    press(view, "confirm");
    advance(view, COUNTDOWN_MS);
    act(() => emitStatus(racer()));

    expect(view.result.current.state.phase).toBe("level-result");
    expect(view.result.current.state.totalScore).toBeGreaterThan(0);
  });

  it("beendet die Szene, sobald das Level vorbei ist", () => {
    const { view, host, emitStatus } = setup();
    press(view, "confirm");
    press(view, "confirm");
    advance(view, COUNTDOWN_MS);
    act(() => emitStatus(racer()));

    expect(host.stopLevel).toHaveBeenCalledWith("left");
  });

  it("startet das nächste Level mit den verbliebenen Leben", () => {
    const { view, started, emitStatus } = setup();
    press(view, "confirm");
    press(view, "confirm");
    advance(view, COUNTDOWN_MS);
    act(() => emitStatus(racer({ livesRemaining: 3 })));
    advance(view, LEVEL_RESULT_MS);
    advance(view, COUNTDOWN_MS);

    expect(started[1]).toEqual({ levelId: "level-two", startingLives: 3 });
  });

  it("ignoriert weitere Statusmeldungen desselben Levels", () => {
    const { view, emitStatus } = setup();
    press(view, "confirm");
    press(view, "confirm");
    advance(view, COUNTDOWN_MS);
    act(() => emitStatus(racer()));
    const scoreAfterFirst = view.result.current.state.totalScore;
    act(() => emitStatus(racer()));

    expect(view.result.current.state.totalScore).toBe(scoreAfterFirst);
  });

  it("meldet das Ende des Runs nach außen", () => {
    const { view, emitStatus, onRunFinished } = setup();
    press(view, "confirm");
    press(view, "confirm");
    advance(view, COUNTDOWN_MS);
    act(() => emitStatus(racer({ finished: false, didNotFinish: true, livesRemaining: 0 })));

    expect(onRunFinished).toHaveBeenCalledWith(
      expect.objectContaining({ phase: "game-over", name: expect.any(String) })
    );
  });

  it("meldet denselben Run nur ein einziges Mal", () => {
    const { view, emitStatus, onRunFinished } = setup();
    press(view, "confirm");
    press(view, "confirm");
    advance(view, COUNTDOWN_MS);
    act(() => emitStatus(racer({ finished: false, didNotFinish: true, livesRemaining: 0 })));

    // Ergebnisanzeige läuft weiter (Timeout-Countdown) – das darf das
    // Ergebnis nicht erneut in die Bestenliste schreiben.
    advance(view, 1_000);
    advance(view, 1_000);

    expect(onRunFinished).toHaveBeenCalledTimes(1);
  });

  it("übernimmt die von außen gemeldete Platzierung", () => {
    const { view, emitStatus } = setup(vi.fn(() => 2));
    press(view, "confirm");
    press(view, "confirm");
    advance(view, COUNTDOWN_MS);
    act(() => emitStatus(racer({ finished: false, didNotFinish: true, livesRemaining: 0 })));

    expect(view.result.current.state.rank).toBe(2);
  });

  it("startet die Szene nicht erneut, während dasselbe Level läuft", () => {
    const { view, host } = setup();
    press(view, "confirm");
    press(view, "confirm");
    advance(view, COUNTDOWN_MS);

    // Laufende Zeit im Level darf keine weiteren Szenenstarts auslösen
    // (siehe `.features/play-mode-input-lag/bugfix.md`, Root Cause 2).
    for (let tick = 0; tick < 30; tick++) advance(view, 16);

    expect(host.startLevel).toHaveBeenCalledTimes(1);
    expect(host.stopLevel).not.toHaveBeenCalled();
  });

  it("beendet die Szene beim Abbruch durch den Spieler", () => {
    const { view, host } = setup();
    press(view, "confirm");
    press(view, "confirm");
    advance(view, COUNTDOWN_MS);
    press(view, "back");

    expect(host.stopLevel).toHaveBeenCalledWith("left");
    expect(view.result.current.state.phase).toBe("attract");
  });

  it("pausiert die Szene bei Gamepad-Verlust und setzt sie danach fort", () => {
    const scene = fakeHost();
    let connected = true;
    const view = renderHook(() =>
      useStation({
        stationId: "left",
        host: scene.host,
        humanInput,
        connected,
        onRunFinished: vi.fn(),
      })
    );

    act(() => view.result.current.handleEdges({ ...emptyEdges(), confirm: true }));
    act(() => view.result.current.handleEdges({ ...emptyEdges(), confirm: true }));
    act(() => view.result.current.tick(COUNTDOWN_MS));

    connected = false;
    view.rerender();
    expect(scene.host.pause).toHaveBeenCalledWith("left");
    expect(view.result.current.state.phase).toBe("disconnected");

    connected = true;
    view.rerender();
    expect(scene.host.resume).toHaveBeenCalledWith("left");
    expect(view.result.current.state.phase).toBe("playing");
  });
});
