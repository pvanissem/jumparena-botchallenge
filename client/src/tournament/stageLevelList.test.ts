import { describe, expect, it } from "vitest";
import { addStage, moveStage, removeStage, setStage } from "./stageLevelList";

describe("addStage", () => {
  it("hängt das zuletzt gewählte Level erneut an", () => {
    expect(addStage(["level-one", "level-two"])).toEqual(["level-one", "level-two", "level-two"]);
  });
});

describe("removeStage", () => {
  it("entfernt die Stage an der angegebenen Position", () => {
    expect(removeStage(["level-one", "level-two", "level-three"], 1)).toEqual([
      "level-one",
      "level-three",
    ]);
  });

  it("ist ein No-op, wenn nur eine Stage übrig ist", () => {
    expect(removeStage(["level-one"], 0)).toEqual(["level-one"]);
  });

  it("entfernt bei negativem Index nichts", () => {
    expect(removeStage(["level-one", "level-two"], -1)).toEqual(["level-one", "level-two"]);
  });

  it("entfernt bei Index außerhalb nichts", () => {
    expect(removeStage(["level-one", "level-two"], 5)).toEqual(["level-one", "level-two"]);
  });
});

describe("moveStage", () => {
  it("tauscht die Stage mit ihrem Vorgänger nach oben", () => {
    expect(moveStage(["level-one", "level-two", "level-three"], 1, -1)).toEqual([
      "level-two",
      "level-one",
      "level-three",
    ]);
  });

  it("tauscht die Stage mit ihrem Nachfolger nach unten", () => {
    expect(moveStage(["level-one", "level-two", "level-three"], 1, 1)).toEqual([
      "level-one",
      "level-three",
      "level-two",
    ]);
  });

  it("ist ein No-op an der oberen Kante", () => {
    expect(moveStage(["level-one", "level-two"], 0, -1)).toEqual(["level-one", "level-two"]);
  });

  it("ist ein No-op an der unteren Kante", () => {
    expect(moveStage(["level-one", "level-two"], 1, 1)).toEqual(["level-one", "level-two"]);
  });
});

describe("setStage", () => {
  it("ändert ausschließlich den adressierten Index", () => {
    expect(setStage(["level-one", "level-two"], 0, "level-three")).toEqual([
      "level-three",
      "level-two",
    ]);
  });

  it("gibt bei negativem Index die Liste unverändert zurück", () => {
    expect(setStage(["level-one", "level-two"], -1, "level-three")).toEqual([
      "level-one",
      "level-two",
    ]);
  });

  it("gibt bei Index außerhalb die Liste unverändert zurück", () => {
    expect(setStage(["level-one", "level-two"], 5, "level-three")).toEqual([
      "level-one",
      "level-two",
    ]);
  });
});
