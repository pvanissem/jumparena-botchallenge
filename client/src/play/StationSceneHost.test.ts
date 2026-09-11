import type Phaser from "phaser";
import { describe, expect, it, vi } from "vitest";
import type { HumanInputSource } from "../game/control/RacerController";
import type { RaceSceneInitData } from "../game/scenes/RaceScene";
import { StationSceneHost } from "./StationSceneHost";

vi.mock("../game/scenes/RaceScene", () => ({ RaceScene: class {} }));

const humanInput: HumanInputSource = {
  getInput: () => ({ dir: 0, jump: false, sprint: false }),
  getNextActions: () => [],
  dispose: () => {},
};

interface AddedScene {
  key: string;
  autoStart: boolean;
  data: RaceSceneInitData;
}

function fakeGame({ assetsReady = true }: { assetsReady?: boolean } = {}) {
  const added: AddedScene[] = [];
  const assetListeners: (() => void)[] = [];
  const removed: string[] = [];
  const paused: string[] = [];
  const resumed: string[] = [];
  const shutdown: string[] = [];
  const scenes = new Map<string, { shutdown: () => void }>();

  const game = {
    canvas: { width: 1200, height: 600 },
    scene: {
      add: (key: string, _scene: unknown, autoStart: boolean, data: RaceSceneInitData) => {
        added.push({ key, autoStart, data });
        scenes.set(key, { shutdown: () => shutdown.push(key) });
      },
      remove: (key: string) => {
        removed.push(key);
        scenes.delete(key);
      },
      getScene: (key: string) =>
        key === "play-boot" ? { assetsReady } : (scenes.get(key) ?? null),
      pause: (key: string) => paused.push(key),
      resume: (key: string) => resumed.push(key),
    },
    events: {
      once: (_event: string, listener: () => void) => assetListeners.push(listener),
    },
  } as unknown as Phaser.Game;

  return {
    game,
    added,
    removed,
    paused,
    resumed,
    shutdown,
    /** Signalisiert, dass die Boot-Szene mit dem Laden fertig ist. */
    finishLoading() {
      for (const listener of assetListeners.splice(0)) listener();
    },
  };
}

function start(
  host: StationSceneHost,
  overrides: Partial<Parameters<StationSceneHost["startLevel"]>[0]> = {}
) {
  host.startLevel({
    stationId: "left",
    levelId: "level-one",
    startingLives: 5,
    humanInput,
    onStatusChange: vi.fn(),
    ...overrides,
  });
}

describe("StationSceneHost – Szene starten", () => {
  it("startet eine Szene mit stationsspezifischem Schlüssel", () => {
    const { game, added } = fakeGame();
    start(new StationSceneHost(game));
    expect(added[0].key).toBe("play-left");
    expect(added[0].autoStart).toBe(true);
  });

  it("übergibt Level, Leben und Gamepad-Steuerung", () => {
    const { game, added } = fakeGame();
    start(new StationSceneHost(game), { levelId: "level-three", startingLives: 2 });
    expect(added[0].data.levelId).toBe("level-three");
    expect(added[0].data.startingLives).toBe(2);
    expect(added[0].data.controllerMode).toBe("gamepad");
    expect(added[0].data.humanInput).toBe(humanInput);
  });

  it("lässt Soundeffekte zu, unterdrückt aber die Musik der Racer-Szene", () => {
    const { game, added } = fakeGame();
    start(new StationSceneHost(game));
    expect(added[0].data.audio).toEqual({ music: false, sfx: true });
  });

  it("nutzt die bereits geladenen Assets der Boot-Szene", () => {
    const { game, added } = fakeGame();
    start(new StationSceneHost(game));
    expect(added[0].data.assetsPreloaded).toBe(true);
  });

  it("gibt der linken Station die linke Bildschirmhälfte", () => {
    const { game, added } = fakeGame();
    start(new StationSceneHost(game));
    expect(added[0].data.viewport).toEqual({ x: 0, y: 0, width: 600, height: 600 });
  });

  it("gibt der rechten Station die rechte Bildschirmhälfte", () => {
    const { game, added } = fakeGame();
    start(new StationSceneHost(game), { stationId: "right" });
    expect(added[0].data.viewport).toEqual({ x: 600, y: 0, width: 600, height: 600 });
  });

  it("reicht den Status der Szene nach außen", () => {
    const { game, added } = fakeGame();
    const onStatusChange = vi.fn();
    start(new StationSceneHost(game), { onStatusChange });
    added[0].data.onStatusChange?.({
      racer: { finished: true } as never,
      pausedReason: null,
      pausedReasonKind: null,
      lastRuntimeError: null,
      consecutiveFailureCount: 0,
    });
    expect(onStatusChange).toHaveBeenCalledWith(
      expect.objectContaining({ racer: { finished: true } })
    );
  });
});

