import type { BotArtifact, OutboundMessage } from "@arena/shared";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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
  return renderHook((message: OutboundMessage | null) => useBotRegistry(message), {
    initialProps: initial,
  });
}

describe("useBotRegistry", () => {
  it("starts empty", () => {
    const { result } = renderWithMessage(null);

    expect(result.current).toEqual([]);
  });

  it("replaces the list on bot-registry-snapshot", () => {
    const { result, rerender } = renderWithMessage(null);

    act(() => {
      rerender({ type: "bot-registry-snapshot", bots: [sampleBot("b1"), sampleBot("b2")] });
    });

    expect(result.current).toEqual([sampleBot("b1"), sampleBot("b2")]);
  });

  it("appends a bot on bot-added", () => {
    const { result, rerender } = renderWithMessage({
      type: "bot-registry-snapshot",
      bots: [sampleBot("b1")],
    });

    act(() => {
      rerender({ type: "bot-added", bot: sampleBot("b2") });
    });

    expect(result.current).toEqual([sampleBot("b1"), sampleBot("b2")]);
  });

  it("filters out a bot on bot-removed", () => {
    const { result, rerender } = renderWithMessage({
      type: "bot-registry-snapshot",
      bots: [sampleBot("b1"), sampleBot("b2")],
    });

    act(() => {
      rerender({ type: "bot-removed", id: "b1" });
    });

    expect(result.current).toEqual([sampleBot("b2")]);
  });

  it("ignores unrelated message types", () => {
    const { result, rerender } = renderWithMessage({
      type: "bot-registry-snapshot",
      bots: [sampleBot("b1")],
    });

    act(() => {
      rerender({ type: "ping-broadcast", sentAt: "x", text: "x" });
    });

    expect(result.current).toEqual([sampleBot("b1")]);
  });

  it("does not add a bot twice", () => {
    const { result, rerender } = renderWithMessage({
      type: "bot-registry-snapshot",
      bots: [sampleBot("b1")],
    });

    act(() => {
      rerender({ type: "bot-added", bot: sampleBot("b1") });
    });

    expect(result.current).toEqual([sampleBot("b1")]);
  });
});
