import { describe, expect, it } from "vitest";
import { KeyboardController } from "../../../game/control/KeyboardController";
import type { HumanInputSource } from "../../../game/control/RacerController";
import { FakeHidDevice } from "./fakeHidDevice";
import { HidController } from "./HidController";
import { HidSource } from "./HidSource";
import type { HidBinding } from "./hidBindings";
import type { HidMapping } from "./hidMapping";

const REST = [0x7f, 0x7f, 0x00];

function mapping(): HidMapping {
  const bindings: Record<string, HidBinding> = {
    left: { reportId: 0, byteIndex: 0, mask: 0xff, value: 0x00, tolerance: 0x30 },
    right: { reportId: 0, byteIndex: 0, mask: 0xff, value: 0xff, tolerance: 0x30 },
    up: { reportId: 0, byteIndex: 1, mask: 0xff, value: 0x00, tolerance: 0x30 },
    down: { reportId: 0, byteIndex: 1, mask: 0xff, value: 0xff, tolerance: 0x30 },
    jump: { reportId: 0, byteIndex: 2, mask: 0b0000_0001, value: 0b0000_0001 },
    sprint: { reportId: 0, byteIndex: 2, mask: 0b0000_0010, value: 0b0000_0010 },
    confirm: { reportId: 0, byteIndex: 2, mask: 0b0000_0100, value: 0b0000_0100 },
    back: { reportId: 0, byteIndex: 2, mask: 0b0000_1000, value: 0b0000_1000 },
  };
  return { deviceKey: "0079:0011", label: "USB Gamepad", bindings: bindings as never };
}

async function controllerWith(bytes: number[] | null) {
  const device = new FakeHidDevice();
  const source = new HidSource(device);
  await source.start();
  if (bytes) device.emit(0, bytes);
  return { controller: new HidController(source, mapping()), device, source };
}

function keyboard(overrides: Partial<Record<"left" | "right" | "space" | "shift", boolean>>) {
  return new KeyboardController({
    left: { isDown: overrides.left ?? false },
    right: { isDown: overrides.right ?? false },
    space: { isDown: overrides.space ?? false },
    shift: { isDown: overrides.shift ?? false },
  });
}

describe("HidController.getInput", () => {
  it("liefert im Ruhezustand keine Bewegung", async () => {
    const { controller } = await controllerWith(REST);
    expect(controller.getInput()).toEqual({ dir: 0, jump: false, sprint: false });
  });

  it("erkennt links", async () => {
    const { controller } = await controllerWith([0x00, 0x7f, 0x00]);
    expect(controller.getInput().dir).toBe(-1);
  });

  it("erkennt rechts", async () => {
    const { controller } = await controllerWith([0xff, 0x7f, 0x00]);
    expect(controller.getInput().dir).toBe(1);
  });

  it("erlaubt Laufen, Sprinten und Springen gleichzeitig", async () => {
    const { controller } = await controllerWith([0xff, 0x7f, 0b0000_0011]);
    expect(controller.getInput()).toEqual({ dir: 1, jump: true, sprint: true });
  });

  it("liefert ohne empfangenen Report den Ruhezustand", async () => {
    const { controller } = await controllerWith(null);
    expect(controller.getInput()).toEqual({ dir: 0, jump: false, sprint: false });
  });

  it("folgt neuen Reports", async () => {
    const { controller, device } = await controllerWith(REST);
    device.emit(0, [0x00, 0x7f, 0x00]);
    expect(controller.getInput().dir).toBe(-1);
    device.emit(0, REST);
    expect(controller.getInput().dir).toBe(0);
  });
});

describe("HidController – Parität zur Tastatur", () => {
  const cases: [string, number[], Parameters<typeof keyboard>[0]][] = [
    ["Ruhezustand", REST, {}],
    ["links", [0x00, 0x7f, 0x00], { left: true }],
    ["rechts", [0xff, 0x7f, 0x00], { right: true }],
    ["Sprung", [0x7f, 0x7f, 0b0000_0001], { space: true }],
    ["Sprint links", [0x00, 0x7f, 0b0000_0010], { left: true, shift: true }],
    ["rechts + Sprung", [0xff, 0x7f, 0b0000_0001], { right: true, space: true }],
  ];

  for (const [label, bytes, keys] of cases) {
    it(`liefert für ${label} dieselben Actions wie die Tastatur`, async () => {
      const { controller } = await controllerWith(bytes);
      expect(controller.getNextActions()).toEqual(keyboard(keys).getNextActions());
    });
  }
});

describe("HidController – Verbindung", () => {
  it("meldet eine laufende Quelle als verbunden", async () => {
    const { controller } = await controllerWith(REST);
    expect(controller.isConnected()).toBe(true);
  });

  it("meldet eine gestoppte Quelle als getrennt", async () => {
    const { controller, source } = await controllerWith(REST);
    await source.stop();
    expect(controller.isConnected()).toBe(false);
  });

  it("erfüllt das HumanInputSource-Interface", async () => {
    const { controller } = await controllerWith(REST);
    const source: HumanInputSource = controller;
    expect(typeof source.getInput).toBe("function");
    expect(() => source.dispose()).not.toThrow();
  });
});
