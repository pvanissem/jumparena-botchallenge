import { describe, expect, it } from "vitest";
import { emptySnapshot, hasAnyInput, risingEdges } from "./inputSnapshot";
import { PLAY_INPUTS } from "./inputs";

describe("emptySnapshot", () => {
  it("enthält alle acht logischen Eingaben", () => {
    expect(Object.keys(emptySnapshot()).sort()).toEqual([...PLAY_INPUTS].sort());
  });

  it("ist im Ausgangszustand vollständig inaktiv", () => {
    expect(Object.values(emptySnapshot()).every((value) => value === false)).toBe(true);
  });
});

describe("risingEdges", () => {
  it("meldet ohne Vorgänger-Snapshot alle aktiven Eingaben als Flanke", () => {
    const next = { ...emptySnapshot(), confirm: true };
    expect(risingEdges(null, next).confirm).toBe(true);
  });

  it("meldet eine frisch gedrückte Taste als Flanke", () => {
    expect(risingEdges(emptySnapshot(), { ...emptySnapshot(), jump: true }).jump).toBe(true);
  });

  it("meldet eine gehaltene Taste nicht erneut als Flanke", () => {
    const held = { ...emptySnapshot(), jump: true };
    expect(risingEdges(held, held).jump).toBe(false);
  });

  it("meldet das Loslassen nicht als Flanke", () => {
    expect(risingEdges({ ...emptySnapshot(), jump: true }, emptySnapshot()).jump).toBe(false);
  });

  it("betrachtet jede Eingabe unabhängig", () => {
    const prev = { ...emptySnapshot(), left: true };
    const next = { ...emptySnapshot(), left: true, jump: true };
    expect(risingEdges(prev, next)).toEqual({ ...emptySnapshot(), jump: true });
  });
});

describe("hasAnyInput", () => {
  it("erkennt einen leeren Snapshot", () => {
    expect(hasAnyInput(emptySnapshot())).toBe(false);
  });

  it("erkennt eine aktive Eingabe", () => {
    expect(hasAnyInput({ ...emptySnapshot(), back: true })).toBe(true);
  });
});
