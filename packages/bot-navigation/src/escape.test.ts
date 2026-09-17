import type { BotState } from "@arena/bot-contract";
import { expect, it } from "vitest";
import { createMovementController } from "./controller";
import { fixture } from "./fixtures";
import { movementOptions } from "./options";
import recorded from "./test-data/desert-spike.json";

it("keeps a falling head's column blocked after its warning ends", () => {
  const s = fixture();
  s.hazards = [
    {
      id: "falling",
      kind: "spikehead",
      dx: 114,
      dy: 100,
      bounds: { dx: 108, dy: 100, width: 28, height: 28 },
      active: true,
      warning: false,
      stompable: false,
      vx: 0,
      vy: 700,
    },
  ];
  expect(movementOptions(s).some((o) => o.progress > 0)).toBe(false);
  const motor = createMovementController();
  expect(motor.run(s, { id: "walk", kind: "walk", x: 220, sprint: true })).toEqual([]);
  expect(motor.status(s).reason).toBe("danger-ahead");
});

it("can retreat from the recorded Desert spike when only the safety buffer overlaps", () => {
  const s = structuredClone(recorded) as BotState;
  const retreat = movementOptions(s).find((o) => o.command.kind === "walk" && o.progress < 0);
  expect(retreat).toBeDefined();
});
it("does not offer a retreat whose swept body actually intersects the spike", () => {
  const s = structuredClone(recorded) as BotState;
  s.hazards = [s.hazards[0]];
  if (!s.hazards[0].bounds) throw Error("Missing fixture bounds");
  s.hazards[0].bounds.dx = -10;
  expect(movementOptions(s).some((o) => o.command.kind === "walk" && o.progress < 0)).toBe(false);
});
it("does not retreat through a second obstacle behind the bot", () => {
  const s = structuredClone(recorded) as BotState;
  s.hazards.push({
    ...s.hazards[0],
    id: "behind",
    dx: -35,
    bounds: { dx: -40, dy: 5.6, width: 10, height: 12 },
  });
  expect(movementOptions(s).some((o) => o.command.kind === "walk" && o.progress < 0)).toBe(false);
});

it("does not launch across the fall column of a warning spikehead", async () => {
  const { default: warning } = await import("./test-data/desert-warning.json");
  const s = structuredClone(warning) as BotState;
  expect(movementOptions(s).filter((o) => o.progress > 0)).toEqual([]);
  s.hazards = s.hazards.filter((h) => h.kind !== "spikehead");
  expect(movementOptions(s).some((o) => o.progress > 0)).toBe(true);
});

it("can escape horizontally when already underneath a warning spikehead", async () => {
  const { fixture, platform } = await import("./fixtures");
  const s = fixture();
  s.position = { x: 92, y: 284 };
  s.platforms = [platform("floor", -92, 16, 1000)];
  s.hazards = [
    {
      id: "head",
      kind: "spikehead",
      active: false,
      warning: true,
      dx: 0,
      dy: -150,
      vx: 0,
      vy: 0,
      stompable: false,
      bounds: { dx: -16, dy: -166, width: 32, height: 32 },
    },
  ];
  expect(movementOptions(s).some((o) => o.command.kind === "walk" && o.progress < 0)).toBe(true);
});

it("does not select a landing directly under an idle falling head", async () => {
  const { default: approach } = await import("./test-data/desert-approach.json");
  const s = structuredClone(approach) as BotState;
  const choices = movementOptions(s);
  expect(
    choices.some(
      (o) => o.command.kind !== "walk" && o.command.platformId === "level-five:platform:7"
    )
  ).toBe(false);
  expect(choices.some((o) => o.progress > 200)).toBe(true);
});

it("does not treat collision with the real warning head as a harmless forecast", async () => {
  const { fixture, platform } = await import("./fixtures");
  const s = fixture();
  s.position = { x: 92, y: 284 };
  s.platforms = [platform("floor", -92, 16, 1000)];
  s.hazards = [
    {
      id: "head",
      kind: "spikehead",
      active: false,
      warning: true,
      dx: 0,
      dy: 0,
      vx: 0,
      vy: 0,
      stompable: false,
      bounds: { dx: -16, dy: -16, width: 32, height: 32 },
    },
  ];
  expect(movementOptions(s).some((o) => o.command.kind === "walk")).toBe(false);
});
