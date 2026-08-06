/**
 * Tests für den Keyboard-Capture-Guard (siehe
 * `.features/keyboard-input-capture/bugfix.md`).
 *
 * Kern-Regression: Phaser unterdrückt den Browser-Default nur für
 * *unmodifizierte* Tastendrücke. Sprint (Shift + Pfeil) und Shift selbst
 * fallen dort durchs Raster und lösen Textselektion/Fokuswanderung aus.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { installKeyboardCaptureGuard } from "./keyboardCaptureGuard";

let uninstall: (() => void) | null = null;

function install() {
  uninstall = installKeyboardCaptureGuard();
}

afterEach(() => {
  uninstall?.();
  uninstall = null;
  document.body.innerHTML = "";
});

/** Feuert ein Tastatur-Event und meldet, ob der Browser-Default unterdrückt wurde. */
function dispatchKey(
  type: "keydown" | "keyup",
  init: KeyboardEventInit,
  target: EventTarget = window
): KeyboardEvent {
  const event = new KeyboardEvent(type, { bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

describe("installKeyboardCaptureGuard", () => {
  describe("unterdrückt Spieltasten", () => {
    it("unterdrückt Space ohne Modifier", () => {
      install();
      expect(dispatchKey("keydown", { key: " ", code: "Space" }).defaultPrevented).toBe(true);
    });

    it.each(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"])(
      "unterdrückt %s ohne Modifier",
      (key) => {
        install();
        expect(dispatchKey("keydown", { key, code: key }).defaultPrevented).toBe(true);
      }
    );

    it("unterdrückt Shift allein (Sprint-Taste)", () => {
      install();
      const event = dispatchKey("keydown", { key: "Shift", code: "ShiftLeft", shiftKey: true });
      expect(event.defaultPrevented).toBe(true);
    });

    it("unterdrückt Shift + Pfeil (Sprint) – Phasers Lücke bei Modifiern", () => {
      install();
      const event = dispatchKey("keydown", {
        key: "ArrowRight",
        code: "ArrowRight",
        shiftKey: true,
      });
      expect(event.defaultPrevented).toBe(true);
    });

    it("unterdrückt Shift + Space (Sprint-Sprung)", () => {
      install();
      const event = dispatchKey("keydown", { key: " ", code: "Space", shiftKey: true });
      expect(event.defaultPrevented).toBe(true);
    });

    it("unterdrückt auch keyup der Spieltasten", () => {
      install();
      expect(dispatchKey("keyup", { key: " ", code: "Space" }).defaultPrevented).toBe(true);
      expect(
        dispatchKey("keyup", { key: "ArrowLeft", code: "ArrowLeft", shiftKey: true })
          .defaultPrevented
      ).toBe(true);
    });
  });

  describe("lässt andere Tasten unangetastet", () => {
    it.each([
      ["Tab", { key: "Tab", code: "Tab" }],
      ["F5", { key: "F5", code: "F5" }],
      ["Enter", { key: "Enter", code: "Enter" }],
      ["Buchstabe a", { key: "a", code: "KeyA" }],
      ["Ctrl+R", { key: "r", code: "KeyR", ctrlKey: true }],
      ["Cmd+Shift+I", { key: "i", code: "KeyI", metaKey: true, shiftKey: true }],
    ])("unterdrückt %s nicht", (_name, init) => {
      install();
      expect(dispatchKey("keydown", init).defaultPrevented).toBe(false);
    });
  });

  describe("Texteingaben", () => {
    it("unterdrückt nichts, wenn ein Textfeld fokussiert ist", () => {
      const input = document.createElement("input");
      input.type = "text";
      document.body.append(input);
      install();

      expect(
        dispatchKey("keydown", { key: "ArrowLeft", code: "ArrowLeft" }, input).defaultPrevented
      ).toBe(false);
    });

    it("unterdrückt nichts in einer Textarea", () => {
      const textarea = document.createElement("textarea");
      document.body.append(textarea);
      install();

      expect(dispatchKey("keydown", { key: " ", code: "Space" }, textarea).defaultPrevented).toBe(
        false
      );
    });

    it("unterdrückt weiterhin bei einem Range-Slider (kein Textfeld)", () => {
      const range = document.createElement("input");
      range.type = "range";
      document.body.append(range);
      install();

      expect(
        dispatchKey("keydown", { key: "ArrowRight", code: "ArrowRight" }, range).defaultPrevented
      ).toBe(true);
    });
  });

  describe("Fokus-Freigabe", () => {
    it("blurred einen fokussierten Button bei einer Spieltaste", () => {
      const button = document.createElement("button");
      document.body.append(button);
      button.focus();
      expect(document.activeElement).toBe(button);
      install();

      dispatchKey("keydown", { key: " ", code: "Space" }, button);

      expect(document.activeElement).not.toBe(button);
    });

    it("blurred kein Textfeld", () => {
      const input = document.createElement("input");
      input.type = "text";
      document.body.append(input);
      input.focus();
      install();

      dispatchKey("keydown", { key: "ArrowLeft", code: "ArrowLeft" }, input);

      expect(document.activeElement).toBe(input);
    });

    it("blurred nicht bei fremden Tasten", () => {
      const button = document.createElement("button");
      document.body.append(button);
      button.focus();
      install();

      dispatchKey("keydown", { key: "a", code: "KeyA" }, button);

      expect(document.activeElement).toBe(button);
    });
  });

  it("stoppt die Propagation nicht (Phaser/Audio-Unlock müssen das Event sehen)", () => {
    install();
    const listener = vi.fn();
    window.addEventListener("keydown", listener);

    dispatchKey("keydown", { key: " ", code: "Space" });

    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener("keydown", listener);
  });

  describe("Reihenfolge gegenüber Phaser", () => {
    // Phasers KeyboardManager verwirft jedes Event mit `event.defaultPrevented`
    // (phaser.js:122550) - der Guard darf daher NIEMALS vor Phaser abbrechen,
    // sonst reagiert die Steuerung gar nicht mehr.
    function registerPhaserLikeListener() {
      const seen: { key: string; defaultPrevented: boolean }[] = [];
      const listener = (event: Event) => {
        const keyboardEvent = event as KeyboardEvent;
        seen.push({ key: keyboardEvent.key, defaultPrevented: keyboardEvent.defaultPrevented });
      };
      // Wie Phaser: window, Bubble-Phase.
      window.addEventListener("keydown", listener, false);
      window.addEventListener("keyup", listener, false);
      return {
        seen,
        remove: () => {
          window.removeEventListener("keydown", listener, false);
          window.removeEventListener("keyup", listener, false);
        },
      };
    }

    it("lässt einen zuvor registrierten Phaser-Listener das Event unabgebrochen sehen", () => {
      const phaser = registerPhaserLikeListener();
      install(); // Guard wird NACH Phaser installiert

      const event = dispatchKey("keydown", { key: " ", code: "Space" });

      expect(phaser.seen).toEqual([{ key: " ", defaultPrevented: false }]);
      // ... der Browser-Default wird trotzdem unterdrückt
      expect(event.defaultPrevented).toBe(true);
      phaser.remove();
    });

    it("gilt auch für Sprint (Shift + Pfeil) und keyup", () => {
      const phaser = registerPhaserLikeListener();
      install();

      const down = dispatchKey("keydown", {
        key: "ArrowRight",
        code: "ArrowRight",
        shiftKey: true,
      });
      const up = dispatchKey("keyup", { key: "ArrowRight", code: "ArrowRight", shiftKey: true });

      expect(phaser.seen.every((entry) => entry.defaultPrevented === false)).toBe(true);
      expect(phaser.seen).toHaveLength(2);
      expect(down.defaultPrevented).toBe(true);
      expect(up.defaultPrevented).toBe(true);
      phaser.remove();
    });
  });

  it("entfernt die Listener wieder, wenn die Cleanup-Funktion aufgerufen wird", () => {
    install();
    uninstall?.();
    uninstall = null;

    expect(dispatchKey("keydown", { key: " ", code: "Space" }).defaultPrevented).toBe(false);
  });

  it("ist mehrfach aufrufbares Cleanup gegenüber tolerant", () => {
    install();
    uninstall?.();
    expect(() => uninstall?.()).not.toThrow();
    uninstall = null;
  });
});
