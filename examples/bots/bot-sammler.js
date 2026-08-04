/**
 * Beispiel-Bot: "Der Sammler"
 * Priorisiert Münzen (auch über sich – springt aktiv), sonst Richtung Ziel.
 */

const MAX_JUMP_TILES = 5;

function isGapAhead(state, dir) {
  const rows = state.nearbyTiles;
  if (!rows.length) return false;
  const midRow = Math.floor(rows.length / 2);
  const midCol = Math.floor(rows[midRow].length / 2);
  const col = dir === "right" ? midCol + 1 : midCol - 1;
  const belowRow = midRow + 1;
  if (belowRow >= rows.length) return false;
  const cell = rows[belowRow] && rows[belowRow][col];
  return cell === "empty" || cell === "hazard" || cell === undefined;
}

export default {
  apiVersion: 1,
  name: "Der Sammler",
  author: "Beispiel",
  color: "#eab308",

  decide(state) {
    const hz = state.nearestHazard;
    if (hz && Math.abs(hz.dx) <= 2 && hz.dy >= -1 && state.onGround) {
      return "jump";
    }

    const coin = state.nearestCoin;
    if (coin) {
      const above = -coin.dy;
      if (above > 0 && above <= MAX_JUMP_TILES) {
        if (Math.abs(coin.dx) >= 1) {
          return coin.dx >= 0 ? "right" : "left";
        }
        if (state.onGround) return "jump";
      }
      const dir = coin.dx >= 0 ? "right" : "left";
      if (state.onGround && isGapAhead(state, dir)) return "jump";
      return dir;
    }

    const dir = state.goalDirection.dx >= 0 ? "right" : "left";
    if (state.onGround && isGapAhead(state, dir)) return "jump";
    return dir;
  },
};
