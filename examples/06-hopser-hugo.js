/**
 * Beispiel-Bot 6: "Hopser-Hugo" – der Trampolin-Fan.
 *
 * Strategie: Sucht aktiv Trampoline (`boingo`) auf, wenn hoch gelegene
 * Fruechte in Sicht sind, und laesst sich nach oben katapultieren. Ohne
 * Trampolin verhaelt er sich wie ein normaler Sammler mit Sprungfreude.
 *
 * Erwartetes Profil: erreicht hohe Fruechte, unstete Zeit.
 */

let jumpTicks = 0;
let boingoLockTicks = 0;

function reset() {
  jumpTicks = 0;
  boingoLockTicks = 0;
}

function moveAction(dx, sprint) {
  if (Math.abs(dx) < 4) return "idle";
  const dir = dx > 0 ? "right" : "left";
  return sprint ? "sprint-" + dir : dir;
}

function nearestBoingo(state) {
  for (const u of state.utilities) {
    if (u.kind === "boingo") return u;
  }
  return null;
}

/** Hoch gelegene Frucht, die einen Trampolin-Umweg rechtfertigt. */
function highCoin(state) {
  let best = null;
  const limit = Math.min(6, state.coins.length);
  for (let i = 0; i < limit; i++) {
    const c = state.coins[i];
    if (c.dy > -40) continue;
    if (best === null || (c.value || 1) > (best.value || 1)) best = c;
  }
  return best;
}

export default {
  apiVersion: 1,
  name: "Hopser-Hugo",
  author: "Beispiel-Bot (Trampolin)",
  color: "#ff9f45",
  decide(state) {
    if (state.justRespawned) reset();
    if (boingoLockTicks > 0) boingoLockTicks--;

    const actions = [];
    let targetDx = state.goalDirection.dx;
    let targetDy = 0;
    let sprint = true;

    const boingo = nearestBoingo(state);
    const high = highCoin(state);

    if (boingo && high && state.timeElapsedMs < 60000) {
      // Trampolin ansteuern und von oben drauffallen lassen.
      targetDx = boingo.dx;
      targetDy = 0;
      sprint = Math.abs(boingo.dx) > 60;
      boingoLockTicks = 15;
    } else if (state.onGround === false && high) {
      // In der Luft Richtung hoch gelegener Frucht steuern.
      targetDx = high.dx;
      targetDy = high.dy;
      sprint = false;
    } else {
      const coin = state.nearestCoin;
      if (coin && Math.abs(coin.dx) < 100) {
        targetDx = coin.dx;
        targetDy = coin.dy;
        sprint = Math.abs(coin.dx) > 60;
      }
    }

    const gap = state.gapAhead;
    const gapNear = gap.present && gap.distance !== null && gap.distance < 80;
    const wantHeight = targetDy < -20 && Math.abs(targetDx) < 60 && boingoLockTicks === 0;

    if (state.onGround && jumpTicks <= 0) {
      if (gapNear) jumpTicks = 8;
      else if (wantHeight) jumpTicks = 9;
    }

    if (jumpTicks > 0) {
      actions.push("jump");
      jumpTicks--;
    }

    actions.push(moveAction(targetDx, sprint));
    return actions;
  },
};
