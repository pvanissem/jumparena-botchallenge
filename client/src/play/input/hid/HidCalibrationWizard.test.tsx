import { cleanup, render, screen } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CALIBRATION_STEPS } from "../inputs";
import { FakeHidDevice } from "./fakeHidDevice";
import { HidCalibrationWizard } from "./HidCalibrationWizard";
import { HidSource } from "./HidSource";
import { HID_REST_SAMPLES } from "./hidCalibration";

const REST = [0x7f, 0x7f, 0x00];

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
    frame() {
      now += 16;
      const due = [...callbacks.values()];
      callbacks.clear();
      for (const callback of due) callback(now);
    },
  };
}

describe("HidCalibrationWizard", () => {
  let raf: ReturnType<typeof fakeRaf>;
  let device: FakeHidDevice;
  let source: HidSource;

  beforeEach(async () => {
    raf = fakeRaf();
    device = new FakeHidDevice({ productName: "USB Gamepad", vendorId: 0x79, productId: 0x11 });
    source = new HidSource(device);
    await source.start();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  function setup(onComplete = vi.fn()) {
    render(
      <HidCalibrationWizard
        source={source}
        deviceKey="0079:0011"
        label="USB Gamepad"
        stationLabel="Spieler 1 (LINKS)"
        onComplete={onComplete}
        onCancel={vi.fn()}
      />
    );
    return onComplete;
  }

  /** Reports einspeisen und Frames laufen lassen. */
  function feed(bytes: number[], times = 1) {
    act(() => {
      for (let round = 0; round < times; round++) {
        device.emit(0, bytes);
        raf.frame();
      }
    });
  }

  function measureRest() {
    feed(REST, HID_REST_SAMPLES + 2);
  }

  it("misst zuerst den Ruhezustand", () => {
    setup();
    expect(screen.getByText(/Ruhezustand wird gemessen/i)).toBeTruthy();
  });

  it("fragt danach die erste Belegung ab", () => {
    setup();
    measureRest();
    expect(screen.getByTestId("hid-step").textContent).toBe("LINKS");
  });

  it("erkennt LINKS auf dem Achsenbyte", () => {
    setup();
    measureRest();
    feed([0x00, 0x7f, 0x00]);
    feed(REST);
    expect(screen.getByTestId("hid-step").textContent).toBe("RECHTS");
  });

  it("erkennt RECHTS auf derselben Achse (der ursprüngliche Fehlerfall)", () => {
    setup();
    measureRest();
    feed([0x00, 0x7f, 0x00]);
    feed(REST);
    feed([0xff, 0x7f, 0x00]);
    feed(REST);

    expect(screen.queryByText(/bereits belegt/i)).toBeNull();
    expect(screen.getByTestId("hid-step").textContent).toBe("HOCH");
  });

  it("zeigt die rohen Bytes zur Kontrolle", () => {
    setup();
    feed([0x7f, 0x10, 0x00]);
    expect(screen.getByTestId("hid-calibration-bytes").textContent).toContain("7f 10 00");
  });

  it("schließt nach allen Schritten mit einem Mapping ab", () => {
    const onComplete = setup();
    measureRest();

    const presses = [
      [0x00, 0x7f, 0x00],
      [0xff, 0x7f, 0x00],
      [0x7f, 0x00, 0x00],
      [0x7f, 0xff, 0x00],
      [0x7f, 0x7f, 0x01],
      [0x7f, 0x7f, 0x02],
      [0x7f, 0x7f, 0x04],
      [0x7f, 0x7f, 0x08],
    ];
    for (const press of presses) {
      feed(press);
      feed(REST);
    }

    act(() => screen.getByRole("button", { name: /passt/i }).click());

    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({ deviceKey: "0079:0011", label: "USB Gamepad" })
    );
    const mapping = onComplete.mock.calls[0][0];
    expect(Object.keys(mapping.bindings)).toHaveLength(CALIBRATION_STEPS.length);
  });
});
