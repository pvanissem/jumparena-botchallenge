import { cleanup, render, screen } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeHidDevice } from "./fakeHidDevice";
import { HidProbe } from "./HidProbe";

let device: FakeHidDevice;

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

describe("HidProbe", () => {
  let raf: ReturnType<typeof fakeRaf>;

  beforeEach(() => {
    raf = fakeRaf();
    device = new FakeHidDevice({
      productName: "USB Gamepad",
      vendorId: 0x0079,
      productId: 0x0011,
    });
    vi.stubGlobal("navigator", {
      hid: {
        requestDevice: vi.fn(async () => [device]),
        getDevices: vi.fn(async () => []),
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  async function connect() {
    render(<HidProbe />);
    await act(async () => {
      screen.getByRole("button", { name: /verbinden/i }).click();
    });
  }

  it("weist auf fehlende WebHID-Unterstützung hin", () => {
    vi.stubGlobal("navigator", {});
    render(<HidProbe />);
    expect(screen.getByText(/unterstützt WebHID nicht/i)).toBeTruthy();
  });

  it("bietet das Verbinden an", () => {
    render(<HidProbe />);
    expect(screen.getByRole("button", { name: /verbinden/i })).toBeTruthy();
  });

  it("zeigt nach dem Verbinden das Gerät an", async () => {
    await connect();
    expect(screen.getByTestId("hid-probe").textContent).toContain("USB Gamepad (0079:0011)");
  });

  it("zeigt die rohen Report-Bytes", async () => {
    await connect();
    act(() => {
      device.emit(0, [0x7f, 0x7f, 0x08]);
      raf.frame();
    });

    expect(screen.getByTestId("hid-bytes").textContent).toContain("7f 7f 08");
  });

  it("protokolliert Byte-Änderungen", async () => {
    await connect();
    act(() => {
      device.emit(0, [0x7f, 0x08]);
      raf.frame();
    });
    act(() => {
      device.emit(0, [0x00, 0x08]);
      raf.frame();
    });

    expect(screen.getByTestId("hid-changes").textContent).toContain("Byte 0: 7f → 00");
  });

  it("meldet einen Fehler beim Verbinden", async () => {
    vi.stubGlobal("navigator", {
      hid: {
        requestDevice: vi.fn(async () => {
          throw new Error("Zugriff verweigert");
        }),
        getDevices: vi.fn(async () => []),
      },
    });

    render(<HidProbe />);
    await act(async () => {
      screen.getByRole("button", { name: /verbinden/i }).click();
    });

    expect(screen.getByText(/Zugriff verweigert/i)).toBeTruthy();
  });

  it("meldet, wenn kein Gerät ausgewählt wurde", async () => {
    vi.stubGlobal("navigator", {
      hid: { requestDevice: vi.fn(async () => []), getDevices: vi.fn(async () => []) },
    });

    render(<HidProbe />);
    await act(async () => {
      screen.getByRole("button", { name: /verbinden/i }).click();
    });

    expect(screen.getByText(/Kein Gerät ausgewählt/i)).toBeTruthy();
  });
});
