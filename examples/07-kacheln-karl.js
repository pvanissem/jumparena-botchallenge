/**
 * Beispiel-Bot 7: "Kacheln-Karl" – der Rasterleser.
 *
 * Strategie: Entscheidet ausschliesslich anhand des Sichtfeld-Rasters
 * `nearbyTiles` (9 Zeilen x 11 Spalten, Bot in der Mitte bei [4][5]):
 * Wand rechts -> springen, Loch rechts -> springen, Hazard-Kachel voraus ->
 * springen, Muenzblock ueber mir -> von unten dagegen springen.
 *
 * Erwartetes Profil: simpel und robust, mittleres Ergebnis. Gut geeignet als
 * Referenz fuer "einfacher Bot" im Turnier-Feld.
 */

// Mitte des Rasters – der Bot selbst. Alle Zugriffe unten sind relativ dazu,
// damit eine Aenderung der Rastergroesse nur hier angefasst werden muss.
const BOT_ROW = 4;
const BOT_COL = 5;

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
    const col = BOT_COL + step; // direkt vor dem Bot
    const col2 = BOT_COL + step * 2; // eine Kachel weiter

    const bodyAhead = tileAt(state, BOT_ROW, col);
    const groundAhead = tileAt(state, BOT_ROW + 1, col);
    const groundAhead2 = tileAt(state, BOT_ROW + 1, col2);
    const blockAbove = tileAt(state, BOT_ROW - 1, BOT_COL);

    const wall = bodyAhead === "solid";
    const hole = groundAhead === "empty" && groundAhead2 === "empty";
    const hazard =
      bodyAhead === "hazard" ||
      groundAhead === "hazard" ||
      tileAt(state, BOT_ROW, col2) === "hazard";
    const coinBlock =
      blockAbove === "coinBlock" || tileAt(state, BOT_ROW - 2, BOT_COL) === "coinBlock";

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
