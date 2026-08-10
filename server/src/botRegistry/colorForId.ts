/**
 * Deterministically derives a display color for a bot that does not provide
 * one itself (US-2). The generated string is a CSS hex color.
 *
 * Simple, dependency-free algorithm (FNV-1a-like XOR over bytes), good enough
 * for the visual distinction of a few dozen tournament bots.
 */
export function colorForId(id: string): string {
  let hash = 0x811c_9dc5;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x0100_0193);
  }

  // Use 24 bits for the RGB channels to avoid overly dark colors.
  const r = ((hash >>> 16) & 0xff) | 0x40;
  const g = ((hash >>> 8) & 0xff) | 0x40;
  const b = (hash & 0xff) | 0x40;

  const toHex = (value: number) => value.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
