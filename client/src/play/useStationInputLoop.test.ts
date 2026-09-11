import { renderHook } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeHidDevice } from "./input/hid/fakeHidDevice";
import { HidController } from "./input/hid/HidController";
import { HidSource } from "./input/hid/HidSource";
import type { HidMapping } from "./input/hid/hidMapping";
import { STATION_TICK_INTERVAL_MS, useStationInputLoop } from "./useStationInputLoop";

/** Testquelle: Byte 0 trägt alle Tasten als Bits. */
const MAPPING: HidMapping = {
  deviceKey: "test",
  label: "Test Pad",
  bindings: {
    left: { reportId: 0, byteIndex: 0, mask: 0b0000_0001, value: 0b0000_0001 },
    right: { reportId: 0, byteIndex: 0, mask: 0b0000_0010, value: 0b0000_0010 },
    up: { reportId: 0, byteIndex: 0, mask: 0b0000_0100, value: 0b0000_0100 },
    down: { reportId: 0, byteIndex: 0, mask: 0b0000_1000, value: 0b0000_1000 },
    jump: { reportId: 0, byteIndex: 0, mask: 0b0001_0000, value: 0b0001_0000 },
    sprint: { reportId: 0, byteIndex: 0, mask: 0b0010_0000, value: 0b0010_0000 },
    confirm: { reportId: 0, byteIndex: 0, mask: 0b0100_0000, value: 0b0100_0000 },
    back: { reportId: 0, byteIndex: 0, mask: 0b1000_0000, value: 0b1000_0000 },
  },
};
const CONFIRM = 0b0100_0000;
const IDLE = 0x00;

/** Kontrollierbarer rAF-Ersatz mit expliziter Zeitachse. */
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

describe("useStationInputLoop", () => {
  let raf: ReturnType<typeof fakeRaf>;
  let device: FakeHidDevice;
  let source: HidSource;
  let controller: HidController;

  beforeEach(async () => {
    raf = fakeRaf();
    device = new FakeHidDevice();
    source = new HidSource(device);
    await source.start();
    controller = new HidController(source, MAPPING);
  });

  afterEach(() => vi.unstubAllGlobals());

  function setup(phase = "attract") {
    const onEdges = vi.fn();
    const onTick = vi.fn();
    const onConnectionChange = vi.fn();
    renderHook(() =>
      useStationInputLoop({
        source: controller,
        phase: phase as never,
        onEdges,
        onTick,
        onConnectionChange,
      })
    );
    return { onEdges, onTick, onConnectionChange };
  }

  /** Report senden und einen Frame laufen lassen. */
  function report(byte: number, deltaMs = 16) {
    act(() => {
      device.emit(0, [byte]);
      raf.frame(deltaMs);
    });
  }

  describe("Eingaben", () => {
    it("meldet einen Tastendruck als Flanke", () => {
      const { onEdges } = setup();
      report(IDLE);
      report(CONFIRM);
      expect(onEdges).toHaveBeenCalledWith(expect.objectContaining({ confirm: true }));
    });

    it("meldet eine gehaltene Taste nur einmal", () => {
      const { onEdges } = setup();
      report(CONFIRM);
      report(CONFIRM);
      report(CONFIRM);
      expect(onEdges).toHaveBeenCalledTimes(1);
    });

    it("erkennt auch einen sehr kurzen Tastendruck (ein einziger Frame)", () => {
      const { onEdges } = setup();
      report(IDLE);
      report(CONFIRM);
      report(IDLE);
      report(CONFIRM);
      expect(onEdges).toHaveBeenCalledTimes(2);
    });

    it("pollt die Eingaben in JEDEM Frame (keine Drosselung)", () => {
      const { onEdges } = setup();
      for (let frame = 0; frame < 6; frame++) {
        report(frame % 2 === 0 ? CONFIRM : IDLE);
      }
      expect(onEdges).toHaveBeenCalledTimes(3);
    });

    it("meldet nichts ohne zugeordnete Quelle", () => {
      const onEdges = vi.fn();
      const onTick = vi.fn();
      renderHook(() =>
        useStationInputLoop({
          source: null,
          phase: "countdown",
          onEdges,
          onTick,
          onConnectionChange: vi.fn(),
        })
      );
      for (let frame = 0; frame < 20; frame++) act(() => raf.frame());
      expect(onEdges).not.toHaveBeenCalled();
      expect(onTick).not.toHaveBeenCalled();
    });
  });

  describe("Ticks (Re-Render-Last)", () => {
    it("tickt NICHT im Wartezustand (dort wartet nichts auf Zeit)", () => {
      const { onTick } = setup("attract");
      for (let frame = 0; frame < 20; frame++) report(IDLE);
      expect(onTick).not.toHaveBeenCalled();
    });

    it("tickt NICHT während des Spiels (die Levelzeit führt die Szene)", () => {
      const { onTick } = setup("playing");
      for (let frame = 0; frame < 20; frame++) report(IDLE);
      expect(onTick).not.toHaveBeenCalled();
    });

    it("tickt NICHT in der Namenseingabe", () => {
      const { onTick } = setup("name-entry");
      for (let frame = 0; frame < 20; frame++) report(IDLE);
      expect(onTick).not.toHaveBeenCalled();
    });

    it("tickt im Countdown, aber gedrosselt statt in jedem Frame", () => {
      const { onTick } = setup("countdown");
      for (let frame = 0; frame < 12; frame++) report(IDLE, 16);
      expect(onTick).toHaveBeenCalledTimes(1);
    });

    it("summiert die verstrichene Zeit verlustfrei auf", () => {
      const { onTick } = setup("level-result");
      // Der erste Frame liefert Delta 0 (kein Vorgänger), danach 7x 16ms.
      for (let frame = 0; frame < 8; frame++) report(IDLE, 16);
      expect(onTick).toHaveBeenCalledWith(112);
    });

    it("tickt in der Endanzeige (Timeout zurück zum Wartezustand)", () => {
      const { onTick } = setup("game-over");
      for (let frame = 0; frame < 10; frame++) report(IDLE, 16);
      expect(onTick).toHaveBeenCalled();
    });

    it("drosselt auf ein 100ms-Raster", () => {
      expect(STATION_TICK_INTERVAL_MS).toBe(100);
    });
  });

  describe("Verbindung", () => {
    it("meldet den Verbindungsstatus nur bei Änderung", async () => {
      const { onConnectionChange } = setup("playing");
      report(IDLE);
      report(IDLE);
      expect(onConnectionChange).not.toHaveBeenCalled();

      await act(async () => {
        await source.stop();
      });
      act(() => raf.frame());
      act(() => raf.frame());

      expect(onConnectionChange).toHaveBeenCalledTimes(1);
      expect(onConnectionChange).toHaveBeenCalledWith(false);
    });
  });
});
