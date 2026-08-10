/**
 * Beispiel-Bot 3: "Bremsklotz-Bernd" – der Vorsichtige.
 *
 * Strategie: Sicherheit vor Tempo. Vor jeder aktiven Gefahr wird angehalten
 * bzw. zurueckgewichen; getaktete Gefahren (loderix) werden ausgewartet, bis
 * sie aus sind. Fruechte nimmt er nur mit, wenn sie gefahrenfrei erreichbar
 * sind.
 *
 * Erwartetes Profil: kaum Tode, mittlere Zeit, wenige Punkte.
 */

let jumpTicks = 0;
let waitTicks = 0;

function reset() {
  jumpTicks = 0;
  waitTicks = 0;
}

function moveAction(dx, sprint) {
  if (Math.abs(dx) < 4) return "idle";
  const dir = dx > 0 ? "right" : "left";
  return sprint ? "sprint-" + dir : dir;
}

/** Naechste Gefahr in Laufrichtung, die den Weg blockiert. */
function blockingHazard(state, dir) {
  let best = null;
  for (const h of state.hazards) {
    if (dir > 0 && h.dx < -10) continue;
    if (dir < 0 && h.dx > 10) continue;
    if (Math.abs(h.dy) > 48) continue;
    if (Math.abs(h.dx) > 110) continue;
    if (best === null || Math.abs(h.dx) < Math.abs(best.dx)) best = h;
  }
  return best;
}

export default {
  apiVersion: 1,
  name: "Bremsklotz-Bernd",
  author: "Beispiel-Bot (Vorsichtig)",
  color: "#5dd6ff",
  decide(state) {
    if (state.justRespawned) reset();

    const actions = [];
    const dir = state.goalDirection.dx < 0 ? -1 : 1;
    let targetDx = state.goalDirection.dx;

    // Fruechte nur mitnehmen, wenn sie sehr nah und ungefaehrlich sind.
    const coin = state.nearestCoin;
    if (coin && Math.abs(coin.dx) < 90 && Math.abs(coin.dy) < 40) {
      const safe = state.hazards.every(
        (h) => !h.active || Math.abs(h.dx - coin.dx) > 40 || Math.abs(h.dy - coin.dy) > 40
      );
      if (safe) targetDx = coin.dx;
    }

    const hazard = blockingHazard(state, dir);

    if (hazard) {
      const distance = Math.abs(hazard.dx);
      if (hazard.warning) {
        // Spikehead kuendigt sich an -> weg vom Fallbereich.
        waitTicks = 0;
        actions.push(moveAction(-hazard.dx, false));
        return actions;
      }
      if (hazard.active && distance < 55) {
        if (hazard.kind === "loderix" || hazard.kind === "spikehead") {
          // Getaktet: einfach warten, bis er aus ist.
          waitTicks = 4;
        } else if (state.onGround && jumpTicks <= 0 && distance > 20) {
          // Beweglicher Gegner: ueberspringen.
          jumpTicks = 7;
        } else {
          actions.push(moveAction(-hazard.dx, false));
          return actions;
        }
      }
    }

    if (waitTicks > 0) {
      waitTicks--;
      const stillHot = hazard && hazard.active && Math.abs(hazard.dx) < 55;
      if (stillHot) {
        actions.push("idle");
        return actions;
      }
      waitTicks = 0;
    }

    const gap = state.gapAhead;
    if (state.onGround && jumpTicks <= 0 && gap.present && gap.distance !== null && gap.distance < 60) {
      jumpTicks = 8;
    }

    if (jumpTicks > 0) {
      actions.push("jump");
      jumpTicks--;
    }

    // Bewusst ohne Sprint: langsamer, aber besser kontrollierbar.
    actions.push(moveAction(targetDx, false));
    return actions;
  },
};
