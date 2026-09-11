import { renderHook } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFrameLoop } from "./useFrameLoop";

function fakeRaf() {
  const callbacks = new Map<number, FrameRequestCallback>();
  let nextId = 1;
  let now = 0;

  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    const id = nextId++;
    callbacks.set(id, callback);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => void callbacks.delete(id));

  return {
    pending: () => callbacks.size,
    frame(deltaMs = 16) {
      now += deltaMs;
      const due = [...callbacks.values()];
      callbacks.clear();
      for (const callback of due) callback(now);
    },
  };
}

describe("useFrameLoop", () => {
  let raf: ReturnType<typeof fakeRaf>;

  beforeEach(() => {
    raf = fakeRaf();
  });

  afterEach(() => vi.unstubAllGlobals());

  it("ruft den Callback in jedem Frame auf", () => {
    const callback = vi.fn();
    renderHook(() => useFrameLoop(callback));
    act(() => raf.frame());
    act(() => raf.frame());
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it("liefert das Zeitdelta zwischen zwei Frames", () => {
    const callback = vi.fn();
    renderHook(() => useFrameLoop(callback));
    act(() => raf.frame(16));
    act(() => raf.frame(32));
    expect(callback).toHaveBeenLastCalledWith(32);
  });

  it("läuft weiter, wenn der Callback einmal wirft", () => {
    // Ohne diesen Schutz stirbt die Schleife beim ersten Fehler dauerhaft –
    // die Eingabe käme danach NIE wieder an (siehe
    // `.features/play-mode-dead-loop/bugfix.md`).
    const callback = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error("einmaliger Aussetzer");
      })
      .mockImplementation(() => undefined);

    renderHook(() => useFrameLoop(callback));
    act(() => raf.frame());
    act(() => raf.frame());
    act(() => raf.frame());

    expect(callback).toHaveBeenCalledTimes(3);
  });

  it("plant den nächsten Frame auch bei einem Fehler ein", () => {
    renderHook(() =>
      useFrameLoop(() => {
        throw new Error("dauerhaft kaputt");
      })
    );
    act(() => raf.frame());
    expect(raf.pending()).toBe(1);
  });

  it("meldet den Fehler an den optionalen Fehler-Handler", () => {
    const onError = vi.fn();
    const boom = new Error("kaputt");
    renderHook(() =>
      useFrameLoop(
        () => {
          throw boom;
        },
        true,
        onError
      )
    );
    act(() => raf.frame());
    expect(onError).toHaveBeenCalledWith(boom);
  });

  it("hört auf, wenn die Komponente abgebaut wird", () => {
    const callback = vi.fn();
    const { unmount } = renderHook(() => useFrameLoop(callback));
    act(() => raf.frame());
    unmount();
    expect(raf.pending()).toBe(0);
  });

  it("startet gar nicht, wenn die Schleife deaktiviert ist", () => {
    const callback = vi.fn();
    renderHook(() => useFrameLoop(callback, false));
    expect(raf.pending()).toBe(0);
  });
});
