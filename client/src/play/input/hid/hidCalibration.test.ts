import { describe, expect, it } from "vitest";
import { CALIBRATION_STEPS } from "../inputs";
import {
  createHidCalibrationState,
  HID_REST_SAMPLES,
  type HidCalibrationState,
  hidCalibrationReducer,
  toHidMapping,
} from "./hidCalibration";

/** Adapter-Report: Byte 0/1 Achsen (Ruhe 0x7f), Byte 5 Tasten-Bits. */
function report(overrides: Partial<Record<number, number>> = {}): number[] {
  const bytes = [0x7f, 0x7f, 0x7f, 0x7f, 0x0f, 0x00, 0x00];
  for (const [index, value] of Object.entries(overrides)) bytes[Number(index)] = value as number;
  return bytes;
}

function feed(state: HidCalibrationState, bytes: number[], times = 1): HidCalibrationState {
  let next = state;
  for (let round = 0; round < times; round++) {
    next = hidCalibrationReducer(next, { type: "report", reportId: 0, bytes });
  }
  return next;
}

/** Ruhelage vermessen lassen. */
function rested(): HidCalibrationState {
  return feed(createHidCalibrationState("0079:0011", "USB Gamepad"), report(), HID_REST_SAMPLES);
}

describe("Ruhelage", () => {
  it("beginnt mit der Messung des Ruhezustands", () => {
    expect(createHidCalibrationState("k", "l").phase).toBe("measuring-rest");
  });

  it("wechselt nach genügend Proben in die Erfassung", () => {
    expect(rested().phase).toBe("capture");
  });

  it("hält die Ruhewerte je Byte fest", () => {
    expect(rested().rest).toEqual(report());
  });

  it("ist unempfindlich gegen einzelne Ausreißer", () => {
    let state = createHidCalibrationState("k", "l");
    state = feed(state, report(), HID_REST_SAMPLES - 2);
    state = feed(state, report({ 0: 0x00 }), 1);
    state = feed(state, report(), 3);
    expect(state.rest?.[0]).toBe(0x7f);
  });

  it("meldet den Fortschritt der Messung", () => {
    const state = feed(createHidCalibrationState("k", "l"), report(), 3);
    expect(state.restSampleCount).toBe(3);
  });
});

describe("Belegungen erfassen", () => {
  it("fragt zuerst nach LINKS", () => {
    expect(CALIBRATION_STEPS[rested().stepIndex]).toBe("left");
  });

  it("erkennt die Achse für LINKS", () => {
    const state = feed(rested(), report({ 0: 0x00 }));
    expect(state.bindings.left).toMatchObject({ byteIndex: 0, value: 0x00 });
  });

  it("wartet auf die Rückkehr in die Ruhelage, bevor es weitergeht", () => {
    let state = feed(rested(), report({ 0: 0x00 }));
    expect(CALIBRATION_STEPS[state.stepIndex]).toBe("left");

    state = feed(state, report({ 0: 0x00 }));
    expect(CALIBRATION_STEPS[state.stepIndex]).toBe("left");

    state = feed(state, report());
    expect(CALIBRATION_STEPS[state.stepIndex]).toBe("right");
  });

  it("unterscheidet RECHTS von LINKS auf derselben Achse", () => {
    let state = feed(rested(), report({ 0: 0x00 }));
    state = feed(state, report());
    state = feed(state, report({ 0: 0xff }));

    expect(state.bindings.right).toMatchObject({ byteIndex: 0, value: 0xff });
    expect(state.error).toBeNull();
  });

  it("erkennt eine Taste als Bit-Belegung", () => {
    // Vier Richtungen über die Achsenbytes belegen, dann eine echte Taste.
    let state = rested();
    const directions = [
      report({ 0: 0x00 }),
      report({ 0: 0xff }),
      report({ 1: 0x00 }),
      report({ 1: 0xff }),
    ];
    for (const press of directions) {
      state = feed(state, press);
      state = feed(state, report());
    }

    state = feed(state, report({ 5: 0b0000_0100 }));
    expect(state.bindings.jump).toEqual({
      reportId: 0,
      byteIndex: 5,
      mask: 0b0000_0100,
      value: 0b0000_0100,
    });
  });

  it("lehnt eine doppelt vergebene Belegung ab", () => {
    let state = feed(rested(), report({ 0: 0x00 }));
    state = feed(state, report());
    state = feed(state, report({ 0: 0x00 }));

    expect(state.error).toBe("already-bound");
    expect(state.bindings.right).toBeUndefined();
  });

  it("ignoriert Rauschen einzelner Bits an Achsenbytes", () => {
    const state = feed(rested(), report({ 0: 0x80 }));
    expect(state.bindings.left).toBeUndefined();
  });

  it("schließt nach dem letzten Schritt ab", () => {
    let state = rested();
    const values = [0x00, 0xff, 0x00, 0xff];
    for (let step = 0; step < CALIBRATION_STEPS.length; step++) {
      const bytes =
        step < 4 ? report({ [step < 2 ? 0 : 1]: values[step] }) : report({ 5: 1 << (step - 4) });
      state = feed(state, bytes);
      state = feed(state, report());
    }
    expect(state.phase).toBe("verify");
  });
});

describe("toHidMapping", () => {
  it("liefert erst bei vollständiger Belegung ein Mapping", () => {
    expect(toHidMapping(rested())).toBeNull();
  });

  it("übernimmt Schlüssel und Bezeichnung des Geräts", () => {
    let state = rested();
    const values = [0x00, 0xff, 0x00, 0xff];
    for (let step = 0; step < CALIBRATION_STEPS.length; step++) {
      const bytes =
        step < 4 ? report({ [step < 2 ? 0 : 1]: values[step] }) : report({ 5: 1 << (step - 4) });
      state = feed(state, bytes);
      state = feed(state, report());
    }

    const mapping = toHidMapping(state);
    expect(mapping?.deviceKey).toBe("0079:0011");
    expect(mapping?.label).toBe("USB Gamepad");
    expect(Object.keys(mapping?.bindings ?? {})).toHaveLength(CALIBRATION_STEPS.length);
  });
});

describe("Neustart", () => {
  it("beginnt die Belegungen von vorn, behält aber die Ruhelage", () => {
    let state = feed(rested(), report({ 0: 0x00 }));
    state = hidCalibrationReducer(state, { type: "restart" });

    expect(state.stepIndex).toBe(0);
    expect(state.bindings).toEqual({});
    expect(state.rest).not.toBeNull();
    expect(state.phase).toBe("capture");
  });
});
