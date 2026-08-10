/**
 * Beispiel-Bot 5: "Wertjaeger-Wanda" – die Rechnerin.
 *
 * Strategie: Bewertet jede sichtbare Frucht nach "Punkte pro Umweg"
 * (value / Distanz, plus Bonus fuer Fruechte in Zielrichtung) und steuert nur
 * die beste an. Lohnt sich keine, geht es direkt weiter Richtung Ziel.
 *
 * Erwartetes Profil: guter Kompromiss aus Punkten und Zeit.
 */

let jumpTicks = 0;

function reset() {
  jumpTicks = 0;
}

function moveAction(dx, sprint) {
  if (Math.abs(dx) < 4) return "idle";
  const dir = dx > 0 ? "right" : "left";
  return sprint ? "sprint-" + dir : dir;
}

function hazardNear(state, dx, dy, radius) {
  for (const h of state.hazards) {
    if (!h.active && !h.warning) continue;
    if (Math.abs(h.dx - dx) < radius && Math.abs(h.dy - dy) < radius) return true;
  }
  return false;
}

/** Beste Frucht nach Nutzen/Aufwand. */
function bestCoin(state) {
  const goalDir = state.goalDirection.dx < 0 ? -1 : 1;
  let best = null;
  let bestScore = 0;
  // Bewusst nur die naechsten 6 Fruechte - das 5ms-Budget ist knapp.
  const limit = Math.min(6, state.coins.length);
  for (let i = 0; i < limit; i++) {
    const c = state.coins[i];
    if (hazardNear(state, c.dx, c.dy, 28)) continue;
    const distance = Math.abs(c.dx) + Math.abs(c.dy) * 1.5 + 20;
    let score = (c.value || 1) / distance;
    // Fruechte in Zielrichtung sind "gratis", Umwege kosten.
    if (Math.sign(c.dx) === goalDir || c.dx === 0) score *= 2.5;
    if (c.dy < -60) score *= 0.5; // hoch gelegen = schwer erreichbar
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return bestScore > 0.012 ? best : null;
}

export default {
  apiVersion: 1,
  name: "Wertjaeger-Wanda",
  author: "Beispiel-Bot (Optimierer)",
  color: "#4ade80",
  decide(state) {
    if (state.justRespawned) reset();

    const actions = [];
    const endgame = state.timeElapsedMs > 60000;

    let targetDx = state.goalDirection.dx;
    let targetDy = 0;
    let sprint = true;

    if (!endgame) {
      const coin = bestCoin(state);
      if (coin) {
        targetDx = coin.dx;
        targetDy = coin.dy;
        sprint = Math.abs(coin.dx) > 55;
      }
    }

    const gap = state.gapAhead;
    const gapNear = gap.present && gap.distance !== null && gap.distance < 80;
    const needsHeight = targetDy < -18 && Math.abs(targetDx) < 70;
    const threat = state.nearestHazard;
    const threatNear =
      threat !== null &&
      (threat.active || threat.warning) &&
      Math.abs(threat.dx) < 60 &&
      Math.abs(threat.dy) < 40;

    if (state.onGround && jumpTicks <= 0) {
      if (gapNear) jumpTicks = 8;
      else if (threatNear) jumpTicks = 7;
      else if (needsHeight) jumpTicks = targetDy < -55 ? 9 : 5;
    }

    if (jumpTicks > 0) {
      actions.push("jump");
      jumpTicks--;
    }

    actions.push(moveAction(targetDx, sprint));
    return actions;
  },
};
