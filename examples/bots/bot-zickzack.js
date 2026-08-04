/**
 * Beispiel-Bot: "Zickzack"
 * Weicht Gefahren nicht nur durch Springen aus, sondern hält kurz an (idle),
 * wenn direkt vor ihm eine aktive Gefahr auf Bodenhöhe ist – wartet ab und
 * geht dann weiter. Zeigt die Nutzung von "idle" als aktive Entscheidung.
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
  name: "Zickzack",
  author: "Beispiel",
  color: "#f472b6",

  decide(state) {
    const hz = state.nearestHazard;
    const dir = state.goalDirection.dx >= 0 ? "right" : "left";

    if (hz && hz.active && hz.dy >= -1) {
      // Ganz nah dran: drüberspringen.
      if (Math.abs(hz.dx) <= 1 && state.onGround) return "jump";
      // Mittlere Distanz und vor mir: kurz warten, bis die Bahn frei ist.
      const inFront =
        (dir === "right" && hz.dx > 0) || (dir === "left" && hz.dx < 0);
      if (inFront && Math.abs(hz.dx) <= 3) return "idle";
    }

    if (state.onGround && isGapAhead(state, dir)) return "jump";
    return dir;
  },
};
