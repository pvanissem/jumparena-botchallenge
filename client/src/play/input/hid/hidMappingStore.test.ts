import { describe, expect, it } from "vitest";
import type { HidMapping } from "./hidMapping";
import { createHidMappingStore, HID_MAPPING_STORAGE_KEY } from "./hidMappingStore";

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    read: (key: string) => data.get(key) ?? null,
  };
}

const mapping: HidMapping = {
  deviceKey: "0079:0011",
  label: "USB Gamepad",
  bindings: {
    left: { reportId: 0, byteIndex: 0, mask: 0xff, value: 0x00, tolerance: 0x30 },
    right: { reportId: 0, byteIndex: 0, mask: 0xff, value: 0xff, tolerance: 0x30 },
    up: { reportId: 0, byteIndex: 1, mask: 0xff, value: 0x00, tolerance: 0x30 },
    down: { reportId: 0, byteIndex: 1, mask: 0xff, value: 0xff, tolerance: 0x30 },
    jump: { reportId: 0, byteIndex: 5, mask: 1, value: 1 },
    sprint: { reportId: 0, byteIndex: 5, mask: 2, value: 2 },
    confirm: { reportId: 0, byteIndex: 5, mask: 4, value: 4 },
    back: { reportId: 0, byteIndex: 5, mask: 8, value: 8 },
  },
};

describe("hidMappingStore", () => {
  it("liefert ohne gespeicherte Daten nichts", () => {
    expect(createHidMappingStore(fakeStorage()).get("0079:0011")).toBeNull();
  });

  it("speichert und liest ein Mapping", () => {
    const store = createHidMappingStore(fakeStorage());
    store.save(mapping);
    expect(store.get("0079:0011")).toEqual(mapping);
  });

  it("überlebt einen Reload", () => {
    const storage = fakeStorage();
    createHidMappingStore(storage).save(mapping);
    expect(createHidMappingStore(storage).get("0079:0011")?.label).toBe("USB Gamepad");
  });

  it("nutzt dasselbe Mapping für baugleiche Geräte", () => {
    const store = createHidMappingStore(fakeStorage());
    store.save(mapping);
    // Zweiter Adapter derselben Bauart -> identischer Schlüssel.
    expect(store.get("0079:0011")).not.toBeNull();
  });

  it("überschreibt ein vorhandenes Mapping", () => {
    const store = createHidMappingStore(fakeStorage());
    store.save(mapping);
    store.save({ ...mapping, label: "Neu" });
    expect(store.get("0079:0011")?.label).toBe("Neu");
  });

  it("schreibt ein Versionsfeld", () => {
    const storage = fakeStorage();
    createHidMappingStore(storage).save(mapping);
    expect(JSON.parse(storage.read(HID_MAPPING_STORAGE_KEY) as string).version).toBe(1);
  });

  it("fällt bei kaputtem JSON auf 'kein Mapping' zurück", () => {
    const store = createHidMappingStore(fakeStorage({ [HID_MAPPING_STORAGE_KEY]: "{{{" }));
    expect(store.get("0079:0011")).toBeNull();
  });

  it("bleibt ohne Storage funktionsfähig", () => {
    const store = createHidMappingStore(null);
    expect(() => store.save(mapping)).not.toThrow();
    expect(store.get("0079:0011")).toBeNull();
  });
});
