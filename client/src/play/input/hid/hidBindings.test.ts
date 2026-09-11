import { describe, expect, it } from "vitest";
import {
  detectHidBinding,
  diffReportBytes,
  type HidBinding,
  resolveHidBinding,
} from "./hidBindings";

describe("resolveHidBinding – Bit-Belegungen (klassische Tasten)", () => {
  const binding: HidBinding = { reportId: 0, byteIndex: 5, mask: 0b0001_0000, value: 0b0001_0000 };

  it("erkennt das gesetzte Bit als gedrückt", () => {
    expect(resolveHidBinding([0, 0, 0, 0, 0, 0b0001_0000], binding)).toBe(true);
  });

  it("erkennt das fehlende Bit als nicht gedrückt", () => {
    expect(resolveHidBinding([0, 0, 0, 0, 0, 0b0000_0000], binding)).toBe(false);
  });

  it("lässt sich von anderen Bits im selben Byte nicht stören", () => {
    expect(resolveHidBinding([0, 0, 0, 0, 0, 0b1011_0001], binding)).toBe(true);
  });

  it("liefert false, wenn der Report zu kurz ist", () => {
    expect(resolveHidBinding([0, 0], binding)).toBe(false);
  });
});

describe("resolveHidBinding – Wert-Belegungen (Hat-Switch / Achsenbyte)", () => {
  /** Steuerkreuz als Hat im unteren Nibble: 0=hoch, 2=rechts, 4=runter, 6=links, 8=neutral. */
  const left: HidBinding = { reportId: 0, byteIndex: 5, mask: 0x0f, value: 6 };
  const up: HidBinding = { reportId: 0, byteIndex: 5, mask: 0x0f, value: 0 };

  it("erkennt die Hat-Richtung", () => {
    expect(resolveHidBinding([0, 0, 0, 0, 0, 0x06], left)).toBe(true);
  });

  it("verwechselt Hat-Richtungen nicht miteinander", () => {
    expect(resolveHidBinding([0, 0, 0, 0, 0, 0x06], up)).toBe(false);
    expect(resolveHidBinding([0, 0, 0, 0, 0, 0x00], left)).toBe(false);
  });

  it("ignoriert das obere Nibble (dort liegen oft Tasten)", () => {
    expect(resolveHidBinding([0, 0, 0, 0, 0, 0xa6], left)).toBe(true);
  });

  it("erkennt die Neutralstellung als nicht gedrückt", () => {
    expect(resolveHidBinding([0, 0, 0, 0, 0, 0x08], left)).toBe(false);
  });

  it("toleriert Rauschen bei Achsenbytes", () => {
    const axisLeft: HidBinding = {
      reportId: 0,
      byteIndex: 0,
      mask: 0xff,
      value: 0x00,
      tolerance: 0x30,
    };
    expect(resolveHidBinding([0x05], axisLeft)).toBe(true);
    expect(resolveHidBinding([0x7f], axisLeft)).toBe(false);
  });
});

describe("diffReportBytes", () => {
  it("nennt die geänderten Byte-Positionen", () => {
    expect(diffReportBytes([0x7f, 0x7f, 0x00], [0x00, 0x7f, 0x00])).toEqual([0]);
  });

  it("meldet mehrere Änderungen", () => {
    expect(diffReportBytes([0, 0, 0], [1, 0, 4])).toEqual([0, 2]);
  });

  it("meldet nichts bei identischen Reports", () => {
    expect(diffReportBytes([1, 2, 3], [1, 2, 3])).toEqual([]);
  });

  it("kommt mit unterschiedlich langen Reports zurecht", () => {
    expect(diffReportBytes([1], [1, 5])).toEqual([1]);
  });
});

