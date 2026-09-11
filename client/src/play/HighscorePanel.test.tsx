import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { HighscorePanel } from "./HighscorePanel";
import type { HighscoreEntry } from "./highscore";

function entry(overrides: Partial<HighscoreEntry> = {}): HighscoreEntry {
  return { id: "a", name: "MAX", score: 100, levelsCompleted: 2, createdAt: 1, ...overrides };
}

describe("HighscorePanel", () => {
  afterEach(cleanup);

  it("zeigt einen Hinweis, solange kein Ergebnis vorliegt", () => {
    render(<HighscorePanel entries={[]} highlightId={null} />);
    expect(screen.getByText(/noch keine/i)).toBeTruthy();
  });

  it("zeigt Name, Punkte und geschaffte Level", () => {
    render(<HighscorePanel entries={[entry({ name: "ANNA", score: 420 })]} highlightId={null} />);
    const row = screen.getByTestId("highscore-row-0");
    expect(row.textContent).toContain("ANNA");
    expect(row.textContent).toContain("420");
    expect(row.textContent).toContain("2");
  });

  it("sortiert absteigend nach Punkten", () => {
    render(
      <HighscorePanel
        entries={[
          entry({ id: "a", name: "KLEIN", score: 10 }),
          entry({ id: "b", name: "GROSS", score: 900 }),
        ]}
        highlightId={null}
      />
    );
    expect(screen.getByTestId("highscore-row-0").textContent).toContain("GROSS");
  });

  it("zeigt höchstens zehn Einträge", () => {
    const many = Array.from({ length: 14 }, (_, index) => entry({ id: `e${index}`, score: index }));
    render(<HighscorePanel entries={many} highlightId={null} />);
    expect(screen.getAllByTestId(/highscore-row-/)).toHaveLength(10);
  });

  it("hebt den neuen Eintrag hervor", () => {
    render(
      <HighscorePanel
        entries={[entry({ id: "alt", score: 500 }), entry({ id: "neu", score: 100 })]}
        highlightId="neu"
      />
    );
    expect(screen.getByTestId("highscore-row-1").getAttribute("data-highlight")).toBe("true");
    expect(screen.getByTestId("highscore-row-0").getAttribute("data-highlight")).toBe("false");
  });

  it("nummeriert die Plätze ab 1", () => {
    render(<HighscorePanel entries={[entry()]} highlightId={null} />);
    expect(screen.getByTestId("highscore-row-0").textContent).toContain("1");
  });
});
