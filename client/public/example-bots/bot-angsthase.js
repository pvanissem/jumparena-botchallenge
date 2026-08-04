/**
 * Beispiel-Bot: "Angsthase"
 * Extrem defensiv: hält großen Abstand zu Gefahren, springt früh und oft.
 * Nimmt nur Früchte mit, die praktisch auf dem Weg liegen.
 */

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
  name: "Angsthase",
  author: "Beispiel",
  color: "#a855f7",

  decide(state) {
    const hz = state.nearestHazard;
    // Sehr großer Sicherheitsradius.
    if (hz && hz.active && Math.abs(hz.dx) <= 4 && hz.dy >= -2 && state.onGround) {
      return "jump";
    }

    const dir = state.goalDirection.dx >= 0 ? "right" : "left";
    if (state.onGround && isGapAhead(state, dir)) return "jump";
    return dir;
  },
};
