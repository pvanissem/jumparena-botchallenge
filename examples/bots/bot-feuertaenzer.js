/**
 * Beispiel-Bot: "Feuertänzer"
 * Nutzt aktiv den `active`-Zustand von Gefahren aus: bei getakteten Gefahren
 * (z.B. Feuer), die gerade AUS sind, läuft er einfach durch statt zu springen.
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
  name: "Feuertänzer",
  author: "Beispiel",
  color: "#ef4444",

  decide(state) {
    const hz = state.nearestHazard;
    const dir = state.goalDirection.dx >= 0 ? "right" : "left";

    // Nur springen, wenn die Gefahr gerade wirklich aktiv ist.
    if (hz && hz.active && Math.abs(hz.dx) <= 2 && hz.dy >= -1 && state.onGround) {
      return "jump";
    }

    if (state.onGround && isGapAhead(state, dir)) return "jump";
    return dir;
  },
};
