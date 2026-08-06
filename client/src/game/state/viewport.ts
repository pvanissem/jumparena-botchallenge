/**
 * Sichtbereich des Bots – Single Source of Truth für den Radius, innerhalb dessen
 * ein Bot Objekte (Coins/Hazards/Utilities) "sieht". Bewusst als eigenes,
 * winziges Modul (SRP), damit der Wert zentral justierbar ist und in Builder wie
 * Tests dieselbe Definition teilen.
 *
 * Wert 320px: Der Canvas ist 800×540 und die Kamera folgt dem Racer zentriert;
 * im Turnier-Grid (bis 2×2) ist eine Zelle ~400px breit. 320px hält den Bot nah
 * an dem, was ein Mensch auf dem Bildschirm sähe, ohne das ganze Level zu
 * verraten (siehe `.features/bot-state-vision/design.md`).
 */
export const VIEW_RADIUS_PX = 320;

/** Ob ein Objekt mit dem Pixel-Delta (dx, dy) innerhalb des Sichtradius liegt.
 *  Grenze eingeschlossen. Vergleich quadriert (kein `Math.sqrt`). */
export function withinViewRadius(dx: number, dy: number, radius = VIEW_RADIUS_PX): boolean {
  return dx * dx + dy * dy <= radius * radius;
}
