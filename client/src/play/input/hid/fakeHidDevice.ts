/**
 * Test-Double für ein WebHID-Gerät – erlaubt es, die gesamte HID-Kette ohne
 * echte Hardware zu prüfen.
 */
import type { HidDeviceLike, HidInputReportEventLike } from "./hidTypes";

export class FakeHidDevice implements HidDeviceLike {
  productName: string;
  vendorId: number;
  productId: number;
  opened = false;

  private listeners = new Set<(event: HidInputReportEventLike) => void>();

  constructor(meta: { productName?: string; vendorId?: number; productId?: number } = {}) {
    this.productName = meta.productName ?? "Fake Pad";
    this.vendorId = meta.vendorId ?? 0x0001;
    this.productId = meta.productId ?? 0x0002;
  }

  get listenerCount(): number {
    return this.listeners.size;
  }

  async open(): Promise<void> {
    this.opened = true;
  }

  async close(): Promise<void> {
    this.opened = false;
  }

  addEventListener(_type: "inputreport", listener: (event: HidInputReportEventLike) => void): void {
    this.listeners.add(listener);
  }

  removeEventListener(
    _type: "inputreport",
    listener: (event: HidInputReportEventLike) => void
  ): void {
    this.listeners.delete(listener);
  }

  /** Einen eingehenden Report simulieren. */
  emit(reportId: number, bytes: number[]): void {
    const event: HidInputReportEventLike = {
      reportId,
      data: {
        byteLength: bytes.length,
        getUint8: (offset: number) => bytes[offset] ?? 0,
      },
    };
    for (const listener of this.listeners) listener(event);
  }
}
