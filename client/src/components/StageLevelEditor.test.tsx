import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StageLevelEditor } from "./StageLevelEditor";

describe("StageLevelEditor", () => {
  afterEach(() => {
    cleanup();
  });

  function resetButton(): HTMLElement {
    return screen.getByRole("button", { name: /stage hinzufügen/i });
  }

  it("rendert eine Zeile pro Stage", () => {
    render(
      <StageLevelEditor stageLevelIds={["level-one"]} onChange={vi.fn()} expectedRoundCount={1} />
    );

    expect(screen.getByText(/runde 1/i)).toBeTruthy();
    expect(screen.queryByText(/runde 2/i)).toBeNull();
  });

  it("deaktiviert 'hoch' in der ersten Zeile", () => {
    render(
      <StageLevelEditor
        stageLevelIds={["level-one", "level-two"]}
        onChange={vi.fn()}
        expectedRoundCount={1}
      />
    );

    const upButtons = screen.getAllByRole("button", { name: /hoch/i });
    expect(upButtons[0].hasAttribute("disabled")).toBe(true);
    expect(upButtons[1].hasAttribute("disabled")).toBe(false);
  });

  it("deaktiviert 'runter' in der letzten Zeile", () => {
    render(
      <StageLevelEditor
        stageLevelIds={["level-one", "level-two"]}
        onChange={vi.fn()}
        expectedRoundCount={1}
      />
    );

    const downButtons = screen.getAllByRole("button", { name: /runter/i });
    expect(downButtons[0].hasAttribute("disabled")).toBe(false);
    expect(downButtons[1].hasAttribute("disabled")).toBe(true);
  });

  it("deaktiviert 'entfernen', wenn nur eine Stage existiert", () => {
    render(
      <StageLevelEditor stageLevelIds={["level-one"]} onChange={vi.fn()} expectedRoundCount={1} />
    );

    expect(screen.getByRole("button", { name: /entfernen/i }).hasAttribute("disabled")).toBe(true);
  });

  it("ruft onChange beim Hinzufügen mit der duplizierten letzten Stage auf", () => {
    const onChange = vi.fn();
    render(
      <StageLevelEditor
        stageLevelIds={["level-one", "level-two"]}
        onChange={onChange}
        expectedRoundCount={3}
      />
    );

    fireEvent.click(resetButton());

    expect(onChange).toHaveBeenCalledWith(["level-one", "level-two", "level-two"]);
  });

  it("ruft onChange beim Entfernen mit der gekürzten Liste auf", () => {
    const onChange = vi.fn();
    render(
      <StageLevelEditor
        stageLevelIds={["level-one", "level-two"]}
        onChange={onChange}
        expectedRoundCount={1}
      />
    );

    const removeButtons = screen.getAllByRole("button", { name: /entfernen/i });
    fireEvent.click(removeButtons[1]);

    expect(onChange).toHaveBeenCalledWith(["level-one"]);
  });

  it("verhindert das Entfernen der letzten Stage", () => {
    const onChange = vi.fn();
    render(
      <StageLevelEditor stageLevelIds={["level-one"]} onChange={onChange} expectedRoundCount={1} />
    );

    fireEvent.click(screen.getByRole("button", { name: /entfernen/i }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("ruft onChange beim Verschieben nach oben auf", () => {
    const onChange = vi.fn();
    render(
      <StageLevelEditor
        stageLevelIds={["level-one", "level-two"]}
        onChange={onChange}
        expectedRoundCount={1}
      />
    );

    const upButtons = screen.getAllByRole("button", { name: /hoch/i });
    fireEvent.click(upButtons[1]);

    expect(onChange).toHaveBeenCalledWith(["level-two", "level-one"]);
  });

  it("ruft onChange beim Verschieben nach unten auf", () => {
    const onChange = vi.fn();
    render(
      <StageLevelEditor
        stageLevelIds={["level-one", "level-two"]}
        onChange={onChange}
        expectedRoundCount={1}
      />
    );

    const downButtons = screen.getAllByRole("button", { name: /runter/i });
    fireEvent.click(downButtons[0]);

    expect(onChange).toHaveBeenCalledWith(["level-two", "level-one"]);
  });

  it("verhindert Verschieben über die Listenränder hinaus", () => {
    const onChange = vi.fn();
    render(
      <StageLevelEditor stageLevelIds={["level-one"]} onChange={onChange} expectedRoundCount={1} />
    );

    fireEvent.click(screen.getByRole("button", { name: /hoch/i }));
    fireEvent.click(screen.getByRole("button", { name: /runter/i }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("ruft onChange beim Wechsel des Levels einer Stage auf", () => {
    const onChange = vi.fn();
    render(
      <StageLevelEditor stageLevelIds={["level-one"]} onChange={onChange} expectedRoundCount={1} />
    );

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "level-two" } });

    expect(onChange).toHaveBeenCalledWith(["level-two"]);
  });

  it("zeigt einen Hinweis, wenn weniger Stages als erwartete Runden konfiguriert sind", () => {
    render(
      <StageLevelEditor stageLevelIds={["level-one"]} onChange={vi.fn()} expectedRoundCount={3} />
    );

    expect(
      screen.getByText(/spielen die weiteren Runden auf dem Level der letzten Stage/i)
    ).toBeTruthy();
  });

  it("zeigt einen Hinweis, wenn mehr Stages als erwartete Runden konfiguriert sind", () => {
    render(
      <StageLevelEditor
        stageLevelIds={["level-one", "level-two", "level-three"]}
        onChange={vi.fn()}
        expectedRoundCount={2}
      />
    );

    expect(
      screen.getByText(/überzähligen Stages werden voraussichtlich nicht gespielt/i)
    ).toBeTruthy();
  });

  it("zeigt bei passender Stages-Anzahl keinen Hinweis", () => {
    render(
      <StageLevelEditor
        stageLevelIds={["level-one", "level-two"]}
        onChange={vi.fn()}
        expectedRoundCount={2}
      />
    );

    expect(screen.queryByText(/Stage wird/i)).toBeNull();
    expect(screen.queryByText(/Stages werden/i)).toBeNull();
  });
});
