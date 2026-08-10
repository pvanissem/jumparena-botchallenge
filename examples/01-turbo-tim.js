/**
 * Beispiel-Bot 1: "Turbo-Tim" – der reine Sprinter.
 *
 * Strategie: Immer mit vollem Tempo Richtung Ziel. Fruechte werden nur
 * mitgenommen, wenn sie ohnehin direkt auf dem Weg liegen. Gesprungen wird
 * bei Luecken, Waenden und Gefahren.
 *
 * Erwartetes Profil: sehr schnelle Zeit, wenige Punkte, gelegentliche Tode.
 */

let jumpTicks = 0;
let lastX = null;
let stuckTicks = 0;

function reset() {
  jumpTicks = 0;
  lastX = null;
  stuckTicks = 0;
}

/** Gefahr direkt vor mir in Laufrichtung? */
function dangerAhead(state, dir, range) {
  for (const h of state.hazards) {
    if (!h.active && !h.warning) continue;
    if (dir > 0 && h.dx < -8) continue;
    if (dir < 0 && h.dx > 8) continue;
    if (Math.abs(h.dx) > range) continue;
    if (Math.abs(h.dy) > 40) continue;
    return h;
  }
  return null;
}

export default {
  apiVersion: 1,
  name: "Turbo-Tim",
  author: "Beispiel-Bot (Sprinter)",
  color: "#ff5da2",
  decide(state) {
    if (state.justRespawned) reset();

    const actions = [];
    const dir = state.goalDirection.dx < 0 ? -1 : 1;

    // Steckt der Bot fest (Wand, Ecke)? -> springen statt anrennen.
    if (lastX !== null && Math.abs(state.position.x - lastX) < 1.5) {
      stuckTicks++;
    } else {
      stuckTicks = 0;
    }
    lastX = state.position.x;

    const gap = state.gapAhead;
    const gapNear = gap.present && gap.distance !== null && gap.distance < 90;
    const danger = dangerAhead(state, dir, 70);
    const stuck = stuckTicks > 6;

    if (state.onGround && jumpTicks <= 0 && (gapNear || danger !== null || stuck)) {
      // Weite Luecken brauchen den vollen Sprung, kleine Gefahren nicht.
      jumpTicks = gapNear || stuck ? 8 : 5;
    }

    if (jumpTicks > 0) {
      actions.push("jump");
      jumpTicks--;
    }

    actions.push(dir > 0 ? "sprint-right" : "sprint-left");
    return actions;
  },
};
