/**
 * Persistenz der HID-Mappings – Muster wie `mappingStore.ts`
 * (siehe `.features/play-mode-webhid/bugfix.md`).
 *
 * Schlüssel ist `vendorId:productId`, damit baugleiche Adapter dieselbe
 * Belegung erben und am Stand nur einmal kalibriert werden muss.
 */
import { type StorageLike, safeLocalStorage } from "../../storage";
import type { HidMapping } from "./hidMapping";

export const HID_MAPPING_STORAGE_KEY = "coin-quest-arena:hid-mappings";
const STORAGE_VERSION = 1;

export interface HidMappingStore {
  get(deviceKey: string): HidMapping | null;
  save(mapping: HidMapping): void;
  all(): Record<string, HidMapping>;
}

function read(storage: StorageLike | null): Record<string, HidMapping> {
  if (!storage) return {};
  try {
    const raw = storage.getItem(HID_MAPPING_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as {
      version?: number;
      byDeviceKey?: Record<string, HidMapping>;
    };
    if (parsed.version !== STORAGE_VERSION || typeof parsed.byDeviceKey !== "object") return {};
    return parsed.byDeviceKey ?? {};
  } catch {
    return {};
  }
}

export function createHidMappingStore(storage: StorageLike | null): HidMappingStore {
  return {
    get(deviceKey) {
      return read(storage)[deviceKey] ?? null;
    },
    save(mapping) {
      if (!storage) return;
      try {
        const byDeviceKey = { ...read(storage), [mapping.deviceKey]: mapping };
        storage.setItem(
          HID_MAPPING_STORAGE_KEY,
          JSON.stringify({ version: STORAGE_VERSION, byDeviceKey })
        );
      } catch {
        // Storage blockiert – Belegung gilt dann nur für diese Sitzung.
      }
    },
    all() {
      return read(storage);
    },
  };
}

export const hidMappingStore: HidMappingStore = createHidMappingStore(safeLocalStorage());
