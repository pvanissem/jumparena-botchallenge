import { ACTIONS, type Action } from "../../../../packages/bot-contract/src/state";
import type { NavigationDiagnostic } from "./types";

export const MAX_NAVIGATION_DIAGNOSTIC_BYTES = 2 * 1024;
const keys = new Set([
  "targetId",
  "routeId",
  "planId",
  "phase",
  "reason",
  "relevantObjectIds",
  "searchBudgetStatus",
  "navigationActions",
  "actionOverride",
  "statusTransition",
]);
const text = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= max;

/** Untrusted worker data: reject, rather than silently changing a planner's explanation. */
export function validateNavigationDiagnostic(
  value: unknown,
  returnedActions?: readonly Action[]
): NavigationDiagnostic | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const d = value as Record<string, unknown>;
  if (Object.keys(d).some((key) => !keys.has(key))) return undefined;
  if (d.statusTransition !== undefined) {
    const t = d.statusTransition as Record<string, unknown>;
    if (
      !t ||
      typeof t !== "object" ||
      Array.isArray(t) ||
      Object.keys(t).some(
        (key) => !["commandId", "targetId", "state", "phase", "reason"].includes(key)
      ) ||
      !text(t.commandId, 128) ||
      !(t.targetId === null || text(t.targetId, 128)) ||
      !["running", "succeeded", "failed"].includes(t.state as string) ||
      !(
        t.phase === null || ["approach", "launch", "flight", "landing"].includes(t.phase as string)
      ) ||
      !(t.reason === null || text(t.reason, 256))
    )
      return undefined;
  }
  if (
    !["targetId", "routeId", "planId"].every((key) => d[key] === null || text(d[key], 128)) ||
    !["select", "execute", "wait", "recover", "blocked"].includes(d.phase as string) ||
    !text(d.reason, 256) ||
    !Array.isArray(d.relevantObjectIds) ||
    d.relevantObjectIds.length > 32 ||
    !d.relevantObjectIds.every((id) => text(id, 128)) ||
    (d.searchBudgetStatus !== undefined &&
      !["available", "exhausted", "pending"].includes(d.searchBudgetStatus as string)) ||
    (d.actionOverride !== undefined && d.actionOverride !== "navigation-output-overridden") ||
    (d.navigationActions !== undefined &&
      (!Array.isArray(d.navigationActions) ||
        d.navigationActions.length > 6 ||
        !d.navigationActions.every((a) => ACTIONS.includes(a))))
  )
    return undefined;

  const result = {
    ...d,
    relevantObjectIds: [...d.relevantObjectIds],
  } as unknown as NavigationDiagnostic;
  if (result.statusTransition) result.statusTransition = { ...result.statusTransition };
  if (result.navigationActions) {
    result.navigationActions = [...result.navigationActions];
    if (
      returnedActions &&
      JSON.stringify(result.navigationActions) !== JSON.stringify(returnedActions)
    ) {
      result.actionOverride = "navigation-output-overridden";
    }
  }
  if (new TextEncoder().encode(JSON.stringify(result)).byteLength > MAX_NAVIGATION_DIAGNOSTIC_BYTES)
    return undefined;
  return result;
}
