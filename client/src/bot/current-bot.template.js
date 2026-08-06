/**
 * Dein Bot – wird ~30x pro Sekunde (alle ~33ms) aufgerufen und muss synchron
 * eine Liste von Actions zurückgeben. Erlaubte Actions:
 *   "left" | "right" | "jump" | "idle" | "sprint-left" | "sprint-right"
 *
 * Du darfst mehrere Actions gleichzeitig zurückgeben, z.B. ["jump", "right"]
 * (springen und dabei nach rechts steuern). Ein leeres Array [] = nichts tun.
 * Bei mehreren Richtungs-Actions gewinnt die zuletzt genannte.
 *
 * state enthält u.a.:
 *   position, facing, onGround, isAlive
 *   velocity           - { vx, vy } eigene Geschwindigkeit
 *   isSprinting        - baut gerade Sprint-Tempo auf?
 *   nearbyTiles        - Sichtfeld-Raster (7x5) um den Bot
 *   coins              - alle sichtbaren Fruechte: [{ dx, dy, value }, ...]
 *   hazards            - alle sichtbaren Gefahren:
 *                          [{ dx, dy, kind, active, warning, stompable }, ...]
 *   utilities          - alle sichtbaren Hilfsobjekte: [{ dx, dy, kind }, ...]
 *   nearestCoin        - kuerzeste Abkuerzung = coins[0] oder null
 *   nearestHazard      - = hazards[0] oder null
 *   nearestUtility     - = utilities[0] oder null
 *   goalDirection      - { dx, dy } Richtung zum Ziel (in Pixeln)
 *   gapAhead           - { present, distance } Abgrund in Laufrichtung?
 *   worldBounds        - { width, height } Levelgroesse
 *   justRespawned, tookDamage
 *   coinsCollected, livesRemaining, timeElapsedMs
 *
 * Alle Distanzen (dx, dy, goalDirection) sind in Pixeln, relativ zum Bot:
 * dx < 0 = links, dy < 0 = oben (y waechst nach unten).
 *
 * Dein Bot laeuft isoliert in einem Web Worker: keine Modul-Ladebefehle, keine
 * Netzwerk- oder Browser-Zugriffe moeglich (das ist bereits durch die Sandbox
 * sichergestellt, du musst dich darum nicht kuemmern).
 */
export default {
  apiVersion: 1,
  decide(state) {
    return [];
  },
};
