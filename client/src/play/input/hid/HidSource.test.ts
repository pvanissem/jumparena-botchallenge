import { describe, expect, it, vi } from "vitest";
import { FakeHidDevice } from "./fakeHidDevice";
import { HidSource } from "./HidSource";

describe("HidSource", () => {
  it("ist vor dem Öffnen nicht verbunden", () => {
    const source = new HidSource(new FakeHidDevice());
    expect(source.isConnected()).toBe(false);
  });

  it("öffnet das Gerät und lauscht auf Reports", async () => {
    const device = new FakeHidDevice();
    const source = new HidSource(device);
    await source.start();

    expect(device.opened).toBe(true);
    expect(source.isConnected()).toBe(true);
  });

  it("hält den zuletzt empfangenen Report", async () => {
    const device = new FakeHidDevice();
    const source = new HidSource(device);
    await source.start();

    device.emit(0, [0x7f, 0x7f, 0x08]);
    expect(source.latest()).toEqual({ reportId: 0, bytes: [0x7f, 0x7f, 0x08] });
  });

  it("überschreibt den Report mit dem neuesten Stand", async () => {
    const device = new FakeHidDevice();
    const source = new HidSource(device);
    await source.start();

    device.emit(0, [1, 1]);
    device.emit(0, [2, 2]);
    expect(source.latest()?.bytes).toEqual([2, 2]);
  });

  it("hält Reports unterschiedlicher Report-IDs getrennt", async () => {
    const device = new FakeHidDevice();
    const source = new HidSource(device);
    await source.start();

    device.emit(1, [1]);
    device.emit(2, [2]);
    expect(source.reportFor(1)?.bytes).toEqual([1]);
    expect(source.reportFor(2)?.bytes).toEqual([2]);
  });

  it("zählt empfangene Reports (Lebenszeichen für die Diagnose)", async () => {
    const device = new FakeHidDevice();
    const source = new HidSource(device);
    await source.start();

    device.emit(0, [1]);
    device.emit(0, [2]);
    expect(source.reportCount()).toBe(2);
  });

  it("meldet sich beim Stoppen wieder ab", async () => {
    const device = new FakeHidDevice();
    const source = new HidSource(device);
    await source.start();
    await source.stop();

    expect(device.listenerCount).toBe(0);
    expect(source.isConnected()).toBe(false);
  });

  it("verwirft Reports nach dem Stoppen", async () => {
    const device = new FakeHidDevice();
    const source = new HidSource(device);
    await source.start();
    await source.stop();

    device.emit(0, [9]);
    expect(source.latest()).toBeNull();
  });

  it("öffnet ein bereits geöffnetes Gerät nicht erneut", async () => {
    const device = new FakeHidDevice();
    device.opened = true;
    const open = vi.spyOn(device, "open");
    await new HidSource(device).start();

    expect(open).not.toHaveBeenCalled();
  });

  it("beschreibt das Gerät lesbar", () => {
    const device = new FakeHidDevice({
      productName: "USB Gamepad",
      vendorId: 0x0079,
      productId: 0x0011,
    });
    expect(new HidSource(device).describe()).toBe("USB Gamepad (0079:0011)");
  });
});
