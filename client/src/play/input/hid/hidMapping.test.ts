import { describe, expect, it } from "vitest";
import { emptySnapshot } from "../inputSnapshot";
import { PLAY_INPUTS } from "../inputs";
import type { HidBinding } from "./hidBindings";
import { type HidMapping, hidDeviceKey, readHidSnapshot } from "./hidMapping";

/** Typischer Adapter: Byte 0 = X-Achse (0x00 links, 0x7f Mitte, 0xff rechts),
 *  Byte 1 = Y-Achse, Byte 5 = Tasten-Bits. */
function mapping(): HidMapping {
  const bindings: Record<string, HidBinding> = {
    left: { reportId: 0, byteIndex: 0, mask: 0xff, value: 0x00, tolerance: 0x30 },
    right: { reportId: 0, byteIndex: 0, mask: 0xff, value: 0xff, tolerance: 0x30 },
    up: { reportId: 0, byteIndex: 1, mask: 0xff, value: 0x00, tolerance: 0x30 },
    down: { reportId: 0, byteIndex: 1, mask: 0xff, value: 0xff, tolerance: 0x30 },
    jump: { reportId: 0, byteIndex: 5, mask: 0b0010_0000, value: 0b0010_0000 },
    sprint: { reportId: 0, byteIndex: 5, mask: 0b0100_0000, value: 0b0100_0000 },
    confirm: { reportId: 0, byteIndex: 6, mask: 0b0000_0010, value: 0b0000_0010 },
    back: { reportId: 0, byteIndex: 6, mask: 0b0000_0001, value: 0b0000_0001 },
  };
  return {
    deviceKey: "0079:0011",
    label: "USB Gamepad",
    bindings: bindings as HidMapping["bindings"],
  };
}

const REST = [0x7f, 0x7f, 0x7f, 0x7f, 0x0f, 0x00, 0x00];

describe("readHidSnapshot", () => {
  it("liefert im Ruhezustand keine aktive Eingabe", () => {
    expect(readHidSnapshot(REST, mapping())).toEqual(emptySnapshot());
  });

  it("erkennt links am Achsenbyte", () => {
    const report = [...REST];
    report[0] = 0x00;
    expect(readHidSnapshot(report, mapping()).left).toBe(true);
  });

  it("erkennt rechts am selben Achsenbyte", () => {
    const report = [...REST];
    report[0] = 0xff;
    const snapshot = readHidSnapshot(report, mapping());
    expect(snapshot.right).toBe(true);
    expect(snapshot.left).toBe(false);
  });

  it("erkennt eine Taste am Bit", () => {
    const report = [...REST];
    report[5] = 0b0010_0000;
    expect(readHidSnapshot(report, mapping()).jump).toBe(true);
  });

  it("erlaubt Richtung, Sprint und Sprung gleichzeitig", () => {
    const report = [...REST];
    report[0] = 0xff;
    report[5] = 0b0110_0000;
    const snapshot = readHidSnapshot(report, mapping());
    expect(snapshot.right).toBe(true);
    expect(snapshot.sprint).toBe(true);
    expect(snapshot.jump).toBe(true);
  });

  it("enthält immer alle acht logischen Eingaben", () => {
    expect(Object.keys(readHidSnapshot(REST, mapping())).sort()).toEqual([...PLAY_INPUTS].sort());
  });

  it("liefert für einen leeren Report nichts Aktives", () => {
    expect(readHidSnapshot([], mapping())).toEqual(emptySnapshot());
  });
});

describe("hidDeviceKey", () => {
  it("bildet den Schlüssel aus Vendor- und Produkt-ID", () => {
    expect(hidDeviceKey({ vendorId: 0x0079, productId: 0x0011 })).toBe("0079:0011");
  });

  it("füllt kurze IDs auf vier Stellen auf", () => {
    expect(hidDeviceKey({ vendorId: 0x1, productId: 0x2 })).toBe("0001:0002");
  });

  it("liefert für baugleiche Geräte denselben Schlüssel", () => {
    expect(hidDeviceKey({ vendorId: 121, productId: 17 })).toBe(
      hidDeviceKey({ vendorId: 121, productId: 17 })
    );
  });
});
