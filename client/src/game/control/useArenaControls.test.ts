import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useArenaControls } from "./useArenaControls";

describe("useArenaControls", () => {
  it("starts in keyboard mode with no bot selected", () => {
    const { result } = renderHook(() => useArenaControls());
    expect(result.current.mode).toBe("keyboard");
    expect(result.current.selectedBot).toBeNull();
  });

  it("switches to bot mode and back", () => {
    const { result } = renderHook(() => useArenaControls());

    act(() => result.current.setMode("bot"));
    expect(result.current.mode).toBe("bot");

    act(() => result.current.setMode("keyboard"));
    expect(result.current.mode).toBe("keyboard");
  });

  it("updates the selected bot", () => {
    const { result } = renderHook(() => useArenaControls());

    act(() => result.current.selectBot("bot-sammler.js"));

    expect(result.current.selectedBot).toBe("bot-sammler.js");
  });
});
