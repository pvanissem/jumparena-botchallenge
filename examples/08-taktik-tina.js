/**
 * Beispiel-Bot 8: "Taktik-Tina" – die Phasenspielerin.
 *
 * Strategie: Drei Phasen, gesteuert ueber Zeit und Leben:
 *   1. 0-30 s   "sammeln": Fruechte in Zielrichtung mitnehmen.
 *   2. 30-60 s  "gemischt": nur noch sehr nahe Fruechte, sonst Tempo.
 *   3. ab 60 s  "Endspurt": direkt ins Ziel (DNF vermeiden, -50 Punkte).
 * Nach einem Tod wird eine Phase vorsichtiger gespielt.
 *
 * Erwartetes Profil: solider Allrounder – guter Gegner fuer Testlaeufe.
 */

let jumpTicks = 0;
let lastX = null;
let stuckTicks = 0;

function reset() {
  jumpTicks = 0;
  lastX = null;
  stuckTicks = 0;
}

function moveAction(dx, sprint) {
  if (Math.abs(dx) < 4) return "idle";
  const dir = dx > 0 ? "right" : "left";
  return sprint ? "sprint-" + dir : dir;
}

function phaseOf(state) {
  if (state.timeElapsedMs > 60000 || state.livesRemaining <= 1) return "rush";
  if (state.timeElapsedMs > 30000 || state.livesRemaining <= 2) return "mixed";
  return "collect";
}

function safeCoin(state, maxDx, maxDy, goalDir) {
  const limit = Math.min(5, state.coins.length);
  for (let i = 0; i < limit; i++) {
    const c = state.coins[i];
    if (Math.abs(c.dx) > maxDx || Math.abs(c.dy) > maxDy) continue;
    if (goalDir !== 0 && Math.sign(c.dx) === -goalDir && Math.abs(c.dx) > 40) continue;
    let blocked = false;
    for (const h of state.hazards) {
      if (!h.active && !h.warning) continue;
      if (Math.abs(h.dx - c.dx) < 30 && Math.abs(h.dy - c.dy) < 30) {
        blocked = true;
        break;
      }
    }
    if (!blocked) return c;
  }
  return null;
}

export default {
  apiVersion: 1,
  name: "Taktik-Tina",
  author: "Beispiel-Bot (Allrounder)",
  color: "#38bdf8",
  decide(state) {
    if (state.justRespawned) reset();

    const actions = [];
    const phase = phaseOf(state);
    const goalDir = state.goalDirection.dx < 0 ? -1 : 1;

    // Feststeck-Erkennung
    if (lastX !== null && Math.abs(state.position.x - lastX) < 1.5 && state.onGround) {
      stuckTicks++;
    } else {
      stuckTicks = 0;
    }
    lastX = state.position.x;

    let targetDx = state.goalDirection.dx;
    let targetDy = 0;
    let sprint = true;

    if (phase === "collect") {
      const coin = safeCoin(state, 130, 80, goalDir);
      if (coin) {
        targetDx = coin.dx;
        targetDy = coin.dy;
        sprint = Math.abs(coin.dx) > 60;
      }
    } else if (phase === "mixed") {
      const coin = safeCoin(state, 60, 40, goalDir);
      if (coin) {
        targetDx = coin.dx;
        targetDy = coin.dy;
      }
    }

    const gap = state.gapAhead;
    const gapNear = gap.present && gap.distance !== null && gap.distance < 85;
    const h = state.nearestHazard;
    const threatNear =
      h !== null &&
      (h.active || h.warning) &&
      Math.sign(h.dx) === goalDir &&
      Math.abs(h.dx) < 60 &&
      Math.abs(h.dy) < 40;

    // Nicht ueberspringbare Gefahr im Endspurt lieber kurz abwarten.
    if (threatNear && h.kind === "loderix" && phase !== "rush") {
      actions.push("idle");
      return actions;
    }

    if (state.onGround && jumpTicks <= 0) {
      if (gapNear || stuckTicks > 6) jumpTicks = 9;
      else if (threatNear) jumpTicks = 7;
      else if (targetDy < -20 && Math.abs(targetDx) < 60) jumpTicks = 6;
    }

    if (jumpTicks > 0) {
      actions.push("jump");
      jumpTicks--;
    }

    actions.push(moveAction(targetDx, sprint || phase === "rush"));
    return actions;
  },
};
