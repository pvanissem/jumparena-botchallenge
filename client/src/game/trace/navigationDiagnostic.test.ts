import { describe, expect, it } from "vitest";
import { validateNavigationDiagnostic } from "./navigationDiagnostic";

const diagnostic = {
  targetId: "coin-9",
  routeId: "route-2",
  planId: "plan-3",
  phase: "execute",
  reason: "landing-confirmed",
  relevantObjectIds: ["platform-9", "boingo-1"],
  searchBudgetStatus: "available",
  navigationActions: ["jump", "right"],
};

describe("validateNavigationDiagnostic", () => {
  it("uses UTF-8 bytes at the inclusive 2-KiB boundary, including the override marker", () => {
    const value = { ...diagnostic, relevantObjectIds: Array(17).fill("x".repeat(100)) };
    const baseBytes = new TextEncoder().encode(JSON.stringify(value)).byteLength;
    value.relevantObjectIds.push("x".repeat(2048 - baseBytes - 3));
    expect(new TextEncoder().encode(JSON.stringify(value)).byteLength).toBe(2048);
    expect(validateNavigationDiagnostic(value)).toEqual(value);
    expect(validateNavigationDiagnostic(value, ["left"])).toBeUndefined();
    value.relevantObjectIds[value.relevantObjectIds.length - 1] += "x";
    expect(validateNavigationDiagnostic(value)).toBeUndefined();
  });

  it("copies known serializable fields and detects an overridden navigation output", () => {
    const result = validateNavigationDiagnostic(diagnostic, ["left"]);
    expect(result).toEqual({ ...diagnostic, actionOverride: "navigation-output-overridden" });
    expect(result?.relevantObjectIds).not.toBe(diagnostic.relevantObjectIds);
    expect(validateNavigationDiagnostic(diagnostic, ["jump", "right"])).toEqual(diagnostic);
  });

  it.each([
    undefined,
    null,
    {},
    { ...diagnostic, phase: "invented" },
    { ...diagnostic, planId: 1 },
    { ...diagnostic, relevantObjectIds: Array(33).fill("id") },
    { ...diagnostic, reason: "x".repeat(257) },
    { ...diagnostic, relevantObjectIds: Array(32).fill("\u00e4".repeat(64)) },
    { ...diagnostic, navigationActions: ["fly"] },
    { ...diagnostic, extra: () => true },
    { ...diagnostic, extra: Number.NaN },
  ])("rejects invalid or oversized diagnostics without inventing intent: %j", (value) => {
    expect(validateNavigationDiagnostic(value)).toBeUndefined();
  });

  it("rejects cycles, nested objects and foreign fields", () => {
    const cyclic = { ...diagnostic, extra: {} };
    cyclic.extra = cyclic;
    expect(validateNavigationDiagnostic(cyclic)).toBeUndefined();
    expect(
      validateNavigationDiagnostic({ ...diagnostic, extra: { engine: true } })
    ).toBeUndefined();
    expect(validateNavigationDiagnostic({ ...diagnostic, extra: "unknown" })).toBeUndefined();
  });
});
