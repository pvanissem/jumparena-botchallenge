import type { DecideResult } from "./state";
export type ControlCommand =
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
export interface ControlTools {
  readonly options: () => MovementOption[];
  readonly run: (command: ControlCommand) => DecideResult;
  readonly status: () => ControlStatus;
}
