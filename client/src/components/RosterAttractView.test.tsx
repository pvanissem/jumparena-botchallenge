import type { BotArtifact } from "@arena/shared";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RosterAttractView } from "./RosterAttractView";

afterEach(cleanup);

describe("RosterAttractView", () => {
  it("shows submitted bots as an event attract screen", () => {
    const bot = { id: "b1", name: "Turbo", author: "Ada", color: "#0ff" } as BotArtifact;
    render(<RosterAttractView bots={[bot]} />);
    expect(screen.getByRole("heading", { name: "Nächste Herausforderer" })).toBeTruthy();
    expect(screen.getByText("Turbo")).toBeTruthy();
    expect(screen.getByText(/Ada/)).toBeTruthy();
  });
});
