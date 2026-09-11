/**
 * Liest ein Gamepad über WebHID ROH aus – siehe
 * `.features/play-mode-webhid/bugfix.md`.
 *
 * Motivation (gemessen am Stand): Chromiums Gamepad-Mapping meldet für den
 * verwendeten Adapter nur einen Teil des Steuerkreuzes; links und rechts
 * erreichen die Anwendung nie. WebHID umgeht diese Mapping-Schicht komplett.
 *
 * Diese Klasse hält lediglich den jeweils neuesten Report je Report-ID fest.
 * Die Interpretation der Bytes passiert in `hidBindings.ts`.
 */
import type { HidDeviceLike, HidInputReportEventLike } from "./hidTypes";

export interface HidReport {
  reportId: number;
  bytes: number[];
}

export class HidSource {
  private reports = new Map<number, HidReport>();
  private lastReportId: number | null = null;
  private received = 0;
  private running = false;

  private readonly onReport = (event: HidInputReportEventLike) => {
    if (!this.running) return;

    const bytes: number[] = [];
    for (let offset = 0; offset < event.data.byteLength; offset++) {
      bytes.push(event.data.getUint8(offset));
    }

    this.reports.set(event.reportId, { reportId: event.reportId, bytes });
    this.lastReportId = event.reportId;
    this.received += 1;
  };

  constructor(private readonly device: HidDeviceLike) {}

  async start(): Promise<void> {
    if (!this.device.opened) await this.device.open();
    this.device.addEventListener("inputreport", this.onReport);
    this.running = true;
  }

  async stop(): Promise<void> {
    this.running = false;
    this.device.removeEventListener("inputreport", this.onReport);
    this.reports.clear();
    this.lastReportId = null;
    if (this.device.opened) await this.device.close();
  }

  isConnected(): boolean {
    return this.running;
  }

  /** Zuletzt empfangener Report (beliebiger Report-ID). */
  latest(): HidReport | null {
    if (this.lastReportId === null) return null;
    return this.reports.get(this.lastReportId) ?? null;
  }

  reportFor(reportId: number): HidReport | null {
    return this.reports.get(reportId) ?? null;
  }

  /** Anzahl empfangener Reports – Lebenszeichen für die Diagnose. */
  reportCount(): number {
    return this.received;
  }

  describe(): string {
    const vendor = this.device.vendorId.toString(16).padStart(4, "0");
    const product = this.device.productId.toString(16).padStart(4, "0");
    return `${this.device.productName} (${vendor}:${product})`;
  }
}
