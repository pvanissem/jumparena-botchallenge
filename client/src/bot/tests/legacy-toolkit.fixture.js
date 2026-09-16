/**
 * Historische Test-Fixture: kein Besucher-Template, kein Framework-Physiknachweis.
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
 *   nearbyTiles        - Sichtfeld-Raster (11x9, Bot bei [4][5]) um den Bot
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
 *   goalDirection      - { dx, dy } Richtung zum Ziel (in Pixeln).
 *                        ACHTUNG: dy kann POSITIV sein - das Ziel liegt dann
 *                        UNTER dem Bot. Ein Sprung nach oben über eine Lücke
 *                        ist dann sinnlos; besser kontrolliert fallen lassen.
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
 *   hazardBlocksPath(state, path, hazard, opts) -> blockiert ein Hazard meine
 *                                       Bahn wirklich? (kennt Stomp und einen
 *                                       realistischen Kollisionsradius - das
 *                                       ist die Funktion fuer Sprungplanung)
 *   boingoBounceAction(state, opts)   -> Actions, um ein Trampolin auszuloesen
 *   moveToward(dx, sprint)            -> passende Action ("left"/"sprint-right"/...)
 *   createJumpHold()                  -> Zaehler-Objekt zum Halten von "jump" über Ticks
 *   pathHits(path, dx, dy, radius)    -> kommt die Bahn nah an (dx,dy) vorbei?
 *
 * Der Navigator (`createNavigator`) bietet zusaetzlich `hasActivePlan()` und
 * `getActivePlanCourse()` - noetig, damit eigene Reflexe einen laufenden,
 * bereits geprueften Sprung nicht versehentlich abbrechen.
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

// biome-ignore lint/correctness/noUnusedVariables: Historische Fixture unveraendert bewahren.
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
  const distDuringRamp = v0 * remainingRampSec + 0.5 * slope * remainingRampSec * remainingRampSec;
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
    for (const tLocal of quadraticCrossingTimes(vy0, gravity, p.dy + p.height + halfH - vOffset)) {
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
 *  genug an der vorhergesagten Position eines (aktiven) Hazards vorbeikommt.
 *
 *  ACHTUNG - reine Abstandsprüfung ohne Stomp-Wissen: ein `ninjafrog`
 *  (`stompable: true`) gilt hier auch dann als Treffer, wenn die Bahn ihn von
 *  OBEN im Fallen berührt (was in Wahrheit ungefährlich ist und ihn besiegt).
 *  Für Sprungplanung deshalb besser `hazardBlocksPath` verwenden. */
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

/**
 * Wie `pathIntersectsHazard`, aber mit korrektem Stomp-Wissen: prüft, ob ein
 * Hazard eine geplante Bahn WIRKLICH gefährlich blockiert.
 *
 * Unterschied zur reinen Abstandsprüfung - beides ist für sichere Sprünge
 * nötig und wurde erfahrungsgemäß gern falsch gemacht:
 *
 *  - **Stomp zählt nicht als Treffer.** Berührt die Bahn einen `stompable`
 *    Gegner von OBEN, während der Bot FÄLLT (`vy > 0`), wird der Gegner
 *    besiegt - kein Leben-Verlust. Nur seitlicher Kontakt oder Kontakt im
 *    Steigflug ist tödlich. Ein pauschales "stompable ignorieren" wäre
 *    deshalb FALSCH (der Bot liefe dann seitlich hinein).
 *  - **Großzügiger Standard-Radius.** Die reale Kollision entsteht zwischen
 *    zwei Boxen (Bot + Hazard), nicht zwischen zwei Punkten. Ein zu kleiner
 *    Radius lässt knappe, in Wahrheit tödliche Vorbeiflüge als "sicher"
 *    durchgehen. Default: `botWidth * 1.5`.
 *  - **`warning` zählt wie aktiv.** Ein `spikehead` in der Vorwarnphase
 *    (`active: false`, `warning: true`) fällt gleich - er ist zu meiden.
 *
 * `opts`: `{ radius, allowStomp }` (`allowStomp` Default `true`).
 */
