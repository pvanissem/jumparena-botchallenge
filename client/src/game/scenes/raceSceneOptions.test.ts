import { describe, expect, it } from "vitest";
import type { HumanInputSource } from "../control/RacerController";
import { normalizeAudioOption, resolveControllerChoice } from "./raceSceneOptions";

const humanInput = {
  getInput: () => ({ dir: 0 as const, jump: false, sprint: false }),
  getNextActions: () => [],
  dispose: () => {},
} satisfies HumanInputSource;

describe("resolveControllerChoice", () => {
  it("wählt den Bot-Pfad, wenn Modus und Quellcode vorliegen", () => {
    expect(resolveControllerChoice({ controllerMode: "bot", botSourceCode: "export ..." })).toEqual(
      {
        kind: "bot",
        botSourceCode: "export ...",
      }
    );
  });

  it("fällt ohne Quellcode auf die Tastatur zurück (bisheriges Verhalten)", () => {
    expect(resolveControllerChoice({ controllerMode: "bot" })).toEqual({ kind: "keyboard" });
  });

  it("wählt den Tastatur-Pfad im Tastatur-Modus", () => {
    expect(resolveControllerChoice({ controllerMode: "keyboard" })).toEqual({ kind: "keyboard" });
  });

  it("wählt die injizierte Eingabequelle im Gamepad-Modus", () => {
    expect(resolveControllerChoice({ controllerMode: "gamepad", humanInput })).toEqual({
      kind: "gamepad",
      humanInput,
    });
  });

  it("wirft im Gamepad-Modus ohne injizierte Eingabequelle (Fail-Fast)", () => {
    expect(() => resolveControllerChoice({ controllerMode: "gamepad" })).toThrow(/humanInput/);
  });

  it("ignoriert eine injizierte Eingabequelle im Tastatur-Modus", () => {
    expect(resolveControllerChoice({ controllerMode: "keyboard", humanInput })).toEqual({
      kind: "keyboard",
    });
  });
});

describe("normalizeAudioOption", () => {
  it("aktiviert ohne Angabe Musik und Soundeffekte (bisheriges Verhalten)", () => {
    expect(normalizeAudioOption(undefined)).toEqual({ music: true, sfx: true });
  });

  it("aktiviert bei true Musik und Soundeffekte", () => {
    expect(normalizeAudioOption(true)).toEqual({ music: true, sfx: true });
  });

  it("deaktiviert bei false beides (bisheriges Verhalten im Turnier)", () => {
    expect(normalizeAudioOption(false)).toEqual({ music: false, sfx: false });
  });

  it("übernimmt eine granulare Angabe unverändert", () => {
    expect(normalizeAudioOption({ music: false, sfx: true })).toEqual({ music: false, sfx: true });
  });

  it("erlaubt Musik ohne Soundeffekte", () => {
    expect(normalizeAudioOption({ music: true, sfx: false })).toEqual({ music: true, sfx: false });
  });
});
