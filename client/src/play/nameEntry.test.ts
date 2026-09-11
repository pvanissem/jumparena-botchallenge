import { describe, expect, it } from "vitest";
import {
  createNameEntryState,
  DEFAULT_PLAYER_NAME,
  finalizeName,
  NAME_CHARSET,
  NAME_LENGTH,
  nameEntryReducer,
} from "./nameEntry";

function apply(types: ("up" | "down" | "left" | "right")[]) {
  return types.reduce((state, type) => nameEntryReducer(state, { type }), createNameEntryState());
}

describe("createNameEntryState", () => {
  it("startet mit acht Plätzen", () => {
    expect(createNameEntryState().chars).toHaveLength(NAME_LENGTH);
  });

  it("startet mit dem Cursor auf dem ersten Platz", () => {
    expect(createNameEntryState().cursor).toBe(0);
  });

  it("startet mit dem ersten Zeichen des Zeichenvorrats", () => {
    expect(createNameEntryState().chars[0]).toBe(NAME_CHARSET[0]);
  });
});

describe("nameEntryReducer – Zeichenwahl", () => {
  it("schaltet mit down zum nächsten Zeichen", () => {
    expect(apply(["down"]).chars[0]).toBe(NAME_CHARSET[1]);
  });

  it("schaltet mit up zum vorherigen Zeichen", () => {
    expect(apply(["down", "down", "up"]).chars[0]).toBe(NAME_CHARSET[1]);
  });

  it("läuft am Anfang des Zeichenvorrats um (up auf dem ersten Zeichen)", () => {
    expect(apply(["up"]).chars[0]).toBe(NAME_CHARSET[NAME_CHARSET.length - 1]);
  });

  it("läuft am Ende des Zeichenvorrats um", () => {
    const downs = Array<"down">(NAME_CHARSET.length).fill("down");
    expect(apply(downs).chars[0]).toBe(NAME_CHARSET[0]);
  });

  it("ändert nur das Zeichen an der Cursorposition", () => {
    const state = apply(["right", "down"]);
    expect(state.chars[0]).toBe(NAME_CHARSET[0]);
    expect(state.chars[1]).toBe(NAME_CHARSET[1]);
  });
});

describe("nameEntryReducer – Cursor", () => {
  it("bewegt den Cursor nach rechts", () => {
    expect(apply(["right"]).cursor).toBe(1);
  });

  it("bewegt den Cursor nach links", () => {
    expect(apply(["right", "right", "left"]).cursor).toBe(1);
  });

  it("bleibt am linken Rand stehen", () => {
    expect(apply(["left"]).cursor).toBe(0);
  });

  it("bleibt am rechten Rand stehen", () => {
    const rights = Array<"right">(NAME_LENGTH + 3).fill("right");
    expect(apply(rights).cursor).toBe(NAME_LENGTH - 1);
  });

  it("verändert den Namen beim Bewegen nicht", () => {
    expect(apply(["right", "left"]).chars).toEqual(createNameEntryState().chars);
  });
});

describe("finalizeName", () => {
  it("setzt die Zeichen zu einem Namen zusammen", () => {
    const state = { chars: ["M", "A", "X", " ", " ", " ", " ", " "], cursor: 0 };
    expect(finalizeName(state)).toBe("MAX");
  });

  it("entfernt führende und nachfolgende Leerzeichen", () => {
    const state = { chars: [" ", "A", "B", " ", " ", " ", " ", " "], cursor: 0 };
    expect(finalizeName(state)).toBe("AB");
  });

  it("behält Leerzeichen innerhalb des Namens", () => {
    const state = { chars: ["A", " ", "B", " ", " ", " ", " ", " "], cursor: 0 };
    expect(finalizeName(state)).toBe("A B");
  });

  it("nutzt den Standardnamen, wenn nur Leerzeichen eingegeben wurden", () => {
    const state = { chars: Array<string>(NAME_LENGTH).fill(" "), cursor: 0 };
    expect(finalizeName(state)).toBe(DEFAULT_PLAYER_NAME);
  });
});

describe("NAME_CHARSET", () => {
  it("enthält Buchstaben, Ziffern und das Leerzeichen", () => {
    expect(NAME_CHARSET).toContain("A");
    expect(NAME_CHARSET).toContain("Z");
    expect(NAME_CHARSET).toContain("0");
    expect(NAME_CHARSET).toContain("9");
    expect(NAME_CHARSET).toContain(" ");
  });
});
