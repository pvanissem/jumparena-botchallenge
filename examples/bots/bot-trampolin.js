/**
 * Beispiel-Bot: "Trampolin-Freund"
 * Steuert bevorzugt Utilities (z.B. Trampoline) an, wenn eine hochgelegene
 * Frucht in der Nähe ist – nutzt den Boost, um an wertvolle Früchte zu kommen.
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
  name: "Trampolin-Freund",
  author: "Beispiel",
  color: "#14b8a6",

  decide(state) {
    const hz = state.nearestHazard;
    if (hz && hz.active && Math.abs(hz.dx) <= 2 && hz.dy >= -1 && state.onGround) {
      return "jump";
    }

    const coin = state.nearestCoin;
    const util = state.nearestUtility;

    // Ist eine hohe Frucht in der Nähe und ein Trampolin dazwischen?
    const highCoin = coin && -coin.dy > MAX_JUMP_TILES;
    if (highCoin && util && Math.abs(util.dx) <= 6) {
      if (Math.abs(util.dx) >= 1) {
        return util.dx >= 0 ? "right" : "left";
      }
      // Direkt auf dem Trampolin: kurz Anlauf, Boost kommt beim Landen.
      return "right";
    }

    if (coin) {
      const dir = coin.dx >= 0 ? "right" : "left";
      const above = -coin.dy;
      if (above > 0 && above <= MAX_JUMP_TILES && Math.abs(coin.dx) <= 1 && state.onGround) {
        return "jump";
      }
      if (state.onGround && isGapAhead(state, dir)) return "jump";
      return dir;
    }

    const dir = state.goalDirection.dx >= 0 ? "right" : "left";
    if (state.onGround && isGapAhead(state, dir)) return "jump";
    return dir;
  },
};
