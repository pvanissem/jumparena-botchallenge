/**
 * Dein Bot – wird ~30x pro Sekunde (alle ~33ms) aufgerufen und muss synchron
 * eine Liste von Actions zurückgeben. Erlaubte Actions:
 *   "left" | "right" | "jump" | "idle" | "sprint-left" | "sprint-right"
 *
 * Du darfst mehrere Actions gleichzeitig zurückgeben, z.B. ["jump", "right"]
 * (springen und dabei nach rechts steuern). Ein leeres Array [] = nichts tun.
 * Bei mehreren Richtungs-Actions gewinnt die zuletzt genannte.
 *
 * state enthält u.a.:
 *   position, facing, onGround, isAlive
 *   velocity           - { vx, vy } eigene Geschwindigkeit
 *   isSprinting        - baut gerade Sprint-Tempo auf?
 *   sprintRampProgress - 0..1, wie weit die Sprint-Rampe schon aufgebaut ist
 *   nearbyTiles        - Sichtfeld-Raster (7x5) um den Bot
 *   platforms          - exakte Rechtecke aller sichtbaren, festen Flächen:
 *                          [{ dx, dy, width, height, kind }, ...]
 *                          kind: "ground" | "float" | "ceiling" | "block"
 *   tuning             - Bewegungs-Physik-Konstanten (siehe unten)
 *   coins              - alle sichtbaren Fruechte: [{ dx, dy, value }, ...]
 *   hazards            - alle sichtbaren Gefahren:
 *                          [{ dx, dy, kind, active, warning, stompable, vx, vy }, ...]
 *   utilities          - alle sichtbaren Hilfsobjekte: [{ dx, dy, kind }, ...]
 *   nearestCoin        - kuerzeste Abkuerzung = coins[0] oder null
 *   nearestHazard      - = hazards[0] oder null
 *   nearestUtility     - = utilities[0] oder null
 *   goalDirection      - { dx, dy } Richtung zum Ziel (in Pixeln)
 *   gapAhead           - { present, distance } Abgrund in Laufrichtung?
 *   worldBounds        - { width, height } Levelgroesse
 *   justRespawned, tookDamage
 *   coinsCollected, livesRemaining, timeElapsedMs
 *
 * Alle Distanzen (dx, dy, goalDirection) sind in Pixeln, relativ zum Bot:
 * dx < 0 = links, dy < 0 = oben (y waechst nach unten).
 *
 * Dein Bot laeuft isoliert in einem Web Worker: keine Modul-Ladebefehle, keine
 * Netzwerk- oder Browser-Zugriffe moeglich (das ist bereits durch die Sandbox
 * sichergestellt, du musst dich darum nicht kuemmern).
 *
 * ---------------------------------------------------------------------------
 * NAVIGATIONS-HILFSFUNKTIONEN (unten in dieser Datei implementiert)
 * ---------------------------------------------------------------------------
 * Das sind ganz normale Funktionen in dieser Datei – du darfst sie lesen,
 * anpassen oder durch eigene Logik ersetzen. Referenz-Index (Details siehe
 * Kommentar direkt über jeder Funktion):
 *
 *   predictPath(state, opts)          -> simulierte Flugbahn [{dx,dy,vx,vy,ticks}]
 *   calcLandingCoords(state, opts?)   -> wo lande ich, wenn ich opts ausfuehre?
 *   simulateJump(state, holdTicks)    -> wie calcLandingCoords, expliziter Sprung
 *   apex(state, opts?)                -> höchster Punkt der Flugbahn
 *   minJumpHoldToReach(state, dx, dy) -> wie lange "jump" halten, um (dx,dy) zu erreichen
 *   ticksUntilEdge(state)             -> Ticks bis zur Plattformkante in facing-Richtung
 *   surfaceAt(state, dx)              -> dy der naechsten festen Flaeche bei Versatz dx
 *   wallAhead(state)                  -> { distance, height } unspringbare Wand voraus
 *   predictHazard(state, hazard, ticks) -> vorhergesagte Hazard-Position/-Status
 *   pathIntersectsHazard(state, path, hazard) -> kreuzt meine Bahn diesen Hazard?
 *   moveToward(dx, sprint)            -> passende Action ("left"/"sprint-right"/...)
 *   createJumpHold()                  -> Zaehler-Objekt zum Halten von "jump" über Ticks
 *   pathHits(path, dx, dy, radius)    -> kommt die Bahn nah an (dx,dy) vorbei?
 */

// ---------------------------------------------------------------------------
// Interne Hilfsfunktionen (nicht exportiert - reine Bausteine für die
// Navigations-Helfer unten).
//
// WICHTIG: Die Spielphysik hat KEINEN Drag/Reibung. Horizontale Geschwindigkeit
// wird direkt gesetzt (nicht beschleunigt), vertikal gilt reine konstante
// Beschleunigung (Schwerkraft). Die komplette Flugbahn ist deshalb eine exakte
// Parabel (mit einem optionalen Knick beim Jump-Cut) - wir simulieren NICHT
// Schritt für Schritt (das würde bei groben Zeitschritten Rechenfehler
// einführen), sondern lösen die Position für jeden Zeitpunkt direkt per
// Kinematik-Formel (`y(t) = vy0*t + 0.5*g*t^2`).
// ---------------------------------------------------------------------------

