import type { TournamentShowState } from "@arena/shared";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EventChrome } from "./EventChrome";

afterEach(cleanup);

describe("EventChrome", () => {
  it("announces phase, connectivity and held state", () => {
    const show = {
      phase: "countdown",
      holds: ["present-unavailable"],
      presentReady: false,
    } as TournamentShowState;
    render(
      <EventChrome show={show} connectionStatus="connected">
        <p>Arena</p>
      </EventChrome>
    );
    expect(screen.getByText("Countdown")).toBeTruthy();
    expect(screen.getByText(/Present wird benötigt/)).toBeTruthy();
    expect(screen.getByText("Arena")).toBeTruthy();
  });
});
