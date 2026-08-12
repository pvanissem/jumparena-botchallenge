import type { TraceEvent, TraceFinding, TraceTickSample, TraceTuning } from "./types";

const HORIZONTAL_ACTIONS = new Set(["left", "right", "sprint-left", "sprint-right"]);

function actions(sample: TraceTickSample): readonly string[] {
  return sample.decision?.kind === "ok" ? sample.decision.actions : [];
}

function finding(
  kind: TraceFinding["kind"],
  message: string,
  ticks: number[],
  events: TraceEvent[] = []
): TraceFinding {
  return {
    kind,
    derived: true,
    severity: kind === "missed-gap" || kind === "hazard-not-avoided" ? "critical" : "warning",
    message,
    ticks,
    eventIds: events.map((event) => event.id),
  };
}

export function analyzeBotRun(
  samples: readonly TraceTickSample[],
  events: readonly TraceEvent[],
  tuning: TraceTuning
): TraceFinding[] {
  const findings: TraceFinding[] = [];
  const stuckTicks = Math.ceil(3_000 / tuning.tickMs);
  for (let start = 0; start + stuckTicks <= samples.length; start++) {
    const window = samples.slice(start, start + stuckTicks);
    const xs = window.map((sample) => sample.position.x);
    const horizontal = window.filter((sample) =>
      actions(sample).some((a) => HORIZONTAL_ACTIONS.has(a))
    );
    const wantsProgress = window.filter((sample) => Math.abs(sample.goalDirection.dx) > 64);
    const waitsAtActiveLoderix = window.filter((sample) => {
      const direction = Math.sign(sample.goalDirection.dx);
      return sample.hazards.some(
        (hazard) =>
          hazard.kind === "loderix" &&
          hazard.active &&
          Math.sign(hazard.dx) === direction &&
          Math.abs(hazard.dx) < 100
      );
    });
    const movementRequested = horizontal.length / window.length >= 0.7;
    const unexplainedIdle =
      wantsProgress.length / window.length >= 0.7 &&
      waitsAtActiveLoderix.length / window.length < 0.5;
    if (Math.max(...xs) - Math.min(...xs) < 16 && (movementRequested || unexplainedIdle)) {
      findings.push(
        finding(
          "stuck",
          "Der Bot fordert Bewegung an, kommt aber kaum voran.",
          window.map((s) => s.tick)
        )
      );
      break;
    }
  }

  const oscillationTicks = Math.ceil(2_000 / tuning.tickMs);
  for (let start = 0; start + oscillationTicks <= samples.length; start++) {
    const window = samples.slice(start, start + oscillationTicks);
    const dirs = window
      .map((sample) => actions(sample).find((a) => HORIZONTAL_ACTIONS.has(a)))
      .filter((a): a is string => a !== undefined)
      .map((action) => (action.endsWith("left") ? "left" : "right"));
    let changes = 0;
    for (let i = 1; i < dirs.length; i++) if (dirs[i] !== dirs[i - 1]) changes++;
    const progress = Math.abs(window[window.length - 1].position.x - window[0].position.x);
    if (changes >= 6 && progress < 32) {
      findings.push(
        finding(
          "oscillating",
          "Der Bot wechselt häufig die Richtung, ohne voranzukommen.",
          window.map((s) => s.tick)
        )
      );
      break;
    }
  }

  const death = [...events]
    .reverse()
    .find((event) => event.kind === "pit-fall" || event.kind === "hazard-hit");
  if (!death) return findings;
  const beforeDeath = samples.filter((sample) => sample.tick <= death.tick).slice(-12);

  if (death.kind === "pit-fall") {
    const gapTicks = beforeDeath.filter((sample) => sample.gapAhead.present);
    const jumped = gapTicks.some((sample) => actions(sample).includes("jump") && sample.onGround);
    if (gapTicks.length >= 3 && !jumped) {
      findings.push(
        finding(
          "missed-gap",
          "Die sichtbare Lücke wurde nicht rechtzeitig übersprungen.",
          gapTicks.map((s) => s.tick),
          [death]
        )
      );
    }
  }

  for (let i = 0; i < beforeDeath.length - 1; i++) {
    const current = beforeDeath[i];
    const next = beforeDeath[i + 1];
    if (
      actions(current).includes("jump") &&
      !actions(next).includes("jump") &&
      current.velocity.vy < 0 &&
      next.velocity.vy >= 0 &&
      tuning.tickMs < tuning.minJumpHoldMs
    ) {
      findings.push(
        finding(
          "jump-cut-short",
          "Der Sprung wurde vor der Mindesthaltedauer abgebrochen.",
          [current.tick, next.tick],
          [death]
        )
      );
      break;
    }
  }

  if (death.kind === "hazard-hit") {
    const hazardKind = death.details?.hazardKind;
    const visible = beforeDeath.find((sample) =>
      sample.hazards.some(
        (hazard) => hazard.kind === hazardKind && (hazard.active || hazard.warning)
      )
    );
    if (visible) {
      findings.push(
        finding(
          "hazard-not-avoided",
          "Eine sichtbare aktive Gefahr wurde nicht vermieden.",
          [visible.tick, death.tick],
          [death]
        )
      );
    }
  }

  return findings;
}
