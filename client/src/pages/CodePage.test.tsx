import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ArenaViewProps } from "../game/ArenaView";
import { DEFAULT_LEVEL_ID } from "../game/level/levelRegistry";
import { CodePage } from "./CodePage";
import { DevPage } from "./DevPage";

// Phaser läuft nicht in jsdom – die Arena wird durch eine Sonde ersetzt, die
// die für dieses Feature relevanten Props als data-Attribute nach außen gibt.
vi.mock("../game/ArenaView", () => ({
  ArenaView: ({ levelId, physicsDebug }: ArenaViewProps) => (
    <div
      data-testid="arena-view"
      data-level-id={levelId}
      data-physics-debug={String(physicsDebug ?? false)}
    />
  ),
}));
vi.mock("../bot/currentBotSource", () => ({ currentBotSource: "export function decide() {}" }));

afterEach(cleanup);

describe("CodePage (/code, Messestand)", () => {
  it("zeigt keine Level-Auswahl", () => {
    const { container } = render(<CodePage />);
    expect(container.querySelector(".pixel-select")).toBeNull();
  });

  it("startet die Arena immer mit Level 1", () => {
    render(<CodePage />);
    expect(screen.getByTestId("arena-view").dataset.levelId).toBe(DEFAULT_LEVEL_ID);
  });

  it("deaktiviert das Phaser-Physik-Debug-Overlay", () => {
    render(<CodePage />);
    expect(screen.getByTestId("arena-view").dataset.physicsDebug).toBe("false");
  });

  it("behält Modus-Umschalter und Neustart-Button", () => {
    render(<CodePage />);
    expect(screen.getByText(/Selbst/)).toBeDefined();
    expect(screen.getByText(/Bot/)).toBeDefined();
    expect(screen.getByRole("button", { name: /Neu/ })).toBeDefined();
  });
});

describe("DevPage (/dev, Entwickler-Ansicht) bleibt unverändert", () => {
  it("zeigt weiterhin die Level-Auswahl", () => {
    const { container } = render(<DevPage />);
    expect(container.querySelector(".pixel-select")).not.toBeNull();
  });

  it("zeigt weiterhin das Phaser-Physik-Debug-Overlay", () => {
    render(<DevPage />);
    expect(screen.getByTestId("arena-view").dataset.physicsDebug).toBe("true");
  });
});
