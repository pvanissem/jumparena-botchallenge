/**
 * Beispiel-Bot 2: "Sammel-Sarah" – die gruendliche Sammlerin.
 *
 * Strategie: Immer die naechste sichtbare Frucht ansteuern (auch nach links,
 * auch nach oben per Sprung). Ist nichts in Sicht, geht es Richtung Ziel
 * weiter. Ab 65 Sekunden Laufzeit wird nur noch das Ziel angesteuert, damit
 * kein DNF (-50 Punkte) entsteht.
 *
 * Erwartetes Profil: viele Fruchtpunkte, langsame Zeit.
 */

let jumpTicks = 0;
let targetLockTicks = 0;
let lockedDx = 0;

function reset() {
  jumpTicks = 0;
  targetLockTicks = 0;
  lockedDx = 0;
}

function moveAction(dx, sprint) {
  if (Math.abs(dx) < 4) return "idle";
  const dir = dx > 0 ? "right" : "left";
  return sprint ? "sprint-" + dir : dir;
}

/** Gefaehrliches Objekt sehr nah? Dann lieber nicht dorthin. */
function isDangerous(state, dx, dy) {
  for (const h of state.hazards) {
    if (!h.active && !h.warning) continue;
    if (Math.abs(h.dx - dx) < 24 && Math.abs(h.dy - dy) < 24) return true;
  }
  return false;
}

function pickCoin(state) {
  for (const c of state.coins) {
    if (isDangerous(state, c.dx, c.dy)) continue;
    return c;
  }
  return null;
}

export default {
  apiVersion: 1,
  name: "Sammel-Sarah",
  author: "Beispiel-Bot (Sammler)",
  color: "#ffd166",
  decide(state) {
    if (state.justRespawned) reset();

    const actions = [];
    const endgame = state.timeElapsedMs > 65000 || state.livesRemaining <= 1;

    let targetDx = state.goalDirection.dx;
    let targetDy = state.goalDirection.dy;
    let sprint = true;

    if (!endgame) {
      const coin = pickCoin(state);
      if (coin) {
        targetDx = coin.dx;
        targetDy = coin.dy;
        // Nah am Ziel lieber langsam, damit man nicht drueberschiesst.
        sprint = Math.abs(coin.dx) > 60;
        targetLockTicks = 20;
        lockedDx = coin.dx;
      } else if (targetLockTicks > 0) {
        // Kurz "dranbleiben", wenn die Frucht aus dem Sichtfeld rutscht.
        targetLockTicks--;
        targetDx = lockedDx;
        targetDy = 0;
      }
    }

    const gap = state.gapAhead;
    const gapNear = gap.present && gap.distance !== null && gap.distance < 70;
    const coinAbove = targetDy < -20 && Math.abs(targetDx) < 60;

    if (state.onGround && jumpTicks <= 0) {
      if (gapNear) jumpTicks = 8;
      else if (coinAbove) jumpTicks = targetDy < -50 ? 9 : 5;
      else if (state.velocity.vx === 0 && Math.abs(targetDx) > 8) jumpTicks = 6;
    }

    if (jumpTicks > 0) {
      actions.push("jump");
      jumpTicks--;
    }

    actions.push(moveAction(targetDx, sprint || endgame));
    return actions;
  },
};
