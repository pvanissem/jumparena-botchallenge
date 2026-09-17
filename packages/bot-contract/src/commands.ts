import type { DecideResult } from "./state";
export type ControlCommand =
  | {
      id: string;
      kind: "stomp";
      hazardId: string;
      platformId: string;
      x?: number;
      sprint?: boolean;
      holdMs?: number;
    }
  | { id: string; kind: "walk"; x: number; sprint?: boolean }
  | { id: string; kind: "drop"; platformId: string; x?: number; sprint?: boolean }
  | {
      id: string;
      kind: "jump";
      platformId: string;
      x?: number;
      sprint?: boolean;
      holdMs?: number;
      runUpMs?: number;
    }
  | {
      id: string;
      kind: "boingo";
      utilityId: string;
      platformId: string;
      x?: number;
      sprint?: boolean;
    };
export interface ControlStatus {
  commandId: string | null;
  state: "idle" | "running" | "succeeded" | "failed";
  phase: "approach" | "launch" | "flight" | "landing" | null;
  reason: string | null;
}
export interface MovementOption {
  command: ControlCommand;
  progress: number;
  fruitValue: number;
  durationMs: number;
}
/** Strategy chooses a destination; the framework owns the preparatory movements. */
export interface NavigationChoice {
  readonly id: string;
  readonly kind: ControlCommand["kind"];
  readonly platformId: string | null;
  readonly progress: number;
  readonly distance: number;
  /** Landing height relative to current feet; positive means higher. */
  readonly rise: number;
  readonly durationMs: number;
  readonly fruitValue: number;
  /** Horizontal path passes a visible enemy near the current standing height. */
  readonly crossesEnemy: boolean;
  readonly hazardId?: string;
}
export interface NavigationIntent {
  target: { kind: "goal" } | { kind: "coin"; id: string } | { kind: "platform"; id: string };
  caution?: "normal" | "careful";
  enemies?: "avoid" | "stomp";
  movement?: "normal" | "ground";
  allowBoingo?: boolean | "fallback";
  /** Called only when a new maneuver can be selected. Null deliberately waits. */
  choose?: (choices: readonly NavigationChoice[]) => string | null;
}
export interface ControlTools {
  readonly navigate: (intent: NavigationIntent) => DecideResult;
  readonly options: () => MovementOption[];
  readonly run: (command: ControlCommand) => DecideResult;
  readonly status: () => ControlStatus;
}
