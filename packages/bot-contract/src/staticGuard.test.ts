import { describe, expect, it } from "vitest";
import { checkStaticGuard } from "./staticGuard";

const FORBIDDEN_EXAMPLES: Array<{ label: string; code: string }> = [
  { label: "import", code: 'import { x } from "y";' },
  { label: "require(", code: 'const x = require("y");' },
  { label: "fetch(", code: 'fetch("https://example.com");' },
  { label: "window.", code: "window.location = 'x';" },
  { label: "document.", code: "document.title = 'x';" },
  { label: "eval(", code: "eval('1+1');" },
  { label: "XMLHttpRequest", code: "new XMLHttpRequest();" },
];

describe("checkStaticGuard", () => {
  it.each(FORBIDDEN_EXAMPLES)("rejects code containing $label", ({ code }) => {
    const result = checkStaticGuard(code);
    expect(result.allowed).toBe(false);
    expect(result.matchedPattern).toBeTruthy();
  });

  it("allows a plausible example bot (docs/09 format)", () => {
    const code = `
      export default {
        apiVersion: 1,
        name: "Der Sammler",
        decide(state) {
          if (state.nearestHazard && state.nearestHazard.dx < 2) {
            return "jump";
          }
          return state.goalDirection.dx >= 0 ? "right" : "left";
        },
      };
    `;
    const result = checkStaticGuard(code);
    expect(result).toEqual({ allowed: true });
  });
});
