/**
 * Minimale Typen der WebHID-API – siehe `.features/play-mode-webhid/bugfix.md`.
 *
 * TypeScript liefert für WebHID (noch) keine eingebauten Typen, und eine extra
 * Abhängigkeit lohnt für die paar benötigten Felder nicht. Hier stehen daher
 * nur die tatsächlich genutzten Teile – das hält zugleich die Testbarkeit hoch
 * (Fakes müssen nur diese Form erfüllen).
 */

export interface HidInputReportEventLike {
  reportId: number;
  data: { byteLength: number; getUint8(offset: number): number };
}

export interface HidDeviceLike {
  productName: string;
  vendorId: number;
  productId: number;
  opened: boolean;
  open(): Promise<void>;
  close(): Promise<void>;
  addEventListener(type: "inputreport", listener: (event: HidInputReportEventLike) => void): void;
  removeEventListener(
    type: "inputreport",
    listener: (event: HidInputReportEventLike) => void
  ): void;
}

export interface HidFilter {
  vendorId?: number;
  productId?: number;
}

export interface HidApiLike {
  requestDevice(options: { filters: HidFilter[] }): Promise<HidDeviceLike[]>;
  getDevices(): Promise<HidDeviceLike[]>;
}

/** Die WebHID-Schnittstelle des Browsers, falls vorhanden. */
export function getHidApi(): HidApiLike | null {
  if (typeof navigator === "undefined") return null;
  const hid = (navigator as unknown as { hid?: HidApiLike }).hid;
  return hid ?? null;
}

export function isHidSupported(): boolean {
  return getHidApi() !== null;
}
