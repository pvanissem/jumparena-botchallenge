import { describe, expect, it } from "vitest";
import { botRevisionForSource } from "./botTraceIdentity";

describe("botRevisionForSource", () => {
  it("returns the same compact revision for equal source and a different one after an edit", () => {
    expect(botRevisionForSource("export default { decide() { return []; } }")).toBe(
      botRevisionForSource("export default { decide() { return []; } }")
    );
    expect(botRevisionForSource("return ['right']")).not.toBe(
      botRevisionForSource("return ['left']")
    );
    expect(botRevisionForSource("source")).toMatch(/^bot-[0-9a-f]{8}$/);
  });
});
