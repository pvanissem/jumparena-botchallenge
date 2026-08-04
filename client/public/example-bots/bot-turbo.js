/**
 * Beispiel-Bot: "Turbo-Schnecke"
 * Rennt stur nach rechts zum Ziel und springt, sobald etwas im Weg ist.
 * Minimalistisch – ein guter Startpunkt zum Verstehen des Formats.
 */
export default {
  apiVersion: 1,
  name: "Turbo-Schnecke",
  author: "Beispiel",
  color: "#f97316",

  decide(state) {
    const hz = state.nearestHazard;
    if (hz && hz.active && Math.abs(hz.dx) <= 2 && hz.dy >= -1 && state.onGround) {
      return "jump";
    }
    return "right";
  },
};
