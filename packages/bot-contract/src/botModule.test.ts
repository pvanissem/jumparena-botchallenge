import { describe, expect, it } from "vitest";
import { SUPPORTED_API_VERSION, validateBotModule } from "./botModule";

function validCandidate(overrides: Record<string, unknown> = {}) {
  return {
    apiVersion: SUPPORTED_API_VERSION,
    decide: () => "idle",
    ...overrides,
  };
}

describe("validateBotModule", () => {
  it("accepts a valid module with apiVersion and decide", () => {
    const result = validateBotModule(validCandidate());
    expect(result.valid).toBe(true);
  });

  it("rejects a missing apiVersion", () => {
    const candidate: Record<string, unknown> = validCandidate();
    delete candidate.apiVersion;
    const result = validateBotModule(candidate);
    expect(result).toEqual({
      valid: false,
      reason: "apiVersion undefined nicht unterstützt",
    });
  });

  it("rejects a string apiVersion", () => {
    const result = validateBotModule(validCandidate({ apiVersion: "1" }));
    expect(result).toEqual({
      valid: false,
      reason: "apiVersion 1 nicht unterstützt",
    });
  });

  it("rejects an unsupported apiVersion number", () => {
    const result = validateBotModule(validCandidate({ apiVersion: 2 }));
    expect(result).toEqual({
      valid: false,
      reason: "apiVersion 2 nicht unterstützt",
    });
  });

  it("rejects a missing decide function", () => {
    const candidate: Record<string, unknown> = validCandidate();
    delete candidate.decide;
    const result = validateBotModule(candidate);
    expect(result).toEqual({ valid: false, reason: "decide ist keine Funktion" });
  });

  it("rejects a non-function decide", () => {
    const result = validateBotModule(validCandidate({ decide: "nope" }));
    expect(result).toEqual({ valid: false, reason: "decide ist keine Funktion" });
  });

  it("accepts a valid module even without optional name/author/color", () => {
    const result = validateBotModule(validCandidate());
    expect(result.valid).toBe(true);
  });

  it("still accepts a module that has optional name/author/color set", () => {
    const result = validateBotModule(
      validCandidate({ name: "Turbo", author: "Anna", color: "#ff0000" })
    );
    expect(result.valid).toBe(true);
  });

  it.each([null, undefined, "a string", 42, true])(
    "rejects non-object candidate %p",
    (candidate) => {
      const result = validateBotModule(candidate);
      expect(result).toEqual({ valid: false, reason: "kein Objekt" });
    }
  );
});
