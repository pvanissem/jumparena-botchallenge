/**
 * Dein Bot – wird einmal pro Simulations-Tick (~150ms) aufgerufen und muss
 * synchron eine Action zurückgeben: "left" | "right" | "jump" | "idle".
 *
 * state enthält u.a.:
 *   position, facing, onGround, isAlive
 *   nearbyTiles        - Sichtfeld-Raster um den Bot
 *   nearestCoin        - { dx, dy, value } | null
 *   nearestHazard      - { dx, dy, kind, active } | null
 *   nearestUtility     - { dx, dy, kind } | null
 *   goalDirection      - { dx, dy }
 *   coinsCollected, livesRemaining, timeElapsedMs
 *
 * Dein Bot läuft isoliert in einem Web Worker: keine Modul-Importe, keine
 * Netzwerk- oder Browser-Zugriffe möglich (das ist bereits durch die
 * Sandbox sichergestellt, du musst dich darum nicht kümmern).
 */
export default {
  apiVersion: 1,
  decide(state) {
    return "idle";
  },
};
