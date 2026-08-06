import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LEGEND_ENTRIES } from "../game/assets/legend";
import { HazardLegend } from "./HazardLegend";

describe("HazardLegend", () => {
  afterEach(() => {
    cleanup();
  });

  it("lists every legend entry with its name", () => {
    render(<HazardLegend />);
    for (const entry of LEGEND_ENTRIES) {
      expect(screen.getByText(entry.label)).toBeTruthy();
    }
  });

  it("marks stompable hazards so their special role is visible", () => {
    render(<HazardLegend />);
    const stompableCount = LEGEND_ENTRIES.filter((e) => e.stompable === true).length;
    expect(screen.getAllByTitle("Von oben stompbar")).toHaveLength(stompableCount);
  });

  it("renders an accessible preview image for each entry", () => {
    render(<HazardLegend />);
    expect(screen.getAllByRole("img")).toHaveLength(LEGEND_ENTRIES.length);
  });
});
