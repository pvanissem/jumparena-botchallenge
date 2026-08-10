/**
 * Beispiel-Bot 7: "Kacheln-Karl" – der Rasterleser.
 *
 * Strategie: Entscheidet ausschliesslich anhand des Sichtfeld-Rasters
 * `nearbyTiles` (5 Zeilen x 7 Spalten, Bot in der Mitte bei [2][3]):
 * Wand rechts -> springen, Loch rechts -> springen, Hazard-Kachel voraus ->
 * springen, Muenzblock ueber mir -> von unten dagegen springen.
 *
 * Erwartetes Profil: simpel und robust, mittleres Ergebnis. Gut geeignet als
 * Referenz fuer "einfacher Bot" im Turnier-Feld.
 */

let jumpTicks = 0;

function reset() {
  jumpTicks = 0;
}

function tileAt(state, row, col) {
  const grid = state.nearbyTiles;
  if (!grid || !grid[row]) return "unknown";
  const value = grid[row][col];
  return value === undefined ? "unknown" : value;
}

export default {
  apiVersion: 1,
  name: "Kacheln-Karl",
  author: "Beispiel-Bot (Rasterleser)",
  color: "#e05c5c",
  decide(state) {
    if (state.justRespawned) reset();

    const actions = [];
    const goingRight = state.goalDirection.dx >= 0;
    const step = goingRight ? 1 : -1;
    const col = 3 + step; // direkt vor dem Bot
    const col2 = 3 + step * 2; // eine Kachel weiter

    const bodyAhead = tileAt(state, 2, col);
    const groundAhead = tileAt(state, 3, col);
    const groundAhead2 = tileAt(state, 3, col2);
    const blockAbove = tileAt(state, 1, 3);

    const wall = bodyAhead === "solid";
    const hole = groundAhead === "empty" && groundAhead2 === "empty";
    const hazard =
      bodyAhead === "hazard" || groundAhead === "hazard" || tileAt(state, 2, col2) === "hazard";
    const coinBlock = blockAbove === "coinBlock" || tileAt(state, 0, 3) === "coinBlock";

    if (state.onGround && jumpTicks <= 0) {
      if (hole) jumpTicks = 9;
      else if (wall || hazard) jumpTicks = 7;
      else if (coinBlock) jumpTicks = 6;
    }

    if (jumpTicks > 0) {
      actions.push("jump");
      jumpTicks--;
    }

    // Muenze in Reichweite? Kurz hinsteuern, sonst Richtung Ziel.
    const coin = state.nearestCoin;
    if (coin && Math.abs(coin.dx) < 60 && Math.abs(coin.dy) < 40) {
      actions.push(coin.dx > 0 ? "right" : "left");
    } else {
      actions.push(goingRight ? "sprint-right" : "sprint-left");
    }

    return actions;
  },
};