function rampedSpeedFor(holdMs, tuning) {
  const t = Math.max(0, Math.min(1, holdMs / tuning.sprintRampMs));
  return tuning.baseMoveSpeed + (tuning.sprintMoveSpeed - tuning.baseMoveSpeed) * t;
}

function jumpVelocityFor(speed, tuning) {
  const range = tuning.sprintMoveSpeed - tuning.baseMoveSpeed;
  const t = range <= 0 ? 0 : Math.max(0, Math.min(1, (speed - tuning.baseMoveSpeed) / range));
  return tuning.baseJumpVelocity + (tuning.sprintJumpVelocity - tuning.baseJumpVelocity) * t;
}

/** Exakte horizontale Position/Geschwindigkeit zum Zeitpunkt `tSec` (Sekunden
 *  seit Start). Sprint ist eine lineare Rampe von der aktuellen Geschwindigkeit
 *  bis `sprintMoveSpeed` über die verbleibende Rampenzeit - danach konstant.
 *  Ohne Sprint (oder `dir===0`) ist die Geschwindigkeit sofort konstant (siehe
 *  Spielregel: "nichts ändern" kappt vx sofort auf 0). */
function horizontalStateAt(tSec, dir, sprint, tuning, sprintHoldMs0) {
  if (dir === 0) return { vx: 0, dx: 0 };

  if (!sprint) {
    const vx = dir * tuning.baseMoveSpeed;
    return { vx, dx: vx * tSec };
  }

  const rampSec = tuning.sprintRampMs / 1000;
  const elapsedSec = Math.min(rampSec, sprintHoldMs0 / 1000);
  const speedAt = (elapsedNow) =>
    tuning.baseMoveSpeed +
    (tuning.sprintMoveSpeed - tuning.baseMoveSpeed) * Math.min(1, elapsedNow / rampSec);

  const remainingRampSec = Math.max(0, rampSec - elapsedSec);
  if (tSec <= remainingRampSec) {
    const v0 = speedAt(elapsedSec);
    const slope = (tuning.sprintMoveSpeed - tuning.baseMoveSpeed) / rampSec;
    const speed = v0 + slope * tSec;
    const dist = v0 * tSec + 0.5 * slope * tSec * tSec;
    return { vx: dir * speed, dx: dir * dist };
  }
  const v0 = speedAt(elapsedSec);
  const slope = (tuning.sprintMoveSpeed - tuning.baseMoveSpeed) / rampSec;
  const distDuringRamp =
    v0 * remainingRampSec + 0.5 * slope * remainingRampSec * remainingRampSec;
  const tAfter = tSec - remainingRampSec;
  const dist = distDuringRamp + tuning.sprintMoveSpeed * tAfter;
  return { vx: dir * tuning.sprintMoveSpeed, dx: dir * dist };
}

/** Exakte vertikale Position/Geschwindigkeit zum Zeitpunkt `tSec`. `cutSec`
 *  ist der (globale) Zeitpunkt, an dem "jump" losgelassen wird und die
 *  variable Sprunghöhe greift (`null` = kein Sprung/kein Cut in diesem Aufruf).
 *  Ein Cut wirkt nur, wenn zu diesem Zeitpunkt noch gestiegen wird (vy < 0) -
 *  danach ist die Bahn eine neue, bei vy=0 neu gestartete Parabel (siehe
 *  `shouldCutJump`/`RaceScene.applyJumpOnly`: `vy` wird hart auf 0 gesetzt). */
function verticalStateAt(tSec, vy0, gravity, cutSec) {
  const uncut = () => ({
    vy: vy0 + gravity * tSec,
    dy: vy0 * tSec + 0.5 * gravity * tSec * tSec,
  });

  if (cutSec === null || vy0 >= 0) return uncut();

  const tApex = -vy0 / gravity;
  if (cutSec >= tApex) return uncut(); // Cut greift nie (Scheitel längst erreicht)

  if (tSec <= cutSec) return uncut();

  const yCut = vy0 * cutSec + 0.5 * gravity * cutSec * cutSec;
  const t2 = tSec - cutSec;
  return { vy: gravity * t2, dy: yCut + 0.5 * gravity * t2 * t2 };
}

/** Reelle Nullstellen (t>=0) von `0.5*g*t^2 + vy0*t - targetDy = 0`, also die
 *  Zeitpunkte, an denen eine (uncut) Parabel eine bestimmte Höhe `targetDy`
 *  durchläuft. Aufsteigend sortiert. */
function quadraticCrossingTimes(vy0, gravity, targetDy) {
  const a = 0.5 * gravity;
  const b = vy0;
  const c = -targetDy;
  if (Math.abs(a) < 1e-9) {
    if (Math.abs(b) < 1e-9) return [];
    const t = -c / b;
    return t >= 0 ? [t] : [];
  }
  const disc = b * b - 4 * a * c;
  if (disc < 0) return [];
  const sq = Math.sqrt(disc);
  return [(-b - sq) / (2 * a), (-b + sq) / (2 * a)]
    .filter((t) => t >= -1e-9)
    .map((t) => Math.max(0, t))
    .sort((x, y) => x - y);
}

