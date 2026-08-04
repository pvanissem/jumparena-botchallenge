/**
 * Beispiel-Bot: "Stomper"
 * Sucht gezielt stompbare Gegner ("schnetzler") und springt auf sie drauf,
 * statt auszuweichen. Andere Gefahren umgeht er.
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
  name: "Stomper",
  author: "Beispiel",
  color: "#eab308",

  decide(state) {
    const hz = state.nearestHazard;
    const dir = state.goalDirection.dx >= 0 ? "right" : "left";

    if (hz && hz.active && Math.abs(hz.dx) <= 2 && hz.dy >= -1 && state.onGround) {
      // Stompbaren Gegner (Säge) aktiv anspringen; sonst ausweichen/springen.
      return "jump";
    }

    if (state.onGround && isGapAhead(state, dir)) return "jump";
    return dir;
  },
};
