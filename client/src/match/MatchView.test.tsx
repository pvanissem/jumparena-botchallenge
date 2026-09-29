import type { OutboundMessage } from "@arena/shared";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MatchView } from "./MatchView";

const runner = vi.hoisted(() => ({ start: vi.fn(), stop: vi.fn(), skip: vi.fn() }));
vi.mock("./MatchRunner", () => ({
  MatchRunner: class {
    start = runner.start;
    stop = runner.stop;
    skip = runner.skip;
  },
}));
vi.mock("./MatchBootScene", () => ({ MatchBootScene: class {} }));
vi.mock("phaser", () => ({
  default: {
    AUTO: 0,
    Game: class {
      scale = { resize: vi.fn() };
      destroy = vi.fn();
    },
  },
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it("handles remote skip for the current attempt without a present button or engine restart", () => {
  const listeners = new Set<(message: OutboundMessage) => void>();
  const subscribe = (listener: (message: OutboundMessage) => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    }
  );
  const { unmount } = render(
    <MatchView
      match={{ id: "m1", participants: [], status: "running", result: null }}
      levelId="level-one"
      livesPerRun={3}
      sourceById={new Map()}
      onProgress={vi.fn()}
      onFinished={vi.fn()}
      matchAttemptId="a1"
      subscribe={subscribe}
    />
  );

  expect(screen.queryByRole("button", { name: "Überspringen" })).toBeNull();
  const emit = (message: OutboundMessage) =>
    act(() => {
      for (const listener of listeners) listener(message);
    });
  emit({ type: "match-skip", matchId: "old", matchAttemptId: "a1" });
  emit({ type: "match-skip", matchId: "m1", matchAttemptId: "old" });
  expect(runner.skip).not.toHaveBeenCalled();
  emit({ type: "match-skip", matchId: "m1", matchAttemptId: "a1" });
  expect(runner.skip).toHaveBeenCalledTimes(1);
  expect(runner.start).toHaveBeenCalledTimes(1);
  unmount();
  expect(listeners.size).toBe(0);
});
