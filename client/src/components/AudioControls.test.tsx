import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { audioSettings } from "../game/audio/audioSettings";
import { AudioControls } from "./AudioControls";

describe("AudioControls", () => {
  beforeEach(() => {
    audioSettings.setMuted(false);
    audioSettings.setVolume(0.6);
  });

  afterEach(() => {
    cleanup();
  });

  it("toggles muted state when the mute button is clicked", () => {
    render(<AudioControls />);
    const button = screen.getByRole("button", { name: /stummschalten/i });

    fireEvent.click(button);
    expect(audioSettings.getState().muted).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: /stummschaltung aufheben/i }));
    expect(audioSettings.getState().muted).toBe(false);
  });

  it("calls setVolume with a normalized value (0..1) when the slider changes", () => {
    render(<AudioControls />);
    const slider = screen.getByRole("slider");

    fireEvent.change(slider, { target: { value: "25" } });

    expect(audioSettings.getState().volume).toBeCloseTo(0.25);
  });

  it("reflects an external store change (slider value + button label)", () => {
    render(<AudioControls />);

    act(() => {
      audioSettings.setVolume(0.8);
      audioSettings.setMuted(true);
    });

    const slider = screen.getByRole("slider") as HTMLInputElement;
    expect(slider.value).toBe("80");
    expect(screen.getByRole("button", { name: /stummschaltung aufheben/i })).toBeTruthy();
  });
});
