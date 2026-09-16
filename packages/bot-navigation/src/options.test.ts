import { describe, expect, it } from "vitest";
import { fixture, platform } from "./fixtures";
import { movementOptions } from "./options";

function scene(offset = 0) {
  const s = fixture();
  s.position = { x: 100 + offset, y: 284 };
  s.navigation.body.x = 88 + offset;
  s.platforms = [platform("arbitrary-floor", -100, 16, 800)];
  return s;
}
describe("observed movement options", () => {
  it("offers walking on observed ground without a level identity", () => {
    expect(movementOptions(scene())).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          command: expect.objectContaining({ kind: "walk" }),
          progress: expect.any(Number),
        }),
      ])
    );
  });
  it("is translation invariant and preserves arbitrary target IDs", () => {
    const a = movementOptions(scene()),
      b = movementOptions(scene(1700));
    expect(b.map((o) => [o.command.kind, o.progress, o.durationMs])).toEqual(
      a.map((o) => [o.command.kind, o.progress, o.durationMs])
    );
  });
  it("never offers a walk across spikes and can jump over them on the same floor", () => {
    const s = scene();
    s.hazards = [
      {
        id: "spikes",
        kind: "stachlinger",
        dx: 80,
        dy: 8,
        bounds: { dx: 68, dy: 0, width: 24, height: 16 },
        active: true,
        warning: false,
        stompable: false,
        vx: 0,
        vy: 0,
      },
    ];
    const options = movementOptions(s);
    expect(
      options.filter((o) => o.command.kind === "walk").every((o) => (o.command.x ?? 0) < 150)
    ).toBe(true);
    expect(options.some((o) => o.command.kind === "jump" && (o.command.x ?? 0) > 220)).toBe(true);
  });
  it("rejects jumping under a low ceiling", () => {
    const s = scene();
    s.platforms.push(platform("roof", -100, -45, 800));
    expect(movementOptions(s).filter((o) => o.command.kind === "jump")).toEqual([]);
  });
  it("does not offer an unreachable high platform", () => {
    const s = scene();
    s.platforms.push(platform("too-high", 180, -500, 100, 16, "one-way-up"));
    expect(
      movementOptions(s).some(
        (o) => o.command.kind !== "walk" && o.command.platformId === "too-high"
      )
    ).toBe(false);
  });
  it("treats a motionless active hazard as dangerous", () => {
    const s = scene();
    s.hazards = [
      {
        kind: "kugelblitz",
        dx: 70,
        dy: -50,
        bounds: { dx: -50, dy: -300, width: 500, height: 340 },
        active: true,
        warning: false,
        stompable: false,
        vx: 0,
        vy: 0,
      },
    ];
    expect(movementOptions(s)).toEqual([]);
  });
});

it("does not plan a landing inside a currently inactive timed hazard", () => {
  const s = scene();
  s.hazards = [
    {
      kind: "loderix",
      dx: 80,
      dy: 0,
      bounds: { dx: 30, dy: -80, width: 600, height: 96 },
      active: false,
      warning: false,
      stompable: false,
      vx: 0,
      vy: 0,
    },
  ];
  expect(movementOptions(s).filter((o) => o.command.kind === "jump")).toEqual([]);
});

it("can leave a low overhang on foot before considering a jump", () => {
  const s = scene();
  s.platforms[0].width = 190;
  s.platforms.push(platform("overhang", -20, -45, 60, 12));
  expect(movementOptions(s).some((o) => o.command.kind === "walk" && o.progress > 20)).toBe(true);
});

it("can use a narrow block whose top fits the actual body", () => {
  const s = scene();
  s.platforms.push({ ...platform("small-step", 130, -52, 33.6, 28.8), kind: "block" });
  expect(
    movementOptions(s).some(
      (o) => o.command.kind === "jump" && o.command.platformId === "small-step"
    )
  ).toBe(true);
});

it("offers a visible spring for an otherwise unreachable higher landing", () => {
  const s = scene();
  s.platforms.push(platform("high-ledge", 220, -250, 180, 16, "one-way-up"));
  s.utilities = [
    {
      id: "any-spring",
      kind: "boingo",
      dx: 40,
      dy: 8,
      bounds: { dx: 24, dy: 0, width: 32, height: 16 },
    },
  ];
  const options = movementOptions(s);
  expect(
    options.some((o) => o.command.kind === "boingo" && o.command.platformId === "high-ledge")
  ).toBe(true);
  expect(
    options.some((o) => o.command.kind === "jump" && o.command.platformId === "high-ledge")
  ).toBe(false);
});

it("can continue after a real edge landing with partial body support", () => {
  const s = scene();
  s.platforms = [platform("edge", 8, 16, 34), platform("next", 120, 16, 240)];
  expect(movementOptions(s).some((o) => o.progress > 0)).toBe(true);
});

it("offers a stopping point before inactive fire and limits the crossing length", () => {
  const s = scene();
  s.hazards = [
    {
      id: "fire",
      kind: "loderix",
      dx: 100,
      dy: 0,
      bounds: { dx: 94, dy: -10, width: 12, height: 26 },
      active: false,
      warning: false,
      stompable: false,
      vx: 0,
      vy: 0,
    },
  ];
  const walks = movementOptions(s).filter((o) => o.command.kind === "walk");
  expect(walks.some((o) => (o.command.x ?? 0) < 180)).toBe(true);
  expect(walks.every((o) => (o.command.x ?? 0) < 240)).toBe(true);
});

it("can run out from a low ceiling before jumping at its edge", () => {
  const s = scene();
  s.platforms = [
    platform("floor", -100, 16, 144),
    platform("roof", -100, -60, 144, 28),
    platform("next", 120, 16, 200),
  ];
  expect(
    movementOptions(s).some(
      (o) =>
        o.command.kind === "jump" && o.command.platformId === "next" && (o.command.runUpMs ?? 0) > 0
    )
  ).toBe(true);
});

it("retreats far enough to clear an overhead block before retrying a jump", () => {
  const s = scene();
  s.platforms.push(platform("overhead", -16, -52, 34, 28));
  s.hazards = [
    {
      id: "spike",
      kind: "stachlinger",
      dx: 38,
      dy: 8,
      bounds: { dx: 34, dy: 0, width: 8, height: 16 },
      active: true,
      warning: false,
      stompable: false,
      vx: 0,
      vy: 0,
    },
  ];
  expect(movementOptions(s).some((o) => o.command.kind === "walk" && o.progress < -48)).toBe(true);
});

it("offers a drop onto a lower surface when a low ceiling prevents jumping", () => {
  const s = scene();
  s.platforms = [
    platform("ledge", -100, 16, 144),
    platform("roof", -100, -60, 500),
    platform("lower", 160, 146, 220),
  ];
  expect(
    movementOptions(s).some((o) => o.command.kind === "drop" && o.command.platformId === "lower")
  ).toBe(true);
});