/**
 * Findet die früheste Kollision einer vertikalen Phase (Start bei `vy0`,
 * globalem Startzeitpunkt `tOffsetSec`) mit einer Plattform, innerhalb
 * `searchEndSec` (lokale Zeit relativ zum Phasenstart) - unter
 * Berücksichtigung horizontaler Überlappung ZUM Kollisionszeitpunkt. Wird nur
 * innerhalb eines EINZELNEN, ungekappten Parabel-Abschnitts aufgerufen (siehe
 * `predictPath`: ein Jump-Cut wird als eigener Phasenwechsel behandelt, BEVOR
 * diese Funktion für den nächsten Abschnitt erneut aufgerufen wird - sonst
 * würde hier mit der falschen, ungekappten Formel nach der Landung gesucht).
 */
function findEarliestCrossing(
  platforms,
  tuning,
  gravity,
  vy0,
  tOffsetSec,
  searchEndSec,
  dir,
  sprint,
  sprintHoldMs0,
  horizontalOffsetAtPhaseStart,
  verticalOffsetAtPhaseStart
) {
  const halfW = tuning.botWidth / 2;
  const halfH = tuning.botHeight / 2;
  const vOffset = verticalOffsetAtPhaseStart;
  let best = null;

  for (const p of platforms) {
    // Boden-Kandidat: Bot-Unterkante (dy+halfH) trifft Plattform-Oberkante (p.dy).
    // WICHTIG: `quadraticCrossingTimes` loest die PHASEN-LOKALE Parabel (die bei
    // dy=0 startet), die Plattform-Höhe ist aber absolut -> der vertikale
    // Phasen-Offset muss abgezogen werden. Fehlte das, lieferte die Suche nach
    // jedem Phasenwechsel (Jump-Cut/Decke) gar keine Loesung mehr.
    for (const tLocal of quadraticCrossingTimes(vy0, gravity, p.dy - halfH - vOffset)) {
      if (tLocal > searchEndSec + 1e-9) continue;
      const vy = vy0 + gravity * tLocal;
      if (vy < 0) continue; // nur abwärts zaehlt als Landung
      const tGlobal = tOffsetSec + tLocal;
      const { dx: relDx } = horizontalStateAt(tGlobal, dir, sprint, tuning, sprintHoldMs0);
      const dx = horizontalOffsetAtPhaseStart + relDx;
      if (dx + halfW <= p.dx || dx - halfW >= p.dx + p.width) continue;
      if (best === null || tLocal < best.tLocal) {
        best = { tLocal, tGlobal, dx, dy: p.dy - halfH, kind: "ground" };
      }
    }
    // Decken-Kandidat: Bot-Oberkante (dy-halfH) trifft Plattform-Unterkante.
    for (const tLocal of quadraticCrossingTimes(
      vy0,
      gravity,
      p.dy + p.height + halfH - vOffset
    )) {
      if (tLocal > searchEndSec + 1e-9) continue;
      const vy = vy0 + gravity * tLocal;
      if (vy >= 0) continue; // nur aufwärts zaehlt als Deckenaufprall
      const tGlobal = tOffsetSec + tLocal;
      const { dx: relDx } = horizontalStateAt(tGlobal, dir, sprint, tuning, sprintHoldMs0);
      const dx = horizontalOffsetAtPhaseStart + relDx;
      if (dx + halfW <= p.dx || dx - halfW >= p.dx + p.width) continue;
      if (best === null || tLocal < best.tLocal) {
        best = { tLocal, tGlobal, dx, dy: p.dy + p.height + halfH, kind: "ceiling" };
      }
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Navigations-Helfer
// ---------------------------------------------------------------------------

/**
 * Berechnet die zukünftige Bahn des Bots über `opts.maxTicks` Bot-Ticks
 * (Default 40, ~1,3s), ausgehend von der aktuellen Position/Geschwindigkeit -
 * EXAKT über Kinematik-Formeln (keine Schritt-für-Schritt-Simulation, siehe
 * Kommentar oben). `opts`:
 *   dir            -1 | 0 | 1   horizontale Richtung (Default: aktuelle velocity.vx)
 *   sprint         boolean      sprinten? (Default: false)
 *   jump           boolean      im ersten Tick springen, wenn onGround (Default: false)
 *   holdJumpTicks  number       wie viele Ticks lang "jump" gehalten wird (Default: 1 falls jump)
 *   maxTicks       number       Simulationshorizont (Default: 40)
 * Gibt eine Liste `{ dx, dy, vx, vy, ticks }` zurück, relativ zur AKTUELLEN
 * Bot-Position (tick 0), ausgewertet an jeder Tick-Grenze. Kollidiert die Bahn
 * von oben mit einer Plattform, endet die Liste dort (`landed: true`). Ein
 * Deckenaufprall setzt vy auf 0 und die Bahn läuft (als neue Phase) weiter.
 */
export function predictPath(state, opts) {
  const tuning = state.tuning;
  const o = opts || {};
  const dir =
    o.dir !== undefined ? o.dir : state.velocity.vx > 0 ? 1 : state.velocity.vx < 0 ? -1 : 0;
  const sprint = !!o.sprint;
  const maxTicks = o.maxTicks !== undefined ? o.maxTicks : 40;
  const holdJumpTicks = o.holdJumpTicks !== undefined ? o.holdJumpTicks : o.jump ? 1 : 0;
  const tickSec = tuning.tickMs / 1000;
  const maxSec = maxTicks * tickSec;
  const sprintHoldMs0 = dir !== 0 && sprint ? state.sprintRampProgress * tuning.sprintRampMs : 0;

  // Vertikale Phasen: jede Phase hat einen globalen Start (tOffsetSec/dyOffset),
  // eine Start-vy und einen optionalen Cut-Zeitpunkt (relativ zum Phasenstart).
  // Eine neue Phase beginnt nach jedem Deckenaufprall (vy wird dort auf 0
  // zurückgesetzt), siehe `verticalStateAt`.
  let phaseStartSec = 0;
  let phaseVy0 = state.velocity.vy;
  let phaseCutSec = null;
  let phaseDyOffset = 0;

  if (o.jump && state.onGround) {
    const holdSec = (holdJumpTicks * tuning.tickMs) / 1000;
    const { vx: vxAtJump } = horizontalStateAt(0, dir, sprint, tuning, sprintHoldMs0);
    const currentSpeed = Math.abs(vxAtJump) || tuning.baseMoveSpeed;
    phaseVy0 = jumpVelocityFor(currentSpeed, tuning);
    phaseCutSec = Math.max(tuning.minJumpHoldMs / 1000, holdSec);
  }

  const points = [];
  const dxOffset = 0; // horizontaler Versatz - Richtung ändert sich nie mitten im Aufruf.

  // Kollisionen phasenweise auflösen. Eine Phase ist ein EINZELNER, ungekappter
  // Parabel-Abschnitt; sowohl ein Deckenaufprall als auch ein Jump-Cut beenden
  // eine Phase und starten eine neue (vy=0). Max. 8 Phasenwechsel - deutlich
  // mehr als in der Praxis je vorkommt, reine Sicherheitsgrenze gegen
  // Endlosschleifen bei pathologischer Level-Geometrie.
  for (let phase = 0; phase < 8; phase++) {
    // Diese Phase darf höchstens bis zu ihrem eigenen Cut reichen (falls
    // vorhanden) - danach gilt eine ANDERE Formel (vy=0-Neustart), also darf
    // die Kollisionssuche (die eine einzige ungekappte Parabel voraussetzt)
    // nicht darüber hinaus suchen (das war der ursprüngliche Bug: Landungen
    // NACH dem Cut wurden mit der falschen, ungekappten Flugbahn gesucht).
    const phaseCutGlobalSec = phaseCutSec !== null ? phaseStartSec + phaseCutSec : null;
    const searchEndSec =
      phaseCutGlobalSec !== null
        ? Math.min(maxSec, phaseCutGlobalSec) - phaseStartSec
        : maxSec - phaseStartSec;

    const collision = findEarliestCrossing(
      state.platforms,
      tuning,
      tuning.gravity,
      phaseVy0,
      phaseStartSec,
      searchEndSec,
      dir,
      sprint,
      sprintHoldMs0,
      dxOffset,
      phaseDyOffset
    );

    const phaseEndSec = collision ? collision.tGlobal : phaseStartSec + searchEndSec;

    // Tick-Punkte innerhalb dieser Phase ausgeben (verticalStateAt kennt den
    // Cut selbst noch nicht relevant, da wir hier nie über ihn hinaus laufen).
    const firstTick = Math.floor(phaseStartSec / tickSec) + 1;
    const lastTick = Math.floor((phaseEndSec + 1e-9) / tickSec);
    for (let tick = firstTick; tick <= lastTick && tick <= maxTicks; tick++) {
      const tGlobal = tick * tickSec;
      const { dx, vx } = horizontalStateAt(tGlobal, dir, sprint, tuning, sprintHoldMs0);
      const { dy, vy } = verticalStateAt(tGlobal - phaseStartSec, phaseVy0, tuning.gravity, null);
      points.push({ dx: dxOffset + dx, dy: phaseDyOffset + dy, vx, vy, ticks: tick });
    }

    if (collision) {
      if (collision.kind === "ground") {
        const tick = Math.min(maxTicks, Math.ceil(collision.tGlobal / tickSec));
        points.push({
          dx: collision.dx,
          dy: collision.dy,
          vx: 0,
          vy: 0,
          ticks: tick,
          landed: true,
        });
        break;
      }
      // Deckenaufprall: neue Phase ab hier, vy=0, kein Cut mehr relevant.
      phaseDyOffset = collision.dy;
      phaseStartSec = collision.tGlobal;
      phaseVy0 = 0;
      phaseCutSec = null;
      if (collision.tGlobal >= maxSec) break;
      continue;
    }

    // Keine Kollision gefunden. War die Suche durch den Cut begrenzt (nicht
    // durch den Zeit-Horizont)? Dann ist der Cut selbst der Phasenwechsel:
    // vy springt auf 0, eine neue (ungekappte) Phase beginnt genau dort.
    if (phaseCutGlobalSec !== null && phaseCutGlobalSec < maxSec - 1e-9) {
      const { dy } = verticalStateAt(phaseCutSec, phaseVy0, tuning.gravity, null);
      phaseDyOffset += dy;
      phaseStartSec = phaseCutGlobalSec;
      phaseVy0 = 0;
      phaseCutSec = null;
      continue;
    }

    break; // Zeit-Horizont erreicht, keine weitere Phase.
  }

  return points;
}

/**
 * Wo lande ich, wenn ich `opts` ausführe (Default: aktuelle Bewegung
 * unverändert fortsetzen - KEIN `dir: 0`, sondern `state.velocity.vx`
 * fortgeschrieben, siehe `predictPath`)? `kind`:
 *   "ground"  - auf einer Plattform gelandet
 *   "ceiling" - zuletzt gegen eine Decke/einen Block gestoßen (selten relevant)
 *   "none"    - keine Landung innerhalb von `opts.maxTicks`/des Sichtradius
 */
export function calcLandingCoords(state, opts) {
  const path = predictPath(state, opts);
  const last = path[path.length - 1];
  if (!last) {
    return { dx: 0, dy: 0, ticks: 0, kind: "none" };
  }
  if (last.landed) {
    return { dx: last.dx, dy: last.dy, ticks: last.ticks, kind: "ground" };
  }
  return { dx: last.dx, dy: last.dy, ticks: last.ticks, kind: "none" };
}

/** Wie `calcLandingCoords`, aber mit explizitem Sprung: hält "jump" für
 *  `holdTicks` Ticks (mind. 1). `opts` wird durchgereicht - ohne
 *  `{ dir, sprint }` würde mit Basistempo gerechnet, was bei einem
 *  sprintenden Bot nicht zur tatsächlichen Bewegung passt. */
export function simulateJump(state, holdTicks, opts) {
  return calcLandingCoords(state, {
    ...(opts || {}),
    jump: true,
    holdJumpTicks: Math.max(1, holdTicks),
  });
}

/** Höchster Punkt (kleinstes dy) der mit `predictPath` berechneten Bahn. */
export function apex(state, opts) {
  const path = predictPath(state, opts);
  let best = { dx: 0, dy: 0, ticks: 0 };
  for (const p of path) {
    if (p.dy < best.dy) best = { dx: p.dx, dy: p.dy, ticks: p.ticks };
  }
  return best;
}

/**
 * Minimale Anzahl Ticks, die "jump" gehalten werden muss, damit die Bahn den
 * Punkt (dx, dy) erreicht oder überfliegt (Toleranz `radius` Pixel, Default
 * eine halbe Bot-Breite). `null`, wenn mit keiner Haltezeit erreichbar.
 * `opts` (optional) wird an `predictPath` durchgereicht - wichtig, wenn der
 * Bot sprintet: ohne `{ dir, sprint }` würde mit Basistempo gerechnet und das
 * Ergebnis passt nicht zur tatsächlichen Bewegung.
 */
export function minJumpHoldToReach(state, dx, dy, radius, opts) {
  const tuning = state.tuning;
  const r = radius !== undefined ? radius : tuning.botWidth / 2;
  // Obergrenze: Zeit, bis die Steig-Geschwindigkeit des stärksten Sprungs
  // durch Gravitation auf 0 abgebaut ist.
  const maxAirMs = Math.abs(tuning.sprintJumpVelocity) / tuning.gravity;
  const maxHoldTicks = Math.ceil(maxAirMs / (tuning.tickMs / 1000)) + 1;

  for (let holdTicks = 1; holdTicks <= maxHoldTicks; holdTicks++) {
    const path = predictPath(state, {
      ...(opts || {}),
      jump: true,
      holdJumpTicks: holdTicks,
      maxTicks: maxHoldTicks + 5,
    });
    if (pathHits(path, dx, dy, r)) return holdTicks;
  }
  return null;
}

/** Ticks bis der Bot die aktuelle Plattform in `facing`-Richtung verlässt
 *  (inkl. seiner halben Breite), oder `null`, wenn er auf keiner Plattform
 *  steht. Rechnet mit der TATSÄCHLICHEN Geschwindigkeit (`velocity.vx`) -
 *  steht der Bot still, wird als Annahme mit Basistempo gerechnet. */
export function ticksUntilEdge(state) {
  const tuning = state.tuning;
  const halfW = tuning.botWidth / 2;
  const dir = state.facing === "right" ? 1 : -1;
  const standingOn = state.platforms.find(
    (p) => p.kind !== "ceiling" && halfW > p.dx && -halfW < p.dx + p.width && p.dy > 0
  );
  if (!standingOn) return null;

  const edgeDx = dir === 1 ? standingOn.dx + standingOn.width - halfW : standingOn.dx + halfW;
  // `isSprinting` ist nur ein Boolean und ignoriert die Sprint-Rampe - die
  // echte Geschwindigkeit steht in `velocity.vx`.
  const speed = Math.abs(state.velocity.vx) || tuning.baseMoveSpeed;
  const distance = dir === 1 ? edgeDx : -edgeDx;
  if (distance <= 0) return 0;
  return Math.ceil(distance / (speed * (tuning.tickMs / 1000)));
}

/** dy der Fläche, auf der der Bot bei horizontalem Versatz `dx` LANDEN würde,
 *  oder `null`, wenn dort keine solche Fläche in Sicht ist. Berücksichtigt nur
 *  Flächen auf/unter Bot-Höhe (`dy >= 0`) - eine Plattform ÜBER dem Bot ist
 *  kein Landeziel. */
export function surfaceAt(state, dx) {
  let best = null;
  for (const p of state.platforms) {
    if (p.kind === "ceiling") continue;
    if (p.dy < 0) continue; // über dem Bot -> keine Landefläche
    if (dx < p.dx || dx > p.dx + p.width) continue;
    if (best === null || p.dy < best) best = p.dy;
  }
  return best;
}

/** Solide Fläche in `facing`-Richtung, deren Oberkante HÖHER liegt, als der Bot
 *  aus seinem aktuellen Tempo heraus springen kann - also ein echtes Hindernis.
 *  `{ distance, height }` (height = wie weit die Oberkante über den Füßen
 *  liegt) oder `null`, wenn nichts Unüberwindbares im Weg steht.
 *
 *  Wichtig: Terrain besteht aus DÜNNEN, waagerechten Platten (je eine Tile
 *  hoch) - eine Wand ist immer ein STAPEL davon, nie ein einzelnes Rechteck.
 *  Deshalb wird nicht Platte für Platte bewertet (jede einzelne wäre entweder
 *  niedrig genug zum Überspringen oder hoch genug zum Drunterdurchlaufen),
 *  sondern die Gesamthöhe des zusammenhängenden Stapels an der Fundstelle. */
export function wallAhead(state) {
  const tuning = state.tuning;
  const dir = state.facing === "right" ? 1 : -1;
  const halfW = tuning.botWidth / 2;
  const halfH = tuning.botHeight / 2;
  const speed = Math.abs(state.velocity.vx) || tuning.baseMoveSpeed;
  const jumpVy = jumpVelocityFor(speed, tuning);
  const maxRise = (jumpVy * jumpVy) / (2 * tuning.gravity);

  // 1) Nächste Platte in Laufrichtung, die den KÖRPER des Bots blockiert.
  let blocker = null;
  for (const p of state.platforms) {
    if (p.kind === "float") continue; // von der Seite durchspringbar
    if (p.dy >= halfH) continue; // auf/unter Fußhöhe -> überlaufbar
    if (p.dy + p.height <= -halfH) continue; // ganz über dem Bot -> drunter durch
    // Nur Platten, die noch VOR dem Bot liegen. Wichtig: nicht über ein
    // negatives `dist` aussortieren - steht der Bot direkt an der Wand
    // (Abstand < halbe Bot-Breite), wäre sie sonst plötzlich "weg" und er
    // würde erneut losrennen. Stattdessen auf 0 begrenzen.
    const behind = dir === 1 ? p.dx + p.width <= 0 : p.dx >= 0;
    if (behind) continue;
    const raw = dir === 1 ? p.dx - halfW : -(p.dx + p.width) - halfW;
    const dist = Math.max(0, raw);
    if (blocker === null || dist < blocker.distance) blocker = { distance: dist, p };
  }
  if (blocker === null) return null;

  // 2) Wie hoch reicht der solide Stapel an dieser Stelle? Höchste Oberkante
  //    aller Platten, die sich horizontal mit dem Hindernis überlappen.
  const left = blocker.p.dx;
  const right = blocker.p.dx + blocker.p.width;
  let topDy = blocker.p.dy;
  for (const p of state.platforms) {
    if (p.kind === "float") continue;
    if (p.dx + p.width <= left || p.dx >= right) continue;
    if (p.dy < topDy) topDy = p.dy;
  }

  const height = halfH - topDy;
  if (height <= maxRise) return null; // überspringbar -> kein Hindernis
  return { distance: blocker.distance, height };
}

/** Vorhergesagte Position/Aktivität eines Hazards `ticks` Bot-Ticks in der
 *  Zukunft, extrapoliert aus seiner aktuellen Geschwindigkeit (`vx`/`vy`).
 *  `active` wird unverändert vom aktuellen Tick übernommen (keine
 *  Zeitpunkt-Vorhersage für getaktete Hazards - siehe `.features/bot-toolkit`). */
export function predictHazard(state, hazard, ticks) {
  const dt = (state.tuning.tickMs / 1000) * ticks;
  return {
    dx: hazard.dx + hazard.vx * dt,
    dy: hazard.dy + hazard.vy * dt,
    active: hazard.active,
  };
}

/** Ob eine mit `predictPath` berechnete Bahn zu irgendeinem Zeitpunkt nah
 *  genug an der vorhergesagten Position eines (aktiven) Hazards vorbeikommt. */
export function pathIntersectsHazard(state, path, hazard, radius) {
  if (!hazard.active) return false;
  const r = radius !== undefined ? radius : state.tuning.botWidth;
  for (const point of path) {
    const predicted = predictHazard(state, hazard, point.ticks);
    const ddx = point.dx - predicted.dx;
    const ddy = point.dy - predicted.dy;
    if (ddx * ddx + ddy * ddy <= r * r) return true;
  }
  return false;
}

/** Passende Bewegungs-Action für einen horizontalen Versatz `dx`. */
export function moveToward(dx, sprint) {
  if (dx === 0) return "idle";
  const dir = dx > 0 ? "right" : "left";
  return sprint ? `sprint-${dir}` : dir;
}

/** Closure-Zähler zum Halten von "jump" über mehrere Bot-Ticks (Vorbild:
 *  einfache `jumpTicks`-Variable, siehe Beispiel-Strategien unten). Ruf
 *  `.tick(wantJump, targetHoldTicks)` jeden Tick auf; solange `true`
 *  zurückkommt, gib `"jump"` zurück. */
export function createJumpHold() {
  let remaining = 0;
  return {
    tick(wantJump, targetHoldTicks) {
      if (wantJump && remaining <= 0) {
        remaining = Math.max(1, targetHoldTicks || 1);
      }
      if (remaining > 0) {
        remaining--;
        return true;
      }
      return false;
    },
  };
}

/** Ob die Bahn `path` irgendwo näher als `radius` an (dx, dy) vorbeikommt -
 *  z.B. um zu prüfen, ob ein geplanter Sprung eine Münze oder einen
 *  `coinBlock` von unten trifft. Prüft nicht nur die Bahn-PUNKTE (die liegen
 *  nur an Tick-Grenzen, bei Sprinttempo ~10px auseinander), sondern auch die
 *  Strecken dazwischen - sonst würden knapp verfehlte Ziele übersehen. */
export function pathHits(path, dx, dy, radius) {
  const r2 = radius * radius;
  for (let i = 0; i < path.length; i++) {
    const p = path[i];
    const ddx = p.dx - dx;
    const ddy = p.dy - dy;
    if (ddx * ddx + ddy * ddy <= r2) return true;
    if (i === 0) continue;

    // Kürzester Abstand vom Zielpunkt zur Strecke path[i-1] -> path[i].
    const a = path[i - 1];
    const sx = p.dx - a.dx;
    const sy = p.dy - a.dy;
    const len2 = sx * sx + sy * sy;
    if (len2 === 0) continue;
    let t = ((dx - a.dx) * sx + (dy - a.dy) * sy) / len2;
    t = Math.max(0, Math.min(1, t));
    const cx = a.dx + t * sx - dx;
    const cy = a.dy + t * sy - dy;
    if (cx * cx + cy * cy <= r2) return true;
  }
  return false;
}

/**
 * Optionaler Navigator mit bewusst austauschbaren Strategie-Punkten. Er nimmt
 * dem Bot die fehleranfällige Flugbahn- und Landungsprüfung ab, wird aber nicht
 * automatisch verwendet. Über `choosePlan` wählt eine individuelle Strategie
 * aus sicheren Kandidaten; `recoverFromStuck` ersetzt bei Bedarf die
 * Standard-Befreiung. Für ganz eigene Logik bleiben alle Helfer direkt nutzbar.
 */
export function createNavigator(options) {
  const config = options || {};
  const jumpHolds = config.jumpHolds || [6, 8, 10, 12, 16, 20];
  const hazardLookahead = config.hazardLookahead || 170;
  const gapLookahead = config.gapLookahead || 150;
  const combinedLookahead = config.combinedLookahead || 190;
  const maxWaitTicks = config.maxWaitTicks || 30;
  const stuckAfterTicks = config.stuckAfterTicks || 45;
  let activePlan = null;
  let waitTicks = 0;
  let recoveryTicks = 0;
  let lastPosition = null;
  let unmovedTicks = 0;
  let lastDecision = { mode: "start", reason: "not-run", consideredPlans: 0 };

  function reset() {
    activePlan = null;
    waitTicks = 0;
    recoveryTicks = 0;
    lastPosition = null;
    unmovedTicks = 0;
  }

  function updateStuck(state) {
    if (lastPosition) {
      const moved = Math.hypot(
        state.position.x - lastPosition.x,
        state.position.y - lastPosition.y
      );
      unmovedTicks = moved < 1 ? unmovedTicks + 1 : 0;
    }
    lastPosition = { x: state.position.x, y: state.position.y };
    return unmovedTicks >= stuckAfterTicks;
  }

  function visibleProblems(state, direction) {
    const hazards = state.hazards.filter(
      (hazard) =>
        (hazard.active || hazard.warning) &&
        hazard.dx * direction > 0 &&
        Math.abs(hazard.dx) < hazardLookahead &&
        Math.abs(hazard.dy) < 72
    );
    const gapDistance = state.gapAhead.present ? state.gapAhead.distance : null;
    const gapNear =
      gapDistance !== null &&
      gapDistance >= 0 &&
      gapDistance < (hazards.length > 0 ? combinedLookahead : gapLookahead);
    return { hazards, gapNear, gapDistance };
  }

  function makeJumpPlans(state, direction, problems) {
    const plans = [];
    const sprintModes = problems.gapNear ? [true, false] : [false, true];
    const furthestHazard = problems.hazards.reduce(
      (distance, hazard) => Math.max(distance, Math.abs(hazard.dx)),
      0
    );
    const requiredDistance = Math.max(
      problems.gapNear ? problems.gapDistance + state.tuning.botWidth : 0,
      furthestHazard + state.tuning.botWidth
    );

    for (const sprint of sprintModes) {
      for (const holdJumpTicks of jumpHolds) {
        const path = predictPath(state, {
          dir: direction,
          sprint,
          jump: true,
          holdJumpTicks,
          maxTicks: 60,
        });
        const landing = path[path.length - 1];
        const avoidsHazards = problems.hazards.every((hazard) => {
          const dangerousHazard = hazard.active ? hazard : { ...hazard, active: true };
          return !pathIntersectsHazard(
            state,
            path,
            dangerousHazard,
            state.tuning.botWidth * 0.75
          );
        });
        const reachesSafety =
          landing && landing.landed && landing.dx * direction > requiredDistance;

        if (reachesSafety && avoidsHazards) {
          plans.push({
            kind: "jump",
            direction,
            sprint,
            holdJumpTicks,
            landing,
            path,
            reason:
              problems.gapNear && problems.hazards.length > 0
                ? "hazard-and-gap"
                : problems.gapNear
                  ? "gap"
                  : "hazard",
          });
        }
      }
    }
    return plans;
  }

  function chooseDefaultPlan(plans, problems) {
    if (plans.length === 0) return null;
    return [...plans].sort((a, b) => {
      if (!problems.gapNear && a.sprint !== b.sprint) return a.sprint ? 1 : -1;
      if (problems.gapNear && a.sprint !== b.sprint) return a.sprint ? -1 : 1;
      return a.holdJumpTicks - b.holdJumpTicks;
    })[0];
  }

  function movementAction(direction, sprint) {
    return moveToward(direction, sprint);
  }

  function beginRecovery(state, direction, reason) {
    recoveryTicks = config.recoveryTicks || 12;
    activePlan = null;
    waitTicks = 0;
    const context = { state, direction, reason };
    const custom = config.recoverFromStuck && config.recoverFromStuck(context);
    lastDecision = { mode: "recovering", reason, consideredPlans: 0 };
    return Array.isArray(custom) ? custom : [movementAction(-direction, true)];
  }

  function decide(state) {
    const direction = state.goalDirection.dx >= 0 ? 1 : -1;
    if (state.justRespawned) reset();

    if (updateStuck(state) && recoveryTicks === 0) {
      return beginRecovery(state, direction, "stuck");
    }

    if (recoveryTicks > 0) {
      recoveryTicks--;
      lastDecision = { mode: "recovering", reason: "creating-run-up", consideredPlans: 0 };
      return [movementAction(-direction, true)];
    }

    if (activePlan) {
      const actions = [movementAction(activePlan.direction, activePlan.sprint)];
      if (activePlan.remainingJumpTicks > 0) {
        actions.unshift("jump");
        activePlan.remainingJumpTicks--;
      }
      if (state.onGround && activePlan.started && activePlan.remainingJumpTicks === 0) {
        activePlan = null;
      } else {
        activePlan.started = true;
      }
      lastDecision = {
        mode: "executing",
        reason: activePlan ? activePlan.reason : "landed",
        consideredPlans: 1,
      };
      return actions;
    }

    const problems = visibleProblems(state, direction);
    if (state.onGround && (problems.gapNear || problems.hazards.length > 0)) {
      const plans = makeJumpPlans(state, direction, problems);
      const context = { state, direction, problems };
      const selected =
        (config.choosePlan && config.choosePlan(context, plans)) ||
        chooseDefaultPlan(plans, problems);

      if (selected) {
        activePlan = { ...selected, remainingJumpTicks: selected.holdJumpTicks, started: false };
        waitTicks = 0;
        lastDecision = {
          mode: "executing",
          reason: selected.reason,
          consideredPlans: plans.length,
        };
        activePlan.remainingJumpTicks--;
        return ["jump", movementAction(direction, selected.sprint)];
      }

      const activeLoderix = problems.hazards.some(
        (hazard) => hazard.kind === "loderix" && (hazard.active || hazard.warning)
      );
      if (activeLoderix && waitTicks < maxWaitTicks) {
        waitTicks++;
        lastDecision = {
          mode: "waiting",
          reason: "active-loderix",
          consideredPlans: plans.length,
        };
        return ["idle"];
      }
      return beginRecovery(state, direction, "no-safe-plan");
    }

    waitTicks = 0;
    lastDecision = { mode: "moving", reason: "toward-goal", consideredPlans: 0 };
    return [movementAction(direction, config.sprint !== false)];
  }

  return {
    decide,
    reset,
    getLastDecision() {
      return { ...lastDecision };
    },
  };
}

export default {
  apiVersion: 1,
  // Name des Bots und Name des Besuchers - werden ganz am Anfang des
  // Gesprächs erfragt und hier eingetragen (siehe AGENTS.md, Abschnitt
  // "Deine allererste Antwort"). Bitte NICHT leer lassen.
  name: "",
  author: "",
  decide(state) {
    return [];
  },
};
