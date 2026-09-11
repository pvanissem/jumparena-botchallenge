import { describe, expect, it } from "vitest";
import { buildReport, diffSnapshots, type PadSnapshot, snapshotPads } from "./padRecorder";

function rawPad(overrides: Record<string, unknown> = {}) {
  return {
    id: "Test Pad",
    index: 0,
    connected: true,
    mapping: "standard",
    timestamp: 100,
    buttons: [
      { pressed: false, value: 0 },
      { pressed: false, value: 0 },
    ],
    axes: [0, 0],
    ...overrides,
  };
}

function snapshot(overrides: Partial<PadSnapshot> = {}): PadSnapshot {
  return {
    index: 0,
    id: "Test Pad",
    mapping: "standard",
    timestamp: 100,
    buttons: [0, 0],
    axes: [0, 0],
    pressedWithoutValue: [],
    ...overrides,
  };
}

describe("snapshotPads", () => {
  it("übernimmt alle Rohwerte eines Pads", () => {
    const [entry] = snapshotPads([rawPad()]);
    expect(entry).toEqual({
      index: 0,
      id: "Test Pad",
      mapping: "standard",
      timestamp: 100,
      buttons: [0, 0],
      axes: [0, 0],
      pressedWithoutValue: [],
    });
  });

  it("überspringt leere Positionen", () => {
    expect(snapshotPads([null, rawPad({ index: 1 })])).toHaveLength(1);
  });

  it("erfasst auch Einträge ganz ohne Tasten und Achsen", () => {
    const [entry] = snapshotPads([rawPad({ buttons: [], axes: [] })]);
    expect(entry.buttons).toEqual([]);
    expect(entry.axes).toEqual([]);
  });

  it("nutzt den gedrückten Zustand, wenn kein Analogwert geliefert wird", () => {
    const [entry] = snapshotPads([rawPad({ buttons: [{ pressed: true }, { pressed: false }] })]);
    expect(entry.buttons).toEqual([1, 0]);
  });

  it("wertet pressed=true auch dann, wenn der Analogwert 0 bleibt", () => {
    // Manche Treiber melden digitale Steuerkreuz-Tasten als
    // `{pressed: true, value: 0}`. Würde nur `value` zählen, wäre der
    // Tastendruck unsichtbar.
    const [entry] = snapshotPads([
      rawPad({
        buttons: [
          { pressed: true, value: 0 },
          { pressed: false, value: 0 },
        ],
      }),
    ]);
    expect(entry.buttons).toEqual([1, 0]);
  });

  it("hält fest, welche Tasten pressed ohne Analogwert melden", () => {
    const [entry] = snapshotPads([
      rawPad({
        buttons: [
          { pressed: true, value: 0 },
          { pressed: true, value: 1 },
          { pressed: false, value: 0 },
        ],
      }),
    ]);
    expect(entry.pressedWithoutValue).toEqual([0]);
  });
});

describe("diffSnapshots", () => {
  it("erfasst einen Tastendruck", () => {
    const events = diffSnapshots([snapshot()], [snapshot({ buttons: [1, 0] })], 250);
    expect(events).toEqual([{ t: 250, padIndex: 0, type: "button", index: 0, from: 0, to: 1 }]);
  });

  it("erfasst das Loslassen", () => {
    const events = diffSnapshots([snapshot({ buttons: [1, 0] })], [snapshot()], 300);
    expect(events[0]).toMatchObject({ type: "button", index: 0, from: 1, to: 0 });
  });

  it("erfasst eine Achsenbewegung", () => {
    const events = diffSnapshots([snapshot()], [snapshot({ axes: [-1, 0] })], 10);
    expect(events[0]).toMatchObject({ type: "axis", index: 0, from: 0, to: -1 });
  });

  it("ignoriert winziges Achsen-Rauschen", () => {
    expect(diffSnapshots([snapshot()], [snapshot({ axes: [0.03, 0] })], 10)).toEqual([]);
  });

  it("erfasst auch kleine, aber deutliche Achsenschritte", () => {
    // Hat-Switches melden Zwischenwerte wie -0.43 – die müssen sichtbar sein.
    expect(diffSnapshots([snapshot()], [snapshot({ axes: [-0.43, 0] })], 10)).toHaveLength(1);
  });

  it("meldet nichts, wenn sich nichts ändert", () => {
    expect(diffSnapshots([snapshot()], [snapshot()], 10)).toEqual([]);
  });

  it("erfasst ein neu hinzugekommenes Pad", () => {
    const events = diffSnapshots([], [snapshot()], 10);
    expect(events).toEqual([]);
  });

  it("hält die Pads über ihren Index auseinander", () => {
    const before = [snapshot({ index: 0 }), snapshot({ index: 1 })];
    const after = [snapshot({ index: 0 }), snapshot({ index: 1, buttons: [1, 0] })];
    expect(diffSnapshots(before, after, 10)[0].padIndex).toBe(1);
  });
});

describe("buildReport", () => {
  it("enthält Umgebung, Schleifendaten, Pads und Ereignisse", () => {
    const report = JSON.parse(
      buildReport({
        userAgent: "TestBrowser",
        frames: 120,
        hz: 60,
        durationMs: 2_000,
        pads: [snapshot()],
        events: [{ t: 1, padIndex: 0, type: "button", index: 3, from: 0, to: 1 }],
      })
    );

    expect(report.userAgent).toBe("TestBrowser");
    expect(report.loop).toEqual({ frames: 120, hz: 60, durationMs: 2000 });
    expect(report.pads[0].id).toBe("Test Pad");
    expect(report.events).toHaveLength(1);
  });

  it("fasst je Pad zusammen, welche Tasten und Achsen überhaupt reagiert haben", () => {
    const report = JSON.parse(
      buildReport({
        userAgent: "T",
        frames: 1,
        hz: 60,
        durationMs: 1,
        pads: [snapshot()],
        events: [
          { t: 1, padIndex: 0, type: "button", index: 3, from: 0, to: 1 },
          { t: 2, padIndex: 0, type: "button", index: 3, from: 1, to: 0 },
          { t: 3, padIndex: 0, type: "axis", index: 1, from: 0, to: -1 },
        ],
      })
    );

    expect(report.summary[0]).toMatchObject({
      padIndex: 0,
      buttonsSeen: [3],
      axesSeen: [1],
      eventCount: 3,
    });
  });

  it("weist leere Aufzeichnungen deutlich aus", () => {
    const report = JSON.parse(
      buildReport({
        userAgent: "T",
        frames: 600,
        hz: 60,
        durationMs: 10_000,
        pads: [snapshot()],
        events: [],
      })
    );
    expect(report.summary[0]).toMatchObject({ buttonsSeen: [], axesSeen: [], eventCount: 0 });
  });
});
