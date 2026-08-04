/**
 * Beispiel-Bot: "Der Vorsichtige"
 * Weicht Gefahren defensiv aus, nimmt nur nahe, sichere Münzen mit.
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
  name: "Der Vorsichtige",
  author: "Beispiel",
  color: "#3b82f6",

  decide(state) {
    const hz = state.nearestHazard;
    if (hz && Math.abs(hz.dx) <= 3 && hz.dy >= -1 && state.onGround) {
      return "jump";
    }

    const coin = state.nearestCoin;
    const safe = !hz || Math.abs(hz.dx) > 4;

    if (coin && safe && Math.abs(coin.dx) <= 3) {
      const above = -coin.dy;
      if (above > 0 && above <= MAX_JUMP_TILES) {
        if (Math.abs(coin.dx) >= 1) {
          return coin.dx >= 0 ? "right" : "left";
        }
        if (state.onGround) return "jump";
      } else {
        const dir = coin.dx >= 0 ? "right" : "left";
        if (state.onGround && isGapAhead(state, dir)) return "jump";
        return dir;
      }
    }

    const dir = state.goalDirection.dx >= 0 ? "right" : "left";
    if (state.onGround && isGapAhead(state, dir)) {
      return "jump";
    }
    return dir;
  },
};
