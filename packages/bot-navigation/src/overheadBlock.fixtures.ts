import type { BotState } from "@arena/bot-contract";
import { fixture, platform } from "./fixtures";

function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

// 2026-09-16T06-16-19-868Z tick 50 and 2026-09-16T06-14-29-317Z tick 253.
// Immutable minimal observations from the two recorded stalls. Trace positions
// are rounded, body bounds are not. Missing tuning/world bounds come from the
// current arena; these fixtures are not lossless recordings of Phaser states.
function recordedState(second: boolean): BotState {
  const state = fixture();
  const x = second ? 901.35 : 471.07;
  state.position = { x, y: 480.8 };
  state.tick = second ? 253 : 50;
  state.timeElapsedMs = second ? 5383 : 1653;
  state.velocity = { vx: second ? 200 : 208.93, vy: 0 };
  state.isSprinting = !second;
  state.sprintRampProgress = second ? 0 : 0.07;
  state.tuning.botWidth = 28.8;
  state.tuning.botHeight = 38.4;
  state.worldBounds = { width: 7952, height: 540 };
  state.goalDirection = { dx: 7792 - x, dy: 3.2 };
  state.navigation = {
    ...state.navigation!,
    epoch: second ? 2 : 1,
    frame: second ? 1004 : 202,
    observedAtMs: second ? 8389.946666666667 : 1689.4133333333352,
    body: {
      x: second ? 886.9535111111127 : 456.67060740740686,
      y: 461.6,
      width: 28.799999999999997,
      height: 38.4,
    },
    viewport: {
      x: second ? 501.35351111111265 : 71.07060740740684,
      y: -59.19999999999999,
      width: 800,
      height: 1080,
    },
  };
  state.platforms = (
    second
      ? [
          platform("level-one:platform:1", 432, 500, 224, 16),
          platform("level-one:platform:2", 784, 500, 256, 16),
          platform("level-one:platform:3", 1168, 500, 160, 16),
          platform("level-one:platform:9", 880, 350, 48, 16, "one-way-up"),
          platform("block-1", 504, 422, 33.6, 28.8),
          platform("block-2", 934, 422, 33.6, 28.8),
        ]
      : [
          platform("level-one:platform:0", 0, 500, 320, 16),
          platform("level-one:platform:1", 432, 500, 224, 16),
          platform("level-one:platform:2", 784, 500, 256, 16),
          platform("level-one:platform:8", 336, 360, 48, 16, "one-way-up"),
          platform("block-1", 504, 422, 33.6, 28.8),
        ]
  ).map((p) => ({ ...p, dx: p.dx - x, dy: p.dy - state.position.y }));
  state.hazards = [
    {
      id: "stachlinger-1",
      kind: "stachlinger",
      dx: 560 - x,
      dy: 11.2,
      bounds: {
        dx: second ? -344.9535111111127 : 85.32939259259314,
        dy: 13.599999999999966,
        width: 2.4,
        height: 12,
      },
      active: true,
      warning: false,
      stompable: false,
      vx: 0,
      vy: 0,
    },
  ];
  state.hazards.push(
    second
      ? {
          id: "kugelblitz-1",
          kind: "kugelblitz",
          dx: 202.09,
          dy: -280.76,
          bounds: {
            dx: 187.6910113579023,
            dy: -295.1604456680509,
            width: 28.799999999999997,
            height: 28.799999999999997,
          },
          active: true,
          warning: false,
          stompable: false,
          vx: -341.03,
          vy: -20.8,
        }
      : {
          id: "ninjafrog-1",
          kind: "ninjafrog",
          dx: -202.44,
          dy: 3.2,
          bounds: {
            dx: -213.23540740740697,
            dy: -5.199999999999989,
            width: 21.599999999999998,
            height: 26.4,
          },
          active: true,
          warning: false,
          stompable: true,
          vx: -21.53,
          vy: 0,
        }
  );
  const coins: Array<[string, number, number, number]> = second
    ? [
        ["coin-10", 904, 310, 15],
        ["coin-4", 1220, 452, 10],
      ]
    : [["coin-3", 820, 452, 10]];
  state.coins = coins.map(([id, cx, cy, value]) => ({
    id,
    dx: cx - x,
    dy: cy - 480.8,
    value,
    bounds: { dx: cx - x - 15, dy: cy - 480.8 - 15, width: 30, height: 30 },
  }));
  return freeze(state);
}

export const overheadTick50 = recordedState(false);
export const overheadTick253 = recordedState(true);
