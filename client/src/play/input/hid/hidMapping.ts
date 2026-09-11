/**
 * Logische Eingaben aus rohen HID-Reports – das HID-Gegenstück zu
 * `inputSnapshot.ts` (siehe `.features/play-mode-webhid/bugfix.md`).
 *
 * Wichtig: Das Ergebnis ist derselbe `InputSnapshot` wie beim
 * Gamepad-API-Pfad. Dadurch bleibt die gesamte weitere Kette (Stations-
 * Reducer, Namenseingabe, `RaceScene`) unverändert – nur die Quelle ist eine
 * andere.
 */

import { emptySnapshot, type InputSnapshot } from "../inputSnapshot";
import { PLAY_INPUTS, type PlayInput } from "../inputs";
import { type HidBinding, resolveHidBinding } from "./hidBindings";

export interface HidMapping {
  /** Stabiler Schlüssel der Hardware (Vendor/Produkt), für die Persistenz. */
  deviceKey: string;
  label: string;
  bindings: Record<PlayInput, HidBinding>;
}

export function readHidSnapshot(report: readonly number[], mapping: HidMapping): InputSnapshot {
  const snapshot = emptySnapshot();
  for (const input of PLAY_INPUTS) {
    snapshot[input] = resolveHidBinding(report, mapping.bindings[input]);
  }
  return snapshot;
}

/** Baugleiche Geräte teilen sich Schlüssel und damit ihr Mapping. */
export function hidDeviceKey(device: { vendorId: number; productId: number }): string {
  const vendor = device.vendorId.toString(16).padStart(4, "0");
  const product = device.productId.toString(16).padStart(4, "0");
  return `${vendor}:${product}`;
}
