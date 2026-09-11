/** Lesbare Darstellung roher HID-Bytes (Hex, zweistellig, leerzeichengetrennt). */
export function formatReportBytes(bytes: readonly number[]): string {
  return bytes.map(toHex).join(" ");
}

export function toHex(value: number): string {
  return value.toString(16).padStart(2, "0");
}
