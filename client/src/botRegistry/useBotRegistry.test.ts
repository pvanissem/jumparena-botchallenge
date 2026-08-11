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

function renderWithMessage(initial: OutboundMessage | null = null) {
  return renderHook(
    ({ message, status }: { message: OutboundMessage | null; status: ConnectionStatus }) =>
      useBotRegistry(message, status),
    { initialProps: { message: initial, status: "connected" as ConnectionStatus } }
  );
}

describe("useBotRegistry", () => {
  it("starts empty", () => {
    const { result } = renderWithMessage(null);

    expect(result.current).toEqual({ bots: [], initialized: false });
  });

  it("replaces the list on bot-registry-snapshot", () => {
    const { result, rerender } = renderWithMessage(null);

    act(() => {
      rerender({
        message: { type: "bot-registry-snapshot", bots: [sampleBot("b1"), sampleBot("b2")] },
        status: "connected",
      });
    });

    expect(result.current).toEqual({
      bots: [sampleBot("b1"), sampleBot("b2")],
      initialized: true,
    });
  });

  it("appends a bot on bot-added", () => {
    const { result, rerender } = renderWithMessage({
      type: "bot-registry-snapshot",
      bots: [sampleBot("b1")],
    });

    act(() => {
      rerender({ message: { type: "bot-added", bot: sampleBot("b2") }, status: "connected" });
    });

    expect(result.current.bots).toEqual([sampleBot("b1"), sampleBot("b2")]);
  });

  it("filters out a bot on bot-removed", () => {
    const { result, rerender } = renderWithMessage({
      type: "bot-registry-snapshot",
      bots: [sampleBot("b1"), sampleBot("b2")],
    });

    act(() => {
      rerender({ message: { type: "bot-removed", id: "b1" }, status: "connected" });
    });

    expect(result.current.bots).toEqual([sampleBot("b2")]);
  });

  it("ignores unrelated message types", () => {
    const { result, rerender } = renderWithMessage({
      type: "bot-registry-snapshot",
      bots: [sampleBot("b1")],
    });

    act(() => {
      rerender({
        message: { type: "ping-broadcast", sentAt: "x", text: "x" },
        status: "connected",
      });
    });

    expect(result.current.bots).toEqual([sampleBot("b1")]);
  });

  it("does not add a bot twice", () => {
    const { result, rerender } = renderWithMessage({
      type: "bot-registry-snapshot",
      bots: [sampleBot("b1")],
    });

    act(() => {
      rerender({ message: { type: "bot-added", bot: sampleBot("b1") }, status: "connected" });
    });

    expect(result.current.bots).toEqual([sampleBot("b1")]);
  });

  it("clears initialization for every reconnect cycle", () => {
    const { result, rerender } = renderWithMessage({
      type: "bot-registry-snapshot",
      bots: [sampleBot("b1")],
    });
    expect(result.current.initialized).toBe(true);

    rerender({ message: null, status: "connecting" });

    expect(result.current).toEqual({ bots: [], initialized: false });
  });
});
