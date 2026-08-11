import type { BotArtifact } from "@arena/shared";
import { ALLOWED_GROUP_SIZES, DEFAULT_GROUP_SIZE } from "@arena/shared";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LEVEL_REGISTRY } from "../game/level/levelRegistry";
import { TournamentSetup } from "./TournamentSetup";

function bot(id: string): BotArtifact {
  return {
    id,
    name: `Bot ${id}`,
    author: "A",
    color: "#000",
    sourceCode: "export default {}",
    uploadedAt: "2024-01-01T00:00:00.000Z",
  };
}

describe("TournamentSetup", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders group size buttons for every allowed size", () => {
    const { container } = render(
      <TournamentSetup bots={[bot("b1"), bot("b2")]} onStart={vi.fn()} />
    );

    expect(container.firstElementChild?.classList.contains("tournament-setup")).toBe(true);

    for (const size of ALLOWED_GROUP_SIZES) {
      expect(screen.getByRole("button", { name: String(size) })).toBeTruthy();
    }
  });

  it("marks the default group size as active initially", () => {
    render(<TournamentSetup bots={[bot("b1"), bot("b2")]} onStart={vi.fn()} />);

    const activeButton = screen.getByRole("button", { name: String(DEFAULT_GROUP_SIZE) });
    expect(activeButton.classList.contains("pixel-btn--active")).toBe(true);
  });

  it("switches the active group size when another option is clicked", () => {
    render(<TournamentSetup bots={[bot("b1"), bot("b2")]} onStart={vi.fn()} />);

    const defaultButton = screen.getByRole("button", { name: String(DEFAULT_GROUP_SIZE) });
    const otherSize = ALLOWED_GROUP_SIZES.find((s) => s !== DEFAULT_GROUP_SIZE) ?? 2;
    const otherButton = screen.getByRole("button", { name: String(otherSize) });

    fireEvent.click(otherButton);

    expect(defaultButton.classList.contains("pixel-btn--active")).toBe(false);
    expect(otherButton.classList.contains("pixel-btn--active")).toBe(true);
  });

  it("calls onStart with the selected group size", () => {
    const onStart = vi.fn();
    render(<TournamentSetup bots={[bot("b1"), bot("b2")]} onStart={onStart} />);

    const otherSize = ALLOWED_GROUP_SIZES.find((s) => s !== DEFAULT_GROUP_SIZE) ?? 2;
    fireEvent.click(screen.getByRole("button", { name: String(otherSize) }));

    fireEvent.click(screen.getByRole("button", { name: /turnier aufstellen/i }));

    expect(onStart).toHaveBeenCalledWith(
      expect.arrayContaining([LEVEL_REGISTRY[0].id]),
      expect.arrayContaining(["b1", "b2"]),
      expect.any(Number),
      otherSize
    );
  });

  it("defaults to the default group size when no option is clicked", () => {
    const onStart = vi.fn();
    render(<TournamentSetup bots={[bot("b1"), bot("b2")]} onStart={onStart} />);

    fireEvent.click(screen.getByRole("button", { name: /turnier aufstellen/i }));

    expect(onStart).toHaveBeenCalledWith(
      expect.arrayContaining([LEVEL_REGISTRY[0].id]),
      expect.arrayContaining(["b1", "b2"]),
      expect.any(Number),
      DEFAULT_GROUP_SIZE
    );
  });

  it("starts with a single stage", () => {
    const onStart = vi.fn();
    render(<TournamentSetup bots={[bot("b1"), bot("b2")]} onStart={onStart} />);

    fireEvent.click(screen.getByRole("button", { name: /turnier aufstellen/i }));

    expect(onStart).toHaveBeenCalledWith(
      [LEVEL_REGISTRY[0].id],
      expect.anything(),
      expect.anything(),
      expect.anything()
    );
  });

  it("shows the expected round count for selected participants and group size", () => {
    render(
      <TournamentSetup bots={[bot("b1"), bot("b2"), bot("b3"), bot("b4")]} onStart={vi.fn()} />
    );

    expect(screen.getByText(/erwartete rundenzahl: 1/i)).toBeTruthy();
  });

  it("updates the expected round count when the group size changes", () => {
    render(
      <TournamentSetup bots={[bot("b1"), bot("b2"), bot("b3"), bot("b4")]} onStart={vi.fn()} />
    );

    const size2 = ALLOWED_GROUP_SIZES.find((s) => s !== DEFAULT_GROUP_SIZE) ?? 2;
    fireEvent.click(screen.getByRole("button", { name: String(size2) }));

    expect(screen.getByText(/erwartete rundenzahl: 2/i)).toBeTruthy();
  });
});
