import { describe, expect, it } from "vitest";
import { colorForId } from "./colorForId";

describe("colorForId", () => {
  it("is deterministic for the same id", () => {
    const id = "550e8400-e29b-41d4-a716-446655440000";

    expect(colorForId(id)).toBe(colorForId(id));
  });

  it("produces a valid hex color", () => {
    const color = colorForId("some-id");

    expect(color).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("produces different colors for different ids", () => {
    const a = colorForId("id-a");
    const b = colorForId("id-b");

    expect(a).not.toBe(b);
  });
});
