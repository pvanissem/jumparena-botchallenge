import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

vi.mock("./pages/CodePage", () => ({ CodePage: () => <div data-testid="code-page" /> }));
vi.mock("./pages/DevPage", () => ({ DevPage: () => <div data-testid="dev-page" /> }));
vi.mock("./pages/PresentPage", () => ({ PresentPage: () => <div data-testid="present-page" /> }));
vi.mock("./pages/AdminPage", () => ({ AdminPage: () => <div data-testid="admin-page" /> }));

describe("App routing", () => {
  afterEach(cleanup);

  it("rendert die Messestand-Seite unter /code", () => {
    render(
      <MemoryRouter initialEntries={["/code"]}>
        <App />
      </MemoryRouter>
    );
    expect(screen.getByTestId("code-page")).toBeDefined();
  });

  it("rendert die Entwickler-Seite weiterhin unter /dev", () => {
    render(
      <MemoryRouter initialEntries={["/dev"]}>
        <App />
      </MemoryRouter>
    );
    expect(screen.getByTestId("dev-page")).toBeDefined();
  });

  it("leitet / auf /code um", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>
    );
    expect(screen.getByTestId("code-page")).toBeDefined();
  });
});