describe("detectHidBinding", () => {
  it("erkennt eine einzelne gesetzte Taste als Bit-Belegung", () => {
    const binding = detectHidBinding(0, [0x00, 0x08], [0x00, 0x08 | 0b0010_0000]);
    expect(binding).toEqual({
      reportId: 0,
      byteIndex: 1,
      mask: 0b0010_0000,
      value: 0b0010_0000,
    });
  });

  it("erkennt eine Hat-Richtung als Wert-Belegung im unteren Nibble", () => {
    // Ruhe: Hat neutral (8). Gedrückt: links (6) – mehrere Bits ändern sich.
    const binding = detectHidBinding(0, [0x00, 0x08], [0x00, 0x06]);
    expect(binding).toEqual({ reportId: 0, byteIndex: 1, mask: 0x0f, value: 0x06 });
  });

  it("unterscheidet zwei Hat-Richtungen desselben Bytes", () => {
    const left = detectHidBinding(0, [0x08], [0x06]);
    const right = detectHidBinding(0, [0x08], [0x02]);
    expect(left).not.toEqual(right);
  });

  it("erkennt ein Achsenbyte am Anschlag als tolerante Wert-Belegung", () => {
    const binding = detectHidBinding(0, [0x7f, 0x7f], [0x00, 0x7f]);
    expect(binding).toMatchObject({ byteIndex: 0, mask: 0xff, value: 0x00 });
    expect(binding?.tolerance).toBeGreaterThan(0);
  });

  it("erkennt den Vollausschlag nach oben als Achse, nicht als Taste", () => {
    // 0x7f -> 0xff ist genau EIN gekipptes Bit und damit von einer Taste nicht
    // zu unterscheiden – entscheidend ist die mittige Ruhelage des Bytes.
    const binding = detectHidBinding(0, [0x7f], [0xff]);
    expect(binding).toMatchObject({ byteIndex: 0, mask: 0xff, value: 0xff });
    expect(binding?.tolerance).toBeGreaterThan(0);
  });

  it("erkennt ein gekipptes Bit in einem bei 0 ruhenden Byte weiterhin als Taste", () => {
    expect(detectHidBinding(0, [0x00], [0x80])).toEqual({
      reportId: 0,
      byteIndex: 0,
      mask: 0x80,
      value: 0x80,
    });
  });

  it("erkennt das andere Ende derselben Achse getrennt", () => {
    const left = detectHidBinding(0, [0x7f], [0x00]);
    const right = detectHidBinding(0, [0x7f], [0xff]);
    expect(left).not.toEqual(right);
  });

  it("liefert null, wenn sich nichts geändert hat", () => {
    expect(detectHidBinding(0, [0x7f, 0x08], [0x7f, 0x08])).toBeNull();
  });

  it("ignoriert Änderungen um nur ein Bit Rauschen an Achsenbytes", () => {
    expect(detectHidBinding(0, [0x7f], [0x80])).toBeNull();
  });

  it("behält die Report-ID bei", () => {
    expect(detectHidBinding(3, [0x00], [0x01])?.reportId).toBe(3);
  });
});

describe("Zusammenspiel Erkennung → Auflösung", () => {
  it("eine erkannte Hat-Richtung wird später korrekt wiedererkannt", () => {
    const rest = [0x00, 0x08];
    const binding = detectHidBinding(0, rest, [0x00, 0x06]);

    expect(binding).not.toBeNull();
    expect(resolveHidBinding([0x00, 0x06], binding as HidBinding)).toBe(true);
    expect(resolveHidBinding(rest, binding as HidBinding)).toBe(false);
  });

  it("eine erkannte Taste wird später korrekt wiedererkannt", () => {
    const rest = [0x00, 0x08];
    const binding = detectHidBinding(0, rest, [0b0100_0000, 0x08]);

    expect(resolveHidBinding([0b0100_0000, 0x08], binding as HidBinding)).toBe(true);
    expect(resolveHidBinding(rest, binding as HidBinding)).toBe(false);
  });

  it("Links und Rechts derselben Achse schließen sich gegenseitig aus", () => {
    const left = detectHidBinding(0, [0x7f], [0x00]) as HidBinding;
    const right = detectHidBinding(0, [0x7f], [0xff]) as HidBinding;

    expect(resolveHidBinding([0x00], left)).toBe(true);
    expect(resolveHidBinding([0x00], right)).toBe(false);
    expect(resolveHidBinding([0xff], right)).toBe(true);
    expect(resolveHidBinding([0xff], left)).toBe(false);
  });
});
