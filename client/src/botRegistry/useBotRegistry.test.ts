import type { BotArtifact, OutboundMessage } from "@arena/shared";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ConnectionStatus } from "../ws/WebSocketClient";
import { useBotRegistry } from "./useBotRegistry";

function sampleBot(id: string): BotArtifact {
  return {
    id,
    name: "Bot",
    author: "A",
    color: "#000000",
    sourceCode: "export default {}",
    uploadedAt: "2024-01-01T00:00:00.000Z",
  };
}

function renderRegistry(initial: OutboundMessage | null = null) {
  const listeners = new Set<(message: OutboundMessage) => void>();
  const subscribe = (listener: (message: OutboundMessage) => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };
  const rendered = renderHook(
    ({ status }: { status: ConnectionStatus }) => useBotRegistry(subscribe, status),
    { initialProps: { status: "connected" as ConnectionStatus } }
  );
  const emit = (message: OutboundMessage) => {
    act(() => {
      for (const listener of listeners) listener(message);
    });
  };
  if (initial) emit(initial);
  return { ...rendered, emit };
}

describe("useBotRegistry", () => {
  it("starts empty", () => {
    const { result } = renderRegistry();

    expect(result.current).toEqual({ bots: [], initialized: false });
  });

  it("replaces the list on bot-registry-snapshot", () => {
    const { result, emit } = renderRegistry();
    emit({ type: "bot-registry-snapshot", bots: [sampleBot("b1"), sampleBot("b2")] });

    expect(result.current).toEqual({
      bots: [sampleBot("b1"), sampleBot("b2")],
      initialized: true,
    });
  });

  it("appends a bot on bot-added", () => {
    const { result, emit } = renderRegistry({
      type: "bot-registry-snapshot",
      bots: [sampleBot("b1")],
    });

    emit({ type: "bot-added", bot: sampleBot("b2") });

    expect(result.current.bots).toEqual([sampleBot("b1"), sampleBot("b2")]);
  });

  it("filters out a bot on bot-removed", () => {
    const { result, emit } = renderRegistry({
      type: "bot-registry-snapshot",
      bots: [sampleBot("b1"), sampleBot("b2")],
    });

    emit({ type: "bot-removed", id: "b1" });

    expect(result.current.bots).toEqual([sampleBot("b2")]);
  });

  it("ignores unrelated message types", () => {
    const { result, emit } = renderRegistry({
      type: "bot-registry-snapshot",
      bots: [sampleBot("b1")],
    });

    emit({ type: "ping-broadcast", sentAt: "x", text: "x" });

    expect(result.current.bots).toEqual([sampleBot("b1")]);
  });

  it("does not add a bot twice", () => {
    const { result, emit } = renderRegistry({
      type: "bot-registry-snapshot",
      bots: [sampleBot("b1")],
    });

    emit({ type: "bot-added", bot: sampleBot("b1") });

    expect(result.current.bots).toEqual([sampleBot("b1")]);
  });

  it("clears initialization for every reconnect cycle", () => {
    const { result, rerender } = renderRegistry({
      type: "bot-registry-snapshot",
      bots: [sampleBot("b1")],
    });
    expect(result.current.initialized).toBe(true);

    rerender({ status: "connecting" });

    expect(result.current).toEqual({ bots: [], initialized: false });
  });
});
