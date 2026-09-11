import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeHidDevice } from "./input/hid/fakeHidDevice";
import { deviceForStation, type HidStationDevice, useHidDevices } from "./useHidDevices";

function device(name = "USB Gamepad", vendorId = 0x79, productId = 0x11) {
  return new FakeHidDevice({ productName: name, vendorId, productId });
}

describe("useHidDevices", () => {
  beforeEach(() => {
    vi.stubGlobal("navigator", {
      hid: { getDevices: vi.fn(async () => []), requestDevice: vi.fn(async () => []) },
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("meldet fehlende WebHID-Unterstützung", () => {
    vi.stubGlobal("navigator", {});
    const { result } = renderHook(() => useHidDevices());
    expect(result.current.supported).toBe(false);
  });

  it("öffnet bereits freigegebene Geräte ohne Dialog", async () => {
    const granted = device();
    vi.stubGlobal("navigator", {
      hid: { getDevices: vi.fn(async () => [granted]), requestDevice: vi.fn(async () => []) },
    });

    const { result } = renderHook(() => useHidDevices());
    await waitFor(() => expect(result.current.devices).toHaveLength(1));
    expect(granted.opened).toBe(true);
    expect(result.current.devices[0].deviceKey).toBe("0079:0011");
  });

  it("übernimmt den Produktnamen als Bezeichnung", async () => {
    vi.stubGlobal("navigator", {
      hid: {
        getDevices: vi.fn(async () => [device("SNES Pad")]),
        requestDevice: vi.fn(async () => []),
      },
    });

    const { result } = renderHook(() => useHidDevices());
    await waitFor(() => expect(result.current.devices[0].label).toBe("SNES Pad"));
  });

  it("nimmt ein neu ausgewähltes Gerät auf", async () => {
    const chosen = device();
    vi.stubGlobal("navigator", {
      hid: { getDevices: vi.fn(async () => []), requestDevice: vi.fn(async () => [chosen]) },
    });

    const { result } = renderHook(() => useHidDevices());
    await act(async () => {
      await result.current.requestDevice();
    });

    expect(result.current.devices).toHaveLength(1);
  });

  it("meldet einen abgebrochenen Dialog", async () => {
    const { result } = renderHook(() => useHidDevices());
    await act(async () => {
      await result.current.requestDevice();
    });
    expect(result.current.error).toMatch(/Kein Gerät/i);
  });

  it("meldet einen Fehler beim Öffnen", async () => {
    vi.stubGlobal("navigator", {
      hid: {
        getDevices: vi.fn(async () => []),
        requestDevice: vi.fn(async () => {
          throw new Error("Zugriff verweigert");
        }),
      },
    });

    const { result } = renderHook(() => useHidDevices());
    await act(async () => {
      await result.current.requestDevice();
    });

    expect(result.current.error).toBe("Zugriff verweigert");
  });
});

describe("deviceForStation", () => {
  const devices = [
    { deviceKey: "a", label: "A" },
    { deviceKey: "b", label: "B" },
  ] as HidStationDevice[];

  it("gibt der linken Station das erste Gerät", () => {
    expect(deviceForStation(devices, "left")?.deviceKey).toBe("a");
  });

  it("gibt der rechten Station das zweite Gerät", () => {
    expect(deviceForStation(devices, "right")?.deviceKey).toBe("b");
  });

  it("liefert null, wenn kein zweites Gerät da ist", () => {
    expect(deviceForStation([devices[0]], "right")).toBeNull();
  });

  it("liefert null ohne Geräte", () => {
    expect(deviceForStation([], "left")).toBeNull();
  });
});
