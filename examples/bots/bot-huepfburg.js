/**
 * Beispiel-Bot: "Hüpfburg"
 * Springt rhythmisch im festen Takt (alle paar Ticks) und bewegt sich dabei
 * Richtung Ziel. Nutzt eine Closure-Variable als kleinen Zähler (State-Machine).
 */

let counter = 0;

export default {
  apiVersion: 1,
  name: "Hüpfburg",
  author: "Beispiel",
  color: "#ec4899",

  decide(state) {
    counter++;
    const dir = state.goalDirection.dx >= 0 ? "right" : "left";

    const hz = state.nearestHazard;
    if (hz && hz.active && Math.abs(hz.dx) <= 2 && hz.dy >= -1 && state.onGround) {
      return "jump";
    }

    // Alle 4 Ticks ein Sprung, sonst laufen.
    if (state.onGround && counter % 4 === 0) {
      return "jump";
    }
    return dir;
  },
};