export function hazardBlocksPath(state, path, hazard, opts) {
  const o = opts || {};
  if (!hazard.active && !hazard.warning) return false;
  const r = o.radius !== undefined ? o.radius : state.tuning.botWidth * 1.5;
  const allowStomp = o.allowStomp !== false;

  for (const point of path) {
    const predicted = predictHazard(state, hazard, point.ticks);
    const ddx = point.dx - predicted.dx;
    const ddy = point.dy - predicted.dy;
    if (ddx * ddx + ddy * ddy > r * r) continue;

    // Sicherer Stomp: Bot fällt (vy > 0) und ist oberhalb des Hazards.
    const stomping = allowStomp && hazard.stompable && point.vy > 0 && point.dy < predicted.dy;
    if (!stomping) return true;
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

/**
 * Actions, um ein Trampolin (`boingo`) korrekt auszulösen - oder `null`, wenn
 * gerade keines relevant ist.
 *
 * Hintergrund (wird sonst leicht übersehen): Der Katapult-Boost greift NUR,
 * wenn der Bot das Trampolin im FALLEN berührt (`vy > 0`). Läuft er am Boden
 * einfach darüber (`vy === 0`), passiert NICHTS - an Stellen, die nur per
 * Boingo erreichbar sind, kommt er dann nie weiter. Deshalb kurz davor einen
 * kleinen Hüpfer einlegen, damit er auf dem letzten Stück fällt.
 *
 * `opts`: `{ sprint }` (Default `true`).
 */
export function boingoBounceAction(state, opts) {
  const sprint = !opts || opts.sprint !== false;
  const tuning = state.tuning;
  const boingo = state.utilities.find((utility) => utility.kind === "boingo");
  if (!boingo) return null;

  // Nur relevant, wenn das Trampolin ungefähr auf Bot-Höhe liegt.
  if (Math.abs(boingo.dy) > tuning.botHeight * 2.5) return null;

  const direction = boingo.dx >= 0 ? 1 : -1;
  const distance = Math.abs(boingo.dx);

  // Schon in der Luft und fallend: einfach draufhalten, der Boost kommt
  // beim Kontakt automatisch.
  if (!state.onGround && state.velocity.vy > 0 && distance < tuning.botWidth * 4) {
    return [moveToward(direction, sprint)];
  }

  // Am Boden kurz davor: hüpfen, damit der Kontakt im Fallen passiert.
  if (state.onGround && distance > tuning.botWidth * 0.5 && distance < tuning.botWidth * 3) {
    return ["jump", moveToward(direction, sprint)];
  }

  return null;
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
  // Kollisionsradius für die Sprungprüfung. Bewusst großzügig: die reale
  // Kollision entsteht zwischen zwei Boxen (Bot + Hazard), nicht zwischen
  // zwei Punkten - ein zu kleiner Wert lässt knappe, in Wahrheit tödliche
  // Vorbeiflüge als "sicher" durchgehen. Kleiner = risikofreudiger.
  const hazardRadius = config.hazardRadius;
  // Vertikale Reichweite, ab der eine Gefahr überhaupt als "Problem" für die
  // Sprungplanung gilt. Bewusst großzügiger als nur "auf Bot-Höhe": ein
  // `kugelblitz` (Pendel) oder `spikehead` (fällt von oben) kann deutlich
  // über/unter dem Bot hängen und trotzdem in die geplante Flugbahn hinein
  // schwingen/fallen - ein zu enger Wert lässt solche Gefahren komplett
  // unbeachtet (siehe Trace: Kugelblitz bei dy=-130 wurde nie als Problem
  // erkannt und traf den Bot Ticks später, als er heruntergeschwungen war).
  const hazardVerticalLookahead = config.hazardVerticalLookahead || 160;
  let activePlan = null;
  let waitTicks = 0;
  let recoveryTicks = 0;
  let recoveryReason = null;
  let fallCorrectionTicks = 0;
  let fallCorrectionDir = null;
  let lastPosition = null;
  let unmovedTicks = 0;
  let lastDecision = { mode: "start", reason: "not-run", consideredPlans: 0 };

  function reset() {
    activePlan = null;
    waitTicks = 0;
    recoveryTicks = 0;
    recoveryReason = null;
    fallCorrectionTicks = 0;
    fallCorrectionDir = null;
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
        Math.abs(hazard.dy) < hazardVerticalLookahead
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

    // Das ZIEL selbst zählt nie als sichtbare Plattform (siehe AGENTS.md,
    // "Verhalten kurz vorm Ziel") - liegt direkt davor eine Lücke, findet die
    // reine Landungsprüfung unten deshalb NIE eine bestätigte Landung UND der
    // Sturz sieht (mangels sichtbarem Boden dahinter) wie ein Todes-Abgrund
    // aus. Ohne diese Sonderbehandlung lehnt die Planung jeden Sprung über
    // eine letzte Lücke vorm Ziel kategorisch ab -> der Bot zieht sich vor
    // dem Ziel endlos zurück, statt hineinzulaufen. Deshalb gilt das Ziel
    // hier explizit als gültiges, sicheres Sprungziel, wenn es ungefähr auf
    // Höhe der Landung liegt und in Sprintrichtung vor uns ist.
    const goal = state.goalDirection;
    const goalIsJumpTarget =
      !!goal && goal.dx * direction > 0 && Math.abs(goal.dy) < state.tuning.botHeight * 4;

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
          // `hazardBlocksPath` statt reiner Abstandsprüfung: kennt Stomp
          // (Kontakt von oben im Fallen besiegt einen `ninjafrog` gefahrlos)
          // und nutzt einen realistisch großzügigen Kollisionsradius.
          return !hazardBlocksPath(state, path, dangerousHazard, { radius: hazardRadius });
        });
        const reachesKnownSafety =
          landing &&
          landing.dx * direction > requiredDistance &&
          // Bestätigt gelandet ist ideal - aber auch OHNE bestätigte Landung
          // (Sichtfeld begrenzt, Fläche jenseits der Lücke einfach noch nicht
          // sichtbar) ist der Sprung akzeptabel, SOLANGE er nicht unplausibel
          // tief unter die Levelgrenzen fällt (echtes Warnzeichen für einen
          // Todes-Abgrund statt nur "noch nicht sichtbar").
          (landing.landed ||
            state.position.y + landing.dy <
              (state.worldBounds ? state.worldBounds.height : Infinity) + 200);
        // Alternative: Die Flugbahn kommt nah genug am ZIEL selbst vorbei -
        // dann ist die fehlende Plattform-Bestätigung irrelevant, das Ziel
        // hat garantiert Boden.
        const reachesGoal =
          goalIsJumpTarget && pathHits(path, goal.dx, goal.dy, state.tuning.botWidth * 2);
        const reachesSafety = reachesKnownSafety || reachesGoal;

        if (reachesSafety && avoidsHazards) {
          plans.push({
            kind: "jump",
            direction,
            sprint,
            holdJumpTicks,
            landing,
            path,
            reason: reachesGoal
              ? "goal"
              : problems.gapNear && problems.hazards.length > 0
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
    recoveryReason = reason;
    lastDecision = { mode: "recovering", reason, consideredPlans: 0 };
    return recoveryStep(state, direction, reason);
  }

  /**
   * EIN Rückzugs-Tick. Wird bei JEDEM Tick des Rückzugs neu aufgerufen (nicht
   * nur beim ersten): Ein mehrere Ticks langes Manöver blind durchzuziehen ist
   * gefährlich, weil sich die Lage während des Rückzugs ändern kann (ein
   * getaktetes Feuer geht an, eine Säge kommt herangefahren). `recoverFromStuck`
   * bekommt so jeden Tick frischen `state` und kann jedes Mal neu entscheiden.
   */
  function recoveryStep(state, direction, reason) {
    const context = { state, direction, reason };
    const custom = config.recoverFromStuck && config.recoverFromStuck(context);
    return Array.isArray(custom) ? custom : defaultRecoveryStep(state, direction);
  }

  /**
   * Standard-Rueckzug MIT Sicherheitspruefung: Vor dem Zurueckweichen wird
   * geprueft, ob dort ueberhaupt Boden ist und keine Gefahr lauert.
   *
   * Ohne diese Pruefung laeuft ein Bot beim Zurueckweichen in genau die
   * Abgruende und Gefahren, denen er eigentlich ausweichen wollte - der
   * haeufigste Grund fuer "der Bot rennt grundlos rueckwaerts in den Tod".
   * Geprueft wird nur die RUECKZUGS-Seite; die Gefahr, vor der er gerade
   * zurueckweicht, liegt ja per Definition in der anderen Richtung.
   */
  function defaultRecoveryStep(state, direction) {
    const tuning = state.tuning;
    const retreatDir = -direction;

    const ground = surfaceAt(state, retreatDir * tuning.botWidth * 1.5);
    const hasGroundBehind = ground !== null && ground < tuning.botHeight * 3;

    const dangerBehind = state.hazards.some(
      (hazard) =>
        (hazard.active || hazard.warning) &&
        hazard.dx * retreatDir > 0 &&
        Math.abs(hazard.dx) < tuning.botWidth * 3 &&
        Math.abs(hazard.dy) < tuning.botHeight * 2
    );

    // Lieber kurz stehen bleiben als in Abgrund/Gefahr zurueckweichen.
    if (!hasGroundBehind || dangerBehind) return ["idle"];
    return [movementAction(retreatDir, true)];
  }

  /**
   * Sturz-Sicherung: prueft WAEHREND des Falls, ob die aktuelle Bahn noch
   * sicher landet - und steuert sonst noch in der Luft gegen.
   *
   * Laeuft bewusst INNERHALB des Navigators, weil nur hier der laufende Plan
   * bekannt ist: Als eigener Reflex ausserhalb wuerde diese Pruefung entweder
   * den gerade gestarteten Sprung abwuergen (Gefahr ist beim Absprung immer
   * nah -> Endlos-Huepfen) oder mit einer aus `velocity.vx` geratenen
   * Richtung gegen den eigenen Plan arbeiten (-> Wackeln).
   */
  function fallSafety(state) {
    if (config.fallSafety === false) return null;
    if (state.velocity.vy <= 0) return null; // steigt noch - kein Fehlurteil zu frueh

    // Einmal getroffene Korrektur einige Ticks konsequent durchziehen.
    if (fallCorrectionTicks > 0) {
      fallCorrectionTicks--;
      return fallCorrectionDir === 0 ? ["idle"] : [movementAction(fallCorrectionDir, true)];
    }

    const sprint = activePlan
      ? activePlan.sprint
      : Math.abs(state.velocity.vx) > state.tuning.baseMoveSpeed + 1;
    const currentDir = activePlan
      ? activePlan.direction
      : state.velocity.vx > 0
        ? 1
        : state.velocity.vx < 0
          ? -1
          : state.facing === "right"
            ? 1
            : -1;

    const landsSafely = (dir) => {
      const path = predictPath(state, { dir, sprint, maxTicks: 45 });
      const last = path[path.length - 1];
      if (!last) return false;
      const hazardInWay = state.hazards.some((hazard) =>
        hazardBlocksPath(state, path, hazard, { radius: hazardRadius })
      );
      if (hazardInWay) return false;
      if (last.landed) return true;
      // Keine Gefahr im Weg, aber auch (noch) keine bestätigte Landung auf
      // einer sichtbaren Plattform: Das SICHTFELD ist begrenzt - die
      // Landefläche liegt meistens einfach noch nicht im Blickfeld, nicht
      // weil dort kein Boden wäre (siehe AGENTS.md: "gapAhead.distance ist
      // nur die Entfernung zur nahen Kante... Sichtfeld ist begrenzt").
      // Ohne bekannte Gefahr also KEIN Grund zur Umkehr - nur bei einem
      // unplausibel tiefen Sturz (deutlich unter die Levelgrenzen) gilt das
      // als echtes Warnsignal für einen tatsächlichen Todes-Abgrund.
      const projectedY = state.position.y + last.dy;
      const worldHeight = state.worldBounds ? state.worldBounds.height : Infinity;
      return projectedY < worldHeight + 200;
    };

    if (landsSafely(currentDir)) return null; // alles gut - nicht eingreifen

    const engage = (dir) => {
      activePlan = null; // ueberholter Plan - nach der Landung neu planen
      fallCorrectionDir = dir;
      fallCorrectionTicks = 8;
      lastDecision = { mode: "falling", reason: "course-correction", consideredPlans: 0 };
      return dir === 0 ? ["idle"] : [movementAction(dir, sprint)];
    };

    if (landsSafely(-currentDir)) return engage(-currentDir);
    if (landsSafely(0)) return engage(0);
    return null; // nichts rettet die Lage - nicht verschlimmbessern
  }

  function decide(state) {
    const direction = state.goalDirection.dx >= 0 ? 1 : -1;
    if (state.justRespawned) reset();

    if (!state.onGround) {
      const correction = fallSafety(state);
      if (correction) return correction;

      // WICHTIG: Waehrend des Flugs darf die (nur fuer den Boden gedachte)
      // Rueckzugs-/Stuck-Logik NICHT weiterlaufen. Sonst ueberschreibt sie
      // mitten im Sprung ploetzlich die Flugrichtung (Bot dreht in der Luft
      // um) - das sah aus wie ein abgebrochener Sprung, war aber ein Konflikt
      // zwischen einem laufenden Rueckzugs-Timer und dem gerade gestarteten
      // Sprung. Deshalb in der Luft einfach den bestehenden Plan bzw. die
      // zuletzt gewaehlte Richtung fortsetzen.
      recoveryTicks = 0;
      if (activePlan) {
        const actions = [movementAction(activePlan.direction, activePlan.sprint)];
        if (activePlan.remainingJumpTicks > 0) {
          actions.unshift("jump");
          activePlan.remainingJumpTicks--;
        }
        activePlan.started = true;
        lastDecision = { mode: "executing", reason: activePlan.reason, consideredPlans: 1 };
        return actions;
      }
      lastDecision = { mode: "flying", reason: "airborne", consideredPlans: 0 };
      return [movementAction(direction, config.sprint !== false)];
    }

    fallCorrectionTicks = 0;
    fallCorrectionDir = null;

    // Bewusstes Warten ist KEIN Steckenbleiben: Wartet der Bot absichtlich
    // (z.B. bis ein getakteter `loderix` ausgeht), steht er zwangsläufig
    // still - die reine "Position ändert sich nicht"-Erkennung würde das
    // sonst als Problem werten und ein sinnvolles Warten abbrechen.
    const isWaiting = waitTicks > 0;
    const isStuck = updateStuck(state);
    if (isStuck && recoveryTicks === 0 && !isWaiting) {
      return beginRecovery(state, direction, "stuck");
    }

    if (recoveryTicks > 0) {
      recoveryTicks--;
      lastDecision = { mode: "recovering", reason: "creating-run-up", consideredPlans: 0 };
      return recoveryStep(state, direction, recoveryReason || "stuck");
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

    // Liegt das Ziel schon VOR jeder Lücke/Gefahr auf festem Boden (also
    // schlicht zu Fuß erreichbar)? Dann nicht erst über eine weiter entfernte
    // Lücke/Gefahr nachdenken, die für's Erreichen des Ziels gar nicht relevant
    // ist. Ohne diese Prüfung hält der Navigator jede sichtbare Lücke
    // pauschal für ein Hindernis, obwohl das Ziel selbst laengst diesseits
    // davon liegt - und zieht sich grundlos zurück, statt einfach reinzulaufen.
    const goal = state.goalDirection;
    if (
      state.onGround &&
      goal &&
      goal.dx * direction > 0 &&
      Math.abs(goal.dy) < state.tuning.botHeight * 4
    ) {
      const goalDistance = Math.abs(goal.dx);
      const gapBeforeGoal = state.gapAhead.present && state.gapAhead.distance < goalDistance;
      const hazardBeforeGoal = state.hazards.some(
        (hazard) =>
          (hazard.active || hazard.warning) &&
          hazard.dx * direction > 0 &&
          Math.abs(hazard.dx) < goalDistance
      );
      if (!gapBeforeGoal && !hazardBeforeGoal) {
        waitTicks = 0;
        lastDecision = { mode: "moving", reason: "goal-on-foot", consideredPlans: 0 };
        return [movementAction(direction, config.sprint !== false)];
      }
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
    /**
     * Verfolgt der Navigator gerade einen laufenden Sprungplan?
     *
     * Wichtig für eigene Sicherheitsnetze VOR `navigator.decide(state)`:
     * Direkt beim Absprung ist die zu überspringende Gefahr naturgemäß ganz
     * nah - eine eigene "Gefahr ist nah!"-Regel würde den gerade erst
     * gestarteten, bereits geprüften Sprung sofort wieder abbrechen (der Bot
     * hüpft dann endlos auf der Stelle). Eigene Notfall-Reflexe deshalb nur
     * anwenden, wenn hier `false` zurückkommt.
     */
    hasActivePlan() {
      return activePlan !== null;
    },
    /**
     * Richtung/Tempo des laufenden Plans (`{ direction, sprint }`) oder `null`.
     *
     * Nützlich für Korrekturen im Flug: Rechne mit DIESEN Werten weiter,
     * statt die Richtung aus `velocity.vx` zu raten - im Sprung schwankt das
     * Tempo kurzzeitig, wodurch eine geratene Richtung dem eigenen Plan
     * widerspricht und der Bot zwischen zwei Entscheidungen hin- und herwackelt.
     */
    getActivePlanCourse() {
      return activePlan ? { direction: activePlan.direction, sprint: activePlan.sprint } : null;
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
