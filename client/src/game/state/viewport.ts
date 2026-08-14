/**
 * Sichtbereich des Bots – Single Source of Truth für den Ausschnitt, innerhalb
 * dessen ein Bot Objekte (Coins/Hazards/Utilities) und Terrain-Geometrie
 * (`platforms`) "sieht". Bewusst als eigenes, winziges Modul (SRP), damit die
 * Werte zentral justierbar sind und Builder wie Tests dieselbe Definition
 * teilen.
 *
 * Leitidee (siehe `.features/bot-state-vision/design.md`, US-2): Der Bot soll
 * ungefähr das sehen, was ein Mensch am Bildschirm sieht – nicht mehr, aber
 * eben auch nicht weniger.
 *
 * Form: achsenparalleles Rechteck (kein Kreis). Der frühere einheitliche
 * Radius von 320px war vertikal deutlich RESTRIKTIVER als menschliche Sicht:
 *
 * - Der Canvas ist 800×540, die Kamera folgt dem Racer zentriert
 *   (`RaceScene.startFollow`) – horizontal also ±400px.
 * - Alle Level haben `worldHeight: 540`, exakt die Canvas-Höhe. Wegen
 *   `cameras.main.setBounds(0, 0, worldWidth, 540)` scrollt die Kamera
 *   NIEMALS vertikal: ein Mensch sieht permanent die komplette Level-Höhe.
 *
 * Daraus folgt: horizontal ±400px (halbe Canvas-Breite), vertikal ±540px
 * (volle Weltenhöhe, in der Praxis also unbegrenzt innerhalb des Levels).
 * Ohne das sah ein hoch stehender Bot den Boden tiefer liegender Plattformen
 * nicht mehr und konnte keine Landung planen.
 */

/** Halbe Sichtbreite in Pixeln = halbe Canvas-Breite (800 / 2). */
export const VIEW_HALF_WIDTH_PX = 400;

/** Halbe Sichthöhe in Pixeln = volle Weltenhöhe, da die Kamera nie vertikal
 *  scrollt. Deckt damit jedes vertikale Delta innerhalb eines Levels ab. */
export const VIEW_HALF_HEIGHT_PX = 540;

/** Ob ein Objekt mit dem Pixel-Delta (dx, dy) im Sichtrechteck liegt.
 *  Grenze eingeschlossen. */
export function withinView(
  dx: number,
  dy: number,
  halfWidth = VIEW_HALF_WIDTH_PX,
  halfHeight = VIEW_HALF_HEIGHT_PX
): boolean {
  return Math.abs(dx) <= halfWidth && Math.abs(dy) <= halfHeight;
}
