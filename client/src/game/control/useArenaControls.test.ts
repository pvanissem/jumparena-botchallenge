import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useArenaControls } from "./useArenaControls";

describe("useArenaControls", () => {
  it("starts in bot mode (Standardmodus am Stand: Bot laufen lassen)", () => {
    const { result } = renderHook(() => useArenaControls());
    expect(result.current.mode).toBe("bot");
  });

  it("switches to keyboard mode and back", () => {
    const { result } = renderHook(() => useArenaControls());

    act(() => result.current.setMode("keyboard"));
    expect(result.current.mode).toBe("keyboard");

    act(() => result.current.setMode("bot"));
    expect(result.current.mode).toBe("bot");
  });

  it("does not expose bot selection anymore (deterministic single bot file)", () => {
    const { result } = renderHook(() => useArenaControls());

    expect(result.current).not.toHaveProperty("selectedBot");
    expect(result.current).not.toHaveProperty("selectBot");
  });
});
