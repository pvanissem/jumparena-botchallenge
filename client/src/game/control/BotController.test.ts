import type { BotState } from "@arena/bot-contract";
import { describe, expect, it, vi } from "vitest";
import { BotController } from "./BotController";

const SAMPLE_STATE = {} as BotState;

function fakeRunner() {
  return {
    tick: vi.fn().mockResolvedValue(["jump", "right"]),
    dispose: vi.fn(),
  };
}

describe("BotController", () => {
  it("delegates getNextActions to runner.tick with the given botState", async () => {
    const runner = fakeRunner();
    const controller = new BotController(runner as never);

    const actions = await controller.getNextActions({ botState: SAMPLE_STATE });

    expect(runner.tick).toHaveBeenCalledTimes(1);
    expect(runner.tick).toHaveBeenCalledWith(SAMPLE_STATE);
    expect(actions).toEqual(["jump", "right"]);
  });

  it("delegates dispose to runner.dispose", () => {
    const runner = fakeRunner();
    const controller = new BotController(runner as never);

    controller.dispose();

    expect(runner.dispose).toHaveBeenCalledTimes(1);
  });
});
