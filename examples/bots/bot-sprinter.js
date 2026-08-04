/**
 * Beispiel-Bot: "Der Sprinter"
 *
 * Referenz-Artefakt im Bot-Modul-Format (wie es eine devkcode-Vibe-Coding-
 * Session erzeugt). Ein ES-Modul mit genau einem Default-Export.
 *
 * Contract:
 *   - Pflichtfeld `decide(state)` gibt eine Action zurück:
 *     "left" | "right" | "jump" | "idle"
 *   - `name`, `author`, `color` sind optional.
 *   - Kein import/require/fetch/window/document – reine Logik.
 */

const MAX_JUMP_TILES = 5;

function reachableByJump(target) {
  const above = -target.dy;
  return above > 0 && above <= MAX_JUMP_TILES && Math.abs(target.dx) <= 2;
}

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
  name: "Der Sprinter",
  author: "Beispiel",
  color: "#ef4444",

  decide(state) {
    const dir = state.goalDirection.dx >= 0 ? "right" : "left";

    const hz = state.nearestHazard;
    if (hz && Math.abs(hz.dx) <= 2 && hz.dy >= -1 && state.onGround) {
      return "jump";
    }

    if (state.onGround && isGapAhead(state, dir)) {
      return "jump";
    }

    const coin = state.nearestCoin;
    if (state.onGround && coin && reachableByJump(coin) && Math.abs(coin.dx) <= 1) {
      return "jump";
    }

    return dir;
  },
};
