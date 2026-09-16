import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ArenaViewProps, ArenaViewStatus } from "../game/ArenaView";
import { LEVEL_ONE } from "../game/level/levelOne";
import { createInitialRacerState } from "../game/rules/racerState";
import { ArenaPage } from "./ArenaPage";

let arenaProps: ArenaViewProps;
const arenaMounted = vi.fn();
const arenaDisposed = vi.fn();
vi.mock("../game/ArenaView", () => ({
  ArenaView: (props: ArenaViewProps) => {
    arenaProps = props;
    useEffect(() => {
      arenaMounted();
      return () => {
        arenaDisposed();
      };
    }, []);
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

  it.each<[string | null, string]>([
    ["decide failed", "Bot gestoppt: decide failed"],
    [null, "Bot gestoppt: Watchdog-Timeout nach 100 ms"],
  ])("shows the first failure stop reason without a retry counter: %s", (error, reason) => {
    render(<ArenaPage />);
    act(() =>
      arenaProps.onStatusChange?.({
        racer: createInitialRacerState(LEVEL_ONE),
        pausedReasonKind: "too-many-failures",
        pausedReason: reason,
        lastRuntimeError: error,
        consecutiveFailureCount: 1,
      })
    );
    expect(screen.getByText(reason, { exact: false })).toBeDefined();
    expect(screen.queryByText(/Bot läuft|in Folge|wiederholt/)).toBeNull();
  });
});

describe("checkpoint practice starts", () => {
  it("remounts a fresh arena for an existing checkpoint and preserves the choice on restart", () => {
    render(<ArenaPage />);
    const checkpoint = LEVEL_ONE.checkpoints[0];
    const mounted = arenaMounted.mock.calls.length;
    const disposed = arenaDisposed.mock.calls.length;
    expect(arenaProps.startCheckpointId).toBeUndefined();
    fireEvent.change(screen.getByRole("combobox", { name: "Startpunkt" }), {
      target: { value: checkpoint.id },
    });
    expect(arenaProps.startCheckpointId).toBe(checkpoint.id);
    expect(arenaMounted).toHaveBeenCalledTimes(mounted + 1);
    expect(arenaDisposed).toHaveBeenCalledTimes(disposed + 1);
    fireEvent.click(screen.getByRole("button", { name: /Neu/ }));
    expect(arenaProps.startCheckpointId).toBe(checkpoint.id);
    expect(arenaMounted).toHaveBeenCalledTimes(mounted + 2);
    fireEvent.change(screen.getByRole("combobox", { name: "Startpunkt" }), {
      target: { value: "" },
    });
    expect(arenaProps.startCheckpointId).toBeUndefined();
  });
  it("clears the checkpoint when changing levels in the developer view", () => {
    render(<ArenaPage showLevelSelect />);
    fireEvent.change(screen.getByRole("combobox", { name: "Startpunkt" }), {
      target: { value: LEVEL_ONE.checkpoints[0].id },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Level" }), {
      target: { value: "level-two" },
    });
    expect(arenaProps.levelId).toBe("level-two");
    expect(arenaProps.startCheckpointId).toBeUndefined();
  });
});

describe("developer command diagnosis", () => {
  it.each([true, false])(
    "shows command details only with physicsDebug=%s and clears stale details",
    (physicsDebug) => {
      render(<ArenaPage physicsDebug={physicsDebug} />);
      const status = {
        racer: createInitialRacerState(LEVEL_ONE),
        pausedReasonKind: null,
        pausedReason: null,
        lastRuntimeError: null,
        consecutiveFailureCount: 0,
        navigation: {
          targetId: "ledge",
          routeId: null,
          planId: "bonus",
          phase: "blocked" as const,
          reason: "gap-ahead",
          relevantObjectIds: ["ledge"],
        },
      };
      act(() => arenaProps.onStatusChange?.(status));
      const details = screen.queryByText(/Auftrag: bonus.*Phase: blocked.*Grund: gap-ahead/);
      if (physicsDebug) expect(details).not.toBeNull();
      else expect(details).toBeNull();
      act(() => arenaProps.onStatusChange?.({ ...status, navigation: undefined }));
      expect(screen.queryByText(/Auftrag:/)).toBeNull();
    }
  );
});