describe("StationSceneHost – Assets abwarten", () => {
  it("startet keine Szene, solange die Assets noch laden", () => {
    const { game, added } = fakeGame({ assetsReady: false });
    start(new StationSceneHost(game));
    expect(added).toEqual([]);
  });

  it("holt den Start nach, sobald die Assets bereit sind", () => {
    const { game, added, finishLoading } = fakeGame({ assetsReady: false });
    start(new StationSceneHost(game), { levelId: "level-two" });
    finishLoading();

    expect(added).toHaveLength(1);
    expect(added[0].data.levelId).toBe("level-two");
  });

  it("verwirft einen wartenden Start, wenn die Station vorher beendet wird", () => {
    const { game, added, finishLoading } = fakeGame({ assetsReady: false });
    const host = new StationSceneHost(game);
    start(host);
    host.stopLevel("left");
    finishLoading();

    expect(added).toEqual([]);
  });

  it("holt wartende Starts beider Stationen nach", () => {
    const { game, added, finishLoading } = fakeGame({ assetsReady: false });
    const host = new StationSceneHost(game);
    start(host, { stationId: "left" });
    start(host, { stationId: "right" });
    finishLoading();

    expect(added.map((scene) => scene.key).sort()).toEqual(["play-left", "play-right"]);
  });
});

describe("StationSceneHost – Levelwechsel & Unabhängigkeit", () => {
  it("ersetzt beim nächsten Level die Szene derselben Station", () => {
    const { game, added, removed, shutdown } = fakeGame();
    const host = new StationSceneHost(game);
    start(host);
    start(host, { levelId: "level-two" });

    expect(shutdown).toEqual(["play-left"]);
    expect(removed).toEqual(["play-left"]);
    expect(added.map((scene) => scene.data.levelId)).toEqual(["level-one", "level-two"]);
  });

  it("lässt die Szene der anderen Station beim Levelwechsel unberührt", () => {
    const { game, removed } = fakeGame();
    const host = new StationSceneHost(game);
    start(host, { stationId: "left" });
    start(host, { stationId: "right" });
    start(host, { stationId: "left", levelId: "level-two" });

    expect(removed).toEqual(["play-left"]);
  });

  it("beendet nur die Szene der angegebenen Station", () => {
    const { game, removed } = fakeGame();
    const host = new StationSceneHost(game);
    start(host, { stationId: "left" });
    start(host, { stationId: "right" });
    host.stopLevel("right");

    expect(removed).toEqual(["play-right"]);
  });

  it("ignoriert das Beenden einer Station ohne laufende Szene", () => {
    const { game, removed } = fakeGame();
    new StationSceneHost(game).stopLevel("left");
    expect(removed).toEqual([]);
  });
});

describe("StationSceneHost – Pause & Aufräumen", () => {
  it("pausiert und setzt die Szene einer Station fort", () => {
    const { game, paused, resumed } = fakeGame();
    const host = new StationSceneHost(game);
    start(host);
    host.pause("left");
    host.resume("left");
    expect(paused).toEqual(["play-left"]);
    expect(resumed).toEqual(["play-left"]);
  });

  it("pausiert nichts, wenn die Station keine Szene hat", () => {
    const { game, paused } = fakeGame();
    new StationSceneHost(game).pause("left");
    expect(paused).toEqual([]);
  });

  it("räumt beim Zerstören alle Stationen auf", () => {
    const { game, removed, shutdown } = fakeGame();
    const host = new StationSceneHost(game);
    start(host, { stationId: "left" });
    start(host, { stationId: "right" });
    host.destroy();

    expect(shutdown.sort()).toEqual(["play-left", "play-right"]);
    expect(removed.sort()).toEqual(["play-left", "play-right"]);
  });

  it("startet nach dem Zerstören keine Szenen mehr", () => {
    const { game, added } = fakeGame();
    const host = new StationSceneHost(game);
    host.destroy();
    start(host);
    expect(added).toEqual([]);
  });
});
