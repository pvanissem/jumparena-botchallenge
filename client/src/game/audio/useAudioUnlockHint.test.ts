import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useAudioUnlockHint } from "./useAudioUnlockHint";

describe("useAudioUnlockHint", () => {
  afterEach(() => {
    // Sicherstellen, dass keine Listener zwischen Tests hängen bleiben.
    window.dispatchEvent(new Event("pointerdown"));
  });

  it("starts locked (true) before any interaction", () => {
    const { result } = renderHook(() => useAudioUnlockHint());
    expect(result.current).toBe(true);
  });

  it("becomes unlocked (false) after a pointerdown on window", () => {
    const { result } = renderHook(() => useAudioUnlockHint());

    act(() => {
      window.dispatchEvent(new Event("pointerdown"));
    });

    expect(result.current).toBe(false);
  });

  it("becomes unlocked (false) after a keydown on window", () => {
    const { result } = renderHook(() => useAudioUnlockHint());

    act(() => {
      window.dispatchEvent(new Event("keydown"));
    });

    expect(result.current).toBe(false);
  });

  it("stays unlocked after further interactions (no flip back to true)", () => {
    const { result } = renderHook(() => useAudioUnlockHint());

    act(() => {
      window.dispatchEvent(new Event("pointerdown"));
      window.dispatchEvent(new Event("keydown"));
    });

    expect(result.current).toBe(false);
  });
});
