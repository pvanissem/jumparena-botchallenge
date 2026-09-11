import { cleanup, render, screen } from "@testing-library/react";
import { act, useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeHidDevice } from "../play/input/hid/fakeHidDevice";
import { HID_MAPPING_STORAGE_KEY } from "../play/input/hid/hidMappingStore";
import { PlayPage } from "./PlayPage";

let devices: FakeHidDevice[] = [];

// Wie in `MatchRunner.test.ts`: Die echte Szene zieht Phaser mit in den Test.
vi.mock("../game/scenes/RaceScene", () => ({ RaceScene: class {} }));

const fakeGame = vi.hoisted(() => ({
  canvas: { width: 1200, height: 600 },
  scene: {
    add: vi.fn(),
    remove: vi.fn(),
    getScene: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
  },
}));

vi.mock("../play/PlayArena", () => ({
  PlayArena: ({ onReady }: { onReady: (game: unknown) => void }) => {
    // Stabile Instanz + Effect statt Render-Body: sonst setzt die Seite bei
    // jedem Render einen neuen State und rendert endlos neu.
    useEffect(() => onReady(fakeGame), [onReady]);
    return <div data-testid="play-arena" />;
  },
}));

function mappingFor(deviceKey: string) {
  const bit = (mask: number) => ({ reportId: 0, byteIndex: 0, mask, value: mask });
  return {
    deviceKey,
    label: "USB Gamepad",
    bindings: {
      left: bit(0b0000_0001),
      right: bit(0b0000_0010),
      up: bit(0b0000_0100),
      down: bit(0b0000_1000),
      jump: bit(0b0001_0000),
      sprint: bit(0b0010_0000),
      confirm: bit(0b0100_0000),
      back: bit(0b1000_0000),
    },
  };
}

function storeMapping(deviceKey: string) {
  localStorage.setItem(
    HID_MAPPING_STORAGE_KEY,
    JSON.stringify({ version: 1, byDeviceKey: { [deviceKey]: mappingFor(deviceKey) } })
  );
}

describe("PlayPage", () => {
  beforeEach(() => {
    devices = [];
    localStorage.clear();
    vi.stubGlobal("navigator", {
      hid: {
        getDevices: vi.fn(async () => devices),
        requestDevice: vi.fn(async () => devices),
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  async function renderPage() {
    render(<PlayPage />);
    // Auf das automatische Öffnen bereits freigegebener Geräte warten.
    await act(async () => {});
  }

  it("bietet ohne eingerichteten Controller den Rohzugriff an", async () => {
    await renderPage();
    expect(screen.getByRole("button", { name: /Controller verbinden/i })).toBeTruthy();
  });

  it("erklärt, warum direkt ausgelesen wird", async () => {
    await renderPage();
    expect(screen.getByText(/Steuerkreuz links\/rechts/i)).toBeTruthy();
  });

  it("weist auf fehlenden Rohzugriff hin, wenn der Browser ihn nicht kann", async () => {
    vi.stubGlobal("navigator", {});
    await renderPage();
    expect(screen.getByText(/unterstützt keinen Rohzugriff/i)).toBeTruthy();
  });

  it("listet ein verbundenes, noch unbelegtes Gerät mit Kalibrier-Schaltfläche", async () => {
    devices = [new FakeHidDevice({ productName: "USB Gamepad", vendorId: 0x79, productId: 0x11 })];
    await renderPage();

    expect(screen.getByText(/USB Gamepad/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Tasten festlegen/i })).toBeTruthy();
  });

  it("startet das Spiel, sobald ein Gerät belegt ist", async () => {
    storeMapping("0079:0011");
    devices = [new FakeHidDevice({ productName: "USB Gamepad", vendorId: 0x79, productId: 0x11 })];
    await renderPage();

    expect(screen.getByTestId("play-arena")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Tasten festlegen/i })).toBeNull();
  });

  it("zeigt beide Stationen nebeneinander", async () => {
    storeMapping("0079:0011");
    devices = [
      new FakeHidDevice({ productName: "USB Gamepad", vendorId: 0x79, productId: 0x11 }),
      new FakeHidDevice({ productName: "USB Gamepad", vendorId: 0x79, productId: 0x11 }),
    ];
    await renderPage();

    expect(document.querySelector(".play-station--left")).toBeTruthy();
    expect(document.querySelector(".play-station--right")).toBeTruthy();
  });

  it("startet beide Stationen unabhängig im Wartezustand", async () => {
    storeMapping("0079:0011");
    devices = [
      new FakeHidDevice({ productName: "USB Gamepad", vendorId: 0x79, productId: 0x11 }),
      new FakeHidDevice({ productName: "USB Gamepad", vendorId: 0x79, productId: 0x11 }),
    ];
    await renderPage();

    expect(document.querySelectorAll('[data-phase="attract"]')).toHaveLength(2);
  });

  it("weist eine Station ohne zugeordneten Controller aus", async () => {
    storeMapping("0079:0011");
    devices = [new FakeHidDevice({ productName: "USB Gamepad", vendorId: 0x79, productId: 0x11 })];
    await renderPage();

    expect(document.querySelector('[data-phase="unassigned"]')).toBeTruthy();
  });

  it("zeigt die Bestenliste", async () => {
    storeMapping("0079:0011");
    devices = [new FakeHidDevice({ productName: "USB Gamepad", vendorId: 0x79, productId: 0x11 })];
    await renderPage();

    expect(screen.getByRole("heading", { name: /Bestenliste/i })).toBeTruthy();
  });

  it("trägt den Titel der Veranstaltung", async () => {
    storeMapping("0079:0011");
    devices = [new FakeHidDevice({ productName: "USB Gamepad", vendorId: 0x79, productId: 0x11 })];
    await renderPage();

    expect(screen.getByRole("heading", { name: /DEVK AI Bot Challenge/i })).toBeTruthy();
  });

  it("hält den Anschlussbereich standardmäßig eingeklappt", async () => {
    storeMapping("0079:0011");
    devices = [new FakeHidDevice({ productName: "USB Gamepad", vendorId: 0x79, productId: 0x11 })];
    await renderPage();

    const panel = document.querySelector<HTMLDetailsElement>("[data-testid='controller-panel']");
    expect(panel?.open).toBe(false);
  });

  it("zeigt im Anschlussbereich die Anzahl verbundener Controller", async () => {
    storeMapping("0079:0011");
    devices = [new FakeHidDevice({ productName: "USB Gamepad", vendorId: 0x79, productId: 0x11 })];
    await renderPage();

    expect(screen.getByTestId("controller-panel").textContent).toContain("1");
  });

  it("bietet im Spiel eine erneute Kalibrierung an", async () => {
    storeMapping("0079:0011");
    devices = [new FakeHidDevice({ productName: "USB Gamepad", vendorId: 0x79, productId: 0x11 })];
    await renderPage();

    expect(screen.getByRole("button", { name: /Spieler 1 · USB Gamepad/i })).toBeTruthy();
  });
});
