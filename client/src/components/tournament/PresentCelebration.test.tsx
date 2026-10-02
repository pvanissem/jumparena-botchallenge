import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { PresentCelebration } from "./PresentCelebration";

afterEach(cleanup);

it("keeps a bounded decorative burst stable across updates and removes it on unmount", () => {
  const { container, rerender, unmount } = render(
    <PresentCelebration>
      <h2>Alpha gewinnt</h2>
    </PresentCelebration>
  );
  const decoration = container.querySelector(".present-celebration__confetti");
  expect(decoration?.getAttribute("aria-hidden")).toBe("true");
  expect(decoration?.children).toHaveLength(24);
  const particles = Array.from(decoration?.children ?? []);
  const styles = particles.map((particle) => particle.getAttribute("style"));
  rerender(
    <PresentCelebration>
      <h2>Alpha gewinnt</h2>
    </PresentCelebration>
  );
  expect(screen.getByRole("heading", { name: "Alpha gewinnt" })).toBeTruthy();
  particles.forEach((particle, index) => {
    expect(decoration?.children[index]).toBe(particle);
    expect(particle.getAttribute("style")).toBe(styles[index]);
  });
  unmount();
  expect(container.children).toHaveLength(0);
});
