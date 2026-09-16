import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ArenaViewProps, ArenaViewStatus } from "../game/ArenaView";
import { LEVEL_ONE } from "../game/level/levelOne";
import { createInitialRacerState } from "../game/rules/racerState";
import { ArenaPage } from "./ArenaPage";

let arenaProps: ArenaViewProps;
vi.mock("../game/ArenaView", () => ({
  ArenaView: (props: ArenaViewProps) => {
    arenaProps = props;
    return <div data-testid="arena-view" />;
  },
}));
vi.mock("../bot/currentBotSource", () => ({ currentBotSource: "export function decide() {}" }));

afterEach(cleanup);

describe("ArenaPage bot diagnosis", () => {
  it.each([
    [
      "init-timeout",
      "Bot-Initialisierung hat das Zeitlimit ueberschritten",
      "Bot-Start fehlgeschlagen: Zeitlimit",
    ],
    [
      "worker-error",
      "Worker konnte nicht geladen werden",
      "Bot-Worker fehlgeschlagen: Worker konnte nicht geladen werden",
    ],
  ] as const)(
    "shows an explicit UI message for %s and clears it on restart",
    (kind, reason, message) => {
      render(<ArenaPage />);
      act(() =>
        arenaProps.onStatusChange?.({
          racer: createInitialRacerState(LEVEL_ONE),
          pausedReasonKind: kind,
          pausedReason: reason,
          lastRuntimeError: null,
          consecutiveFailureCount: 0,
        })
      );
      expect(screen.getByText(message, { exact: false })).toBeDefined();
      expect(screen.queryByText(/Bot läuft/)).toBeNull();
      fireEvent.click(screen.getByRole("radio", { name: /Selbst/ }));
      expect(screen.queryByText(message, { exact: false })).toBeNull();
      fireEvent.click(screen.getByRole("radio", { name: /Bot/ }));
      expect(screen.getByText(message, { exact: false })).toBeDefined();
      fireEvent.click(screen.getByRole("button", { name: /Neu/ }));
      expect(screen.queryByText(message, { exact: false })).toBeNull();
    }
  );

  it.each<[ArenaViewStatus["pausedReasonKind"], string]>([
    ["invalid-module", "Bot ungültig: Diagnose"],
    ["guard-rejected", "Bot blockiert: Diagnose"],
    ["too-many-failures", "Bot pausiert: reagiert nicht rechtzeitig / wirft wiederholt Fehler"],
    ["disposed", "Bot beendet"],
    [null, "Bot läuft"],
  ])("preserves the existing diagnosis for %s", (kind, message) => {
    render(<ArenaPage />);
    act(() =>
      arenaProps.onStatusChange?.({
        racer: createInitialRacerState(LEVEL_ONE),
        pausedReasonKind: kind,
        pausedReason: kind === null ? null : "Diagnose",
        lastRuntimeError: null,
        consecutiveFailureCount: 0,
      })
    );
    expect(screen.getByText(message, { exact: false })).toBeDefined();
  });

  it("preserves the runtime error and consecutive failure counter", () => {
    render(<ArenaPage />);
    act(() =>
      arenaProps.onStatusChange?.({
        racer: createInitialRacerState(LEVEL_ONE),
        pausedReasonKind: null,
        pausedReason: null,
        lastRuntimeError: "decide failed",
        consecutiveFailureCount: 3,
      })
    );
    expect(
      screen.getByText(/Bot läuft, wirft aber Fehler: decide failed \(3\/10 in Folge\)/)
    ).toBeDefined();
  });
});
