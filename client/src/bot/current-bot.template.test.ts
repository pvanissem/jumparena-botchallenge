/**
 * Regressionsschutz: das ausgelieferte Standard-Bot-Template muss den
 * statischen Guard bestehen. Der Guard (`checkStaticGuard`, siehe
 * `@arena/bot-contract`) prüft naiv per Regex über den GESAMTEN Quelltext -
 * auch über Kommentare hinweg. Ein Dokumentationstext, der z.B. das Wort
 * "import" erwähnt, würde den eigenen Default-Bot sonst sofort blockieren
 * (siehe `.features/dev-station-mode/` - real aufgetretener Bug).
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkStaticGuard } from "@arena/bot-contract";
import { describe, expect, it } from "vitest";
import defaultBot, { createNavigator } from "./current-bot.template.js";

const here = dirname(fileURLToPath(import.meta.url));
const templateSource = readFileSync(join(here, "current-bot.template.js"), "utf-8");

describe("current-bot.template.js", () => {
  it("passes the static guard (no forbidden keyword, not even in comments)", () => {
    const result = checkStaticGuard(templateSource);
    expect(result.allowed).toBe(true);
  });

  const tuning = {
    gravity: 900,
    tileSize: 16,
    tickMs: 33,
    baseMoveSpeed: 200,
    sprintMoveSpeed: 320,
    sprintRampMs: 450,
    baseJumpVelocity: -560,
    sprintJumpVelocity: -650,
    minJumpHoldMs: 180,
    botWidth: 24,
    botHeight: 32,
  };

  function state(overrides = {}) {
    return {
      tick: 1,
      position: { x: 500, y: 480 },
      facing: "right",
      onGround: true,
      isAlive: true,
      velocity: { vx: 0, vy: 0 },
      isSprinting: false,
      sprintRampProgress: 0,
      nearbyTiles: [],
      platforms: [{ dx: -100, dy: 16, width: 500, height: 16, kind: "ground" }],
      tuning,
      coins: [],
      hazards: [],
      utilities: [],
      nearestCoin: null,
      nearestHazard: null,
      nearestUtility: null,
      goalDirection: { dx: 1000, dy: 0 },
      gapAhead: { present: false, distance: null },
      worldBounds: { width: 3000, height: 700 },
      justRespawned: false,
      tookDamage: false,
      coinsCollected: 0,
      livesRemaining: 3,
      timeElapsedMs: 0,
      ...overrides,
    };
  }

  it("aktiviert im leeren Besucher-Bot noch keine fertige Strategie", () => {
    expect(defaultBot.decide(state())).toEqual([]);
  });

  it("liefert als opt-in Baustein eine brauchbare Bewegung zum Ziel", () => {
    expect(createNavigator().decide(state())).toEqual(["sprint-right"]);
  });

  it("plant Gefahr und direkt folgende Lücke als gemeinsamen Sprintsprung", () => {
    const result = createNavigator().decide(
      state({
        sprintRampProgress: 1,
        gapAhead: { present: true, distance: 145 },
        platforms: [
          { dx: -84, dy: 19, width: 224, height: 16, kind: "ground" },
          { dx: 268, dy: 19, width: 256, height: 16, kind: "ground" },
        ],
        hazards: [
          {
            dx: 44,
            dy: 11,
            kind: "stachlinger",
            active: true,
            warning: false,
            stompable: false,
            vx: 0,
            vy: 0,
          },
        ],
      })
    );

    expect(result).toEqual(["jump", "sprint-right"]);
  });

  it("bevorzugt bei einer einzelnen Gefahr einen kontrollierten Sprung ohne Sprint", () => {
    const result = createNavigator().decide(
      state({
        hazards: [
          {
            dx: 48,
            dy: 4,
            kind: "schnetzler",
            active: true,
            warning: false,
            stompable: false,
            vx: 0,
            vy: 0,
          },
        ],
      })
    );

    expect(result).toEqual(["jump", "right"]);
  });

  it("wartet nicht endlos vor einem aktiven Loderix", () => {
    const navigator = createNavigator({ maxWaitTicks: 2, stuckAfterTicks: 999 });
    const blocked = state({
      platforms: [{ dx: -100, dy: 16, width: 180, height: 16, kind: "ground" }],
      hazards: [
        {
          dx: 40,
          dy: 0,
          kind: "loderix",
          active: true,
          warning: false,
          stompable: false,
          vx: 0,
          vy: 0,
        },
      ],
    });

    expect(navigator.decide(blocked)).toEqual(["idle"]);
    expect(navigator.decide(blocked)).toEqual(["idle"]);
    expect(navigator.decide(blocked)).toEqual(["sprint-left"]);
  });

  it("lässt die Auswahl eines sicheren Plans gezielt überschreiben", () => {
    let observedPlans: Array<{ sprint: boolean }> = [];
    const navigator = createNavigator({
      choosePlan(_context: unknown, plans: Array<{ sprint: boolean }>) {
        observedPlans = plans;
        return plans.find((plan) => plan.sprint) || null;
      },
    });
    const result = navigator.decide(
      state({
        hazards: [
          {
            dx: 48,
            dy: 4,
            kind: "schnetzler",
            active: true,
            warning: false,
            stompable: false,
            vx: 0,
            vy: 0,
          },
        ],
      })
    );

    expect(observedPlans.length).toBeGreaterThan(1);
    expect(result).toEqual(["jump", "sprint-right"]);
  });
});
