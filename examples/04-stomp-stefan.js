/**
 * Beispiel-Bot 4: "Stomp-Stefan" – der Gegner-Treter.
 *
 * Strategie: Grundsaetzlich Richtung Ziel, aber stompbare Gegner
 * (`stompable === true`, also der ninjafrog) werden aktiv angesprungen und
 * plattgemacht. Alle anderen Gefahren werden weitraeumig umsprungen.
 *
 * Erwartetes Profil: unterhaltsam, mittleres Tempo, riskant.
 */

let jumpTicks = 0;
let stompCooldown = 0;

function reset() {
  jumpTicks = 0;
  stompCooldown = 0;
}

function moveAction(dx, sprint) {
  if (Math.abs(dx) < 4) return "idle";
  const dir = dx > 0 ? "right" : "left";
  return sprint ? "sprint-" + dir : dir;
}

/** Naechster stompbarer Gegner in erreichbarer Naehe. */
function stompTarget(state) {
  let best = null;
  for (const h of state.hazards) {
    if (!h.stompable) continue;
    if (Math.abs(h.dx) > 120) continue;
    if (h.dy < -30 || h.dy > 60) continue;
    if (best === null || Math.abs(h.dx) < Math.abs(best.dx)) best = h;
  }
  return best;
}

/** Nicht stompbare, aktive Gefahr direkt voraus. */
function threatAhead(state, dir) {
  for (const h of state.hazards) {
    if (h.stompable) continue;
    if (!h.active && !h.warning) continue;
    if (dir > 0 && h.dx < -8) continue;
    if (dir < 0 && h.dx > 8) continue;
    if (Math.abs(h.dx) > 65 || Math.abs(h.dy) > 40) continue;
    return h;
  }
  return null;
}

export default {
  apiVersion: 1,
  name: "Stomp-Stefan",
  author: "Beispiel-Bot (Stomper)",
  color: "#9d7bff",
  decide(state) {
    if (state.justRespawned) reset();
    if (stompCooldown > 0) stompCooldown--;

    const actions = [];
    const dir = state.goalDirection.dx < 0 ? -1 : 1;
    let targetDx = state.goalDirection.dx;
    let sprint = true;

    const target = stompCooldown === 0 ? stompTarget(state) : null;

    if (target) {
      targetDx = target.dx;
      sprint = Math.abs(target.dx) > 50;
      // Kurz vor dem Gegner abspringen, um von oben zu landen.
      if (state.onGround && jumpTicks <= 0 && Math.abs(target.dx) < 55) {
        jumpTicks = 5;
        stompCooldown = 12;
      }
    } else {
      const threat = threatAhead(state, dir);
      const gap = state.gapAhead;
      const gapNear = gap.present && gap.distance !== null && gap.distance < 80;
      if (state.onGround && jumpTicks <= 0 && (threat !== null || gapNear)) {
        jumpTicks = 8;
      }
      // Fruechte am Weg mitnehmen.
      const coin = state.nearestCoin;
      if (coin && Math.abs(coin.dx) < 70 && Math.abs(coin.dy) < 50) {
        targetDx = coin.dx;
        sprint = false;
      }
    }

    if (jumpTicks > 0) {
      actions.push("jump");
      jumpTicks--;
    }

    actions.push(moveAction(targetDx, sprint));
    return actions;
  },
};
