/**
 * Belegungen direkt auf ROHEN HID-Report-Bytes – siehe
 * `.features/play-mode-webhid/bugfix.md`.
 *
 * Hintergrund: Chromiums "standard gamepad mapping" ist für manche billigen
 * USB-Adapter unvollständig (gemessen: 16 statt 17 Tasten, 0 statt 4 Achsen,
 * Steuerkreuz links/rechts fehlt vollständig). Über WebHID lässt sich das
 * Gerät roh auslesen – dort sind alle Richtungen enthalten.
 *
 * Dieses Modul ist bewusst pur: Es kennt weder `navigator.hid` noch React und
 * ist vollständig mit synthetischen Reports testbar.
 */

export interface HidBinding {
  reportId: number;
  byteIndex: number;
  /** Welche Bits des Bytes betrachtet werden. */
  mask: number;
  /** Erwarteter Wert der maskierten Bits. */
  value: number;
  /** Nur für Achsenbytes: erlaubte Abweichung von `value`. */
  tolerance?: number;
}

/** Ab dieser Byte-Änderung gilt eine Achse als bewegt (Rauschschutz). */
const AXIS_MIN_CHANGE = 0x20;
/** Wertebereich, in dem ein Byte als "mittig ruhend" und damit als Achse gilt. */
const AXIS_REST_MIN = 0x40;
const AXIS_REST_MAX = 0xc0;
/** Toleranz beim Wiedererkennen eines Achsen-Anschlags. */
const AXIS_TOLERANCE = 0x30;

function popcount(value: number): number {
  let count = 0;
  let rest = value;
  while (rest > 0) {
    count += rest & 1;
    rest >>= 1;
  }
  return count;
}

export function resolveHidBinding(report: readonly number[], binding: HidBinding): boolean {
  const byte = report[binding.byteIndex];
  if (byte === undefined) return false;

  const masked = byte & binding.mask;

  if (binding.tolerance !== undefined) {
    return Math.abs(masked - binding.value) <= binding.tolerance;
  }

  return masked === binding.value;
}

/** Positionen, an denen sich zwei Reports unterscheiden. */
export function diffReportBytes(before: readonly number[], after: readonly number[]): number[] {
  const length = Math.max(before.length, after.length);
  const changed: number[] = [];

  for (let index = 0; index < length; index++) {
    if ((before[index] ?? 0) !== (after[index] ?? 0)) changed.push(index);
  }

  return changed;
}

/**
 * Leitet aus Ruhe- und Druckzustand eine Belegung ab.
 *
 * Drei Fälle, absichtlich in dieser Reihenfolge:
 * 1. **Byte ruht mittig** (0x40–0xc0) und springt deutlich → Achse. Diese
 *    Prüfung steht bewusst VORN: Ein Sprung 0x7f→0xff kippt genau ein Bit und
 *    wäre sonst nicht von einer Taste zu unterscheiden.
 * 2. **Ein einzelnes Bit** kippt → klassische Taste (Bit-Belegung).
 * 3. **Mehrere Bits im unteren Nibble** → Hat-Switch. Dort steht die Richtung
 *    als Zahl (0=hoch, 2=rechts, 4=runter, 6=links, 8=neutral), weshalb der
 *    Wert exakt verglichen werden muss – sonst würde "hoch" (0) auch für
 *    "links" (6) anschlagen.
 * 4. **Großer Sprung eines sonstigen Bytes** → Achse am Anschlag, mit Toleranz
 *    gegen Rauschen.
 */
export function detectHidBinding(
  reportId: number,
  rest: readonly number[],
  pressed: readonly number[]
): HidBinding | null {
  for (const byteIndex of diffReportBytes(rest, pressed)) {
    const before = rest[byteIndex] ?? 0;
    const now = pressed[byteIndex] ?? 0;
    const changedBits = before ^ now;

    // 1. Mittig ruhendes Byte mit deutlichem Ausschlag -> Achse.
    const restsCentered = before >= AXIS_REST_MIN && before <= AXIS_REST_MAX;
    if (restsCentered && Math.abs(now - before) >= AXIS_MIN_CHANGE) {
      return { reportId, byteIndex, mask: 0xff, value: now, tolerance: AXIS_TOLERANCE };
    }

    // 2. Einzelnes Bit -> Taste.
    if (popcount(changedBits) === 1) {
      return { reportId, byteIndex, mask: changedBits, value: now & changedBits };
    }

    // 3. Änderung ausschließlich im unteren Nibble -> Hat-Switch.
    if ((changedBits & 0xf0) === 0) {
      return { reportId, byteIndex, mask: 0x0f, value: now & 0x0f };
    }

    // 4. Deutlicher Sprung eines sonstigen Bytes -> Achse am Anschlag.
    if (Math.abs(now - before) >= AXIS_MIN_CHANGE) {
      return { reportId, byteIndex, mask: 0xff, value: now, tolerance: AXIS_TOLERANCE };
    }
  }

  return null;
}
