/**
 * Roh-Aufzeichnung der Gamepad-API für den Selbsttest unter `/play/test`.
 *
 * Bewusst vollständig eigenständig: keine Mappings, keine Kalibrierung, keine
 * gemeinsame Infrastruktur. Hier wird ausschließlich festgehalten, was
 * `navigator.getGamepads()` liefert – damit sich eindeutig trennen lässt, ob
 * ein Problem vom Adapter/Browser oder aus dem übrigen `/play`-Code kommt.
 *
 * Genau dieser Vergleich hat die Ursache des Eingabeproblems am Stand
 * aufgedeckt (siehe `.features/play-mode-webhid/bugfix.md`): Die Gamepad-API
 * meldete links/rechts nie, der Rohzugriff schon.
 */

/** Schwelle für Tasten (digital) bzw. Achsen (analog, bewusst niedrig, damit
 *  auch Hat-Switch-Zwischenwerte wie -0.43 sichtbar werden). */
const BUTTON_DELTA = 0.5;
const AXIS_DELTA = 0.15;

export interface PadSnapshot {
  index: number;
  id: string;
  mapping: string;
  timestamp: number;
  /** Wirksamer Zustand je Taste: 1, sobald `pressed` ODER `value > 0.5`. */
  buttons: number[];
  axes: number[];
  /** Tasten, die `pressed: true` bei `value: 0` melden – wichtiger Hinweis auf
   *  digitale Steuerkreuz-Tasten, die rein über `value` unsichtbar wären. */
  pressedWithoutValue: number[];
}

export interface PadEvent {
  /** Millisekunden seit Beginn der Aufzeichnung. */
  t: number;
  padIndex: number;
  type: "button" | "axis";
  index: number;
  from: number;
  to: number;
}

interface RawButton {
  pressed?: boolean;
  value?: number;
}

interface RawPad {
  index?: number;
  id?: string;
  mapping?: string;
  timestamp?: number;
  buttons?: readonly RawButton[];
  axes?: readonly number[];
}

export function snapshotPads(raw: readonly (RawPad | null)[]): PadSnapshot[] {
  const snapshots: PadSnapshot[] = [];

  for (let slot = 0; slot < raw.length; slot++) {
    const pad = raw[slot];
    if (!pad) continue;

    snapshots.push({
      index: typeof pad.index === "number" ? pad.index : slot,
      id: pad.id ?? "(ohne Kennung)",
      mapping: pad.mapping ?? "",
      timestamp: Math.round(pad.timestamp ?? 0),
      // `pressed` hat Vorrang: Digitale Tasten melden je nach Treiber
      // `{pressed: true, value: 0}` – nur auf `value` zu schauen, würde solche
      // Tastendrücke vollständig verschlucken.
      buttons: Array.from(pad.buttons ?? []).map((button) =>
        button?.pressed || (button?.value ?? 0) > 0.5 ? 1 : (button?.value ?? 0)
      ),
      axes: Array.from(pad.axes ?? []),
      pressedWithoutValue: Array.from(pad.buttons ?? [])
        .map((button, index) => (button?.pressed && (button?.value ?? 0) === 0 ? index : null))
        .filter((index): index is number => index !== null),
    });
  }

  return snapshots;
}

export function diffSnapshots(
  before: readonly PadSnapshot[],
  after: readonly PadSnapshot[],
  t: number
): PadEvent[] {
  const events: PadEvent[] = [];

  for (const pad of after) {
    const previous = before.find((entry) => entry.index === pad.index);
    if (!previous) continue;

    pad.buttons.forEach((value, index) => {
      const from = previous.buttons[index] ?? value;
      if (Math.abs(value - from) > BUTTON_DELTA) {
        events.push({ t, padIndex: pad.index, type: "button", index, from, to: value });
      }
    });

    pad.axes.forEach((value, index) => {
      const from = previous.axes[index] ?? value;
      if (Math.abs(value - from) > AXIS_DELTA) {
        events.push({
          t,
          padIndex: pad.index,
          type: "axis",
          index,
          from: Math.round(from * 100) / 100,
          to: Math.round(value * 100) / 100,
        });
      }
    });
  }

  return events;
}

export interface ReportInput {
  userAgent: string;
  frames: number;
  hz: number;
  durationMs: number;
  pads: readonly PadSnapshot[];
  events: readonly PadEvent[];
}

/** Kompakter, kopierbarer Bericht – das, was am Ende verschickt wird. */
export function buildReport(input: ReportInput): string {
  const summary = input.pads.map((pad) => {
    const padEvents = input.events.filter((event) => event.padIndex === pad.index);
    return {
      padIndex: pad.index,
      id: pad.id,
      mapping: pad.mapping,
      buttonCount: pad.buttons.length,
      axisCount: pad.axes.length,
      eventCount: padEvents.length,
      buttonsSeen: [
        ...new Set(padEvents.filter((e) => e.type === "button").map((e) => e.index)),
      ].sort((a, b) => a - b),
      axesSeen: [...new Set(padEvents.filter((e) => e.type === "axis").map((e) => e.index))].sort(
        (a, b) => a - b
      ),
    };
  });

  return JSON.stringify(
    {
      userAgent: input.userAgent,
      loop: { frames: input.frames, hz: input.hz, durationMs: input.durationMs },
      pads: input.pads,
      summary,
      events: input.events,
    },
    null,
    2
  );
}
