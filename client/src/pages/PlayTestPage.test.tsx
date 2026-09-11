import { cleanup, render, screen } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlayTestPage } from "./PlayTestPage";

let pads: unknown[] = [];

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
    frame(deltaMs = 16) {
      now += deltaMs;
      const due = [...callbacks.values()];
      callbacks.clear();
      for (const callback of due) callback(now);
    },
  };
}

function gamepad(pressedIndices: number[] = [], axes = [0, 0]) {
  return {
    id: "USB Gamepad (STANDARD GAMEPAD Vendor: 0079 Product: 0011)",
    index: 0,
    connected: true,
    mapping: "standard",
    timestamp: 1,
    buttons: Array.from({ length: 16 }, (_, index) => ({
      pressed: pressedIndices.includes(index),
      value: pressedIndices.includes(index) ? 1 : 0,
    })),
    axes,
  };
}

describe("PlayTestPage", () => {
  let raf: ReturnType<typeof fakeRaf>;

  beforeEach(() => {
    raf = fakeRaf();
    pads = [];
    vi.stubGlobal("navigator", { getGamepads: () => pads, userAgent: "TestBrowser/1.0" });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("erklärt, was zu tun ist", () => {
    render(<PlayTestPage />);
    expect(screen.getByText(/alle/i)).toBeTruthy();
  });

  it("weist darauf hin, wenn der Browser gar kein Gamepad liefert", () => {
    render(<PlayTestPage />);
    act(() => raf.frame(200));
    expect(screen.getByTestId("test-pads").textContent).toMatch(/liefert nichts/i);
  });

  it("zeigt die Rohdaten eines erkannten Pads", () => {
    pads = [gamepad()];
    render(<PlayTestPage />);
    act(() => raf.frame(200));

    const text = screen.getByTestId("test-pads").textContent ?? "";
    expect(text).toContain("Vendor: 0079");
    expect(text).toContain("16 Tasten");
  });

  it("zeichnet einen Tastendruck auf", () => {
    pads = [gamepad()];
    render(<PlayTestPage />);
    act(() => raf.frame(200));

    pads = [gamepad([4])];
    act(() => raf.frame(200));

    expect(screen.getByTestId("test-events").textContent).toContain("Taste 4");
  });

  it("zeichnet auch einen Tastendruck auf, der nur einen Frame dauert", () => {
    pads = [gamepad()];
    render(<PlayTestPage />);
    act(() => raf.frame(200));

    // Druck und Loslassen innerhalb der Anzeige-Drosselung (100 ms)
    pads = [gamepad([7])];
    act(() => raf.frame(8));
    pads = [gamepad()];
    act(() => raf.frame(8));
    act(() => raf.frame(200));

    const text = screen.getByTestId("test-events").textContent ?? "";
    expect(text).toContain("Taste 7");
  });

  it("zeichnet Achsenbewegungen auf", () => {
    pads = [gamepad()];
    render(<PlayTestPage />);
    act(() => raf.frame(200));

    pads = [gamepad([], [-1, 0])];
    act(() => raf.frame(200));

    expect(screen.getByTestId("test-events").textContent).toContain("Achse 0");
  });

  it("zählt die aufgezeichneten Ereignisse", () => {
    pads = [gamepad()];
    render(<PlayTestPage />);
    act(() => raf.frame(200));
    pads = [gamepad([1])];
    act(() => raf.frame(200));

    expect(screen.getByTestId("test-stats").textContent).toMatch(/Ereignisse:\s*1/);
  });

  it("zeigt jede Taste einzeln an, damit fehlende Tasten auffallen", () => {
    pads = [gamepad()];
    render(<PlayTestPage />);
    act(() => raf.frame(200));

    const matrix = document.querySelectorAll(".play-test__matrix li");
    expect(matrix).toHaveLength(16);
  });

  it("markiert die gerade gedrückte Taste", () => {
    pads = [gamepad([14])];
    render(<PlayTestPage />);
    act(() => raf.frame(200));

    const matrix = document.querySelectorAll(".play-test__matrix li");
    expect(matrix[14].getAttribute("data-active")).toBe("true");
    expect(matrix[13].getAttribute("data-active")).toBe("false");
  });

  it("merkt sich, welche Tasten im Test schon einmal reagiert haben", () => {
    pads = [gamepad()];
    render(<PlayTestPage />);
    act(() => raf.frame(200));
    pads = [gamepad([12])];
    act(() => raf.frame(200));
    pads = [gamepad()];
    act(() => raf.frame(200));

    const matrix = document.querySelectorAll(".play-test__matrix li");
    expect(matrix[12].getAttribute("data-seen")).toBe("true");
    expect(matrix[14].getAttribute("data-seen")).toBe("false");
  });

  it("erkennt Tasten, die pressed ohne Analogwert melden", () => {
    const pad = gamepad();
    pad.buttons[14] = { pressed: true, value: 0 };
    pads = [pad];
    render(<PlayTestPage />);
    act(() => raf.frame(200));

    const matrix = document.querySelectorAll(".play-test__matrix li");
    expect(matrix[14].getAttribute("data-active")).toBe("true");
    expect(screen.getByTestId("test-pads").textContent).toContain("ohne Analogwert");
  });

  it("zeigt die Frequenz der Schleife", () => {
    render(<PlayTestPage />);
    act(() => raf.frame(200));
    act(() => raf.frame(200));
    expect(screen.getByTestId("test-stats").textContent).toMatch(/Hz/);
  });

  it("bietet Kopieren und Zurücksetzen an", () => {
    render(<PlayTestPage />);
    expect(screen.getByRole("button", { name: /kopieren/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /leeren/i })).toBeTruthy();
  });
});
