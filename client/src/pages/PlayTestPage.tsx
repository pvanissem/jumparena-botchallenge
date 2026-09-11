/**
 * Gamepad-Selbsttest (`/play/test`).
 *
 * Zweck: eindeutig klären, ob ein Eingabeproblem vom Adapter/Browser kommt
 * oder aus dem übrigen `/play`-Code. Diese Seite nutzt daher NICHTS davon –
 * kein Mapping, keine Kalibrierung, kein Poller –, sondern liest in einer
 * eigenen Schleife `navigator.getGamepads()` und zeichnet jede Änderung auf.
 *
 * Wichtig: Die Aufzeichnung läuft in JEDEM Frame, die Anzeige ist nur zur
 * Entlastung gedrosselt. Ein kurzer Tastendruck kann also im Bericht stehen,
 * auch wenn die Anzeige ihn nicht zeigt.
 */
import { useCallback, useRef, useState } from "react";
import { HidProbe } from "../play/input/hid/HidProbe";
import {
  buildReport,
  diffSnapshots,
  type PadEvent,
  type PadSnapshot,
  snapshotPads,
} from "../play/input/padRecorder";
import { useFrameLoop } from "../play/useFrameLoop";
import "../styles/play-arcade.css";

const MAX_EVENTS = 400;

/** Belegung laut W3C-"standard gamepad mapping" – nur zur Beschriftung. */
const STANDARD_BUTTON_NAMES: Record<number, string> = {
  0: "A",
  1: "B",
  2: "X",
  3: "Y",
  4: "L",
  5: "R",
  6: "L2",
  7: "R2",
  8: "Select",
  9: "Start",
  10: "L3",
  11: "R3",
  12: "hoch",
  13: "runter",
  14: "links",
  15: "rechts",
};

/** Welche Tasten dieses Pads im Test bereits einmal ausgelöst haben. */
function seenButtons(events: readonly PadEvent[], padIndex: number): Set<number> {
  return new Set(
    events
      .filter((event) => event.padIndex === padIndex && event.type === "button")
      .map((event) => event.index)
  );
}
const DISPLAY_INTERVAL_MS = 100;

function readPads(): PadSnapshot[] {
  if (typeof navigator === "undefined" || !navigator.getGamepads) return [];
  return snapshotPads(navigator.getGamepads() as unknown as Parameters<typeof snapshotPads>[0]);
}

export function PlayTestPage() {
  const [pads, setPads] = useState<PadSnapshot[]>([]);
  const [events, setEvents] = useState<PadEvent[]>([]);
  const [stats, setStats] = useState({ frames: 0, hz: 0, durationMs: 0 });
  const [copied, setCopied] = useState(false);

  const previousRef = useRef<PadSnapshot[]>([]);
  const eventsRef = useRef<PadEvent[]>([]);
  const clockRef = useRef({
    frames: 0,
    elapsedMs: 0,
    sinceDisplayMs: 0,
    windowFrames: 0,
    windowMs: 0,
  });

  useFrameLoop((deltaMs) => {
    const clock = clockRef.current;
    clock.frames += 1;
    clock.elapsedMs += deltaMs;
    clock.sinceDisplayMs += deltaMs;
    clock.windowFrames += 1;
    clock.windowMs += deltaMs;

    // Aufzeichnung: jeder Frame, ungedrosselt.
    const current = readPads();
    const changes = diffSnapshots(previousRef.current, current, Math.round(clock.elapsedMs));
    previousRef.current = current;
    if (changes.length > 0) {
      eventsRef.current = [...eventsRef.current, ...changes].slice(-MAX_EVENTS);
    }

    // Anzeige: gedrosselt.
    if (clock.frames > 1 && clock.sinceDisplayMs < DISPLAY_INTERVAL_MS) return;
    clock.sinceDisplayMs = 0;

    const hz = clock.windowMs > 0 ? Math.round((clock.windowFrames / clock.windowMs) * 1000) : 0;
    clock.windowFrames = 0;
    clock.windowMs = 0;

    setPads(current);
    setEvents(eventsRef.current);
    setStats({ frames: clock.frames, hz, durationMs: Math.round(clock.elapsedMs) });
  });

  const report = useCallback(
    () =>
      buildReport({
        userAgent: typeof navigator === "undefined" ? "" : navigator.userAgent,
        frames: stats.frames,
        hz: stats.hz,
        durationMs: stats.durationMs,
        pads: previousRef.current,
        events: eventsRef.current,
      }),
    [stats]
  );

  const copy = useCallback(() => {
    const text = report();
    void navigator.clipboard?.writeText(text).then(
      () => setCopied(true),
      () => setCopied(false)
    );
  }, [report]);

  const reset = useCallback(() => {
    eventsRef.current = [];
    setEvents([]);
    setCopied(false);
  }, []);

  const recent = [...events].reverse().slice(0, 25);

  return (
    <main className="play-page play-test">
      <header className="play-page__header">
        <h1 className="play-page__title">Gamepad-Selbsttest</h1>
        <div className="play-page__tools">
          <button type="button" className="play-button" onClick={copy}>
            {copied ? "✅ Kopiert" : "Bericht kopieren"}
          </button>
          <button type="button" className="play-button play-button--ghost" onClick={reset}>
            Aufzeichnung leeren
          </button>
        </div>
      </header>

      <ol className="play-test__steps">
        <li>Controller anstecken und einmal eine beliebige Taste drücken.</li>
        <li>
          Nacheinander <strong>alle</strong> Tasten drücken: Steuerkreuz (links, rechts, hoch,
          runter), dann A/B/X/Y, dann L/R, dann Start und Select.
        </li>
        <li>Zum Schluss „Bericht kopieren" und den Text verschicken.</li>
      </ol>

      <p className="play-test__stats" data-testid="test-stats">
        Schleife: {stats.frames} Frames · {stats.hz} Hz · {Math.round(stats.durationMs / 1000)}s ·
        aufgezeichnete Ereignisse: <strong>{events.length}</strong>
      </p>

      <section className="play-test__pads" data-testid="test-pads">
        {pads.length === 0 ? (
          <p className="play-test__empty">
            <code>navigator.getGamepads()</code> liefert nichts. Bitte eine Taste am Controller
            drücken – Browser geben Gamepads erst nach der ersten Eingabe frei.
          </p>
        ) : (
          pads.map((pad) => (
            <article key={`${pad.index}-${pad.id}`} className="play-test__pad">
              <h2>
                #{pad.index} · {pad.id}
              </h2>
              <p>
                mapping: <code>{pad.mapping || "(leer)"}</code> · timestamp:{" "}
                <code>{pad.timestamp}</code> · {pad.buttons.length} Tasten / {pad.axes.length}{" "}
                Achsen
              </p>
              {pad.pressedWithoutValue.length > 0 && (
                <p className="play-test__values">
                  meldet <code>pressed</code> ohne Analogwert:{" "}
                  <code>{pad.pressedWithoutValue.join(", ")}</code>
                </p>
              )}
              <ul className="play-test__matrix">
                {pad.buttons.map((value, index) => {
                  const seen = seenButtons(events, pad.index).has(index);
                  return (
                    <li
                      // biome-ignore lint/suspicious/noArrayIndexKey: der Index IST die Tastennummer
                      key={index}
                      data-active={value > 0.5 ? "true" : "false"}
                      data-seen={seen ? "true" : "false"}
                      title={STANDARD_BUTTON_NAMES[index] ?? `Taste ${index}`}
                    >
                      {index}
                    </li>
                  );
                })}
              </ul>
              <p className="play-test__legend">
                hell = gerade gedrückt · umrandet = im Test schon einmal erkannt ·{" "}
                {STANDARD_BUTTON_NAMES[12]}=12, {STANDARD_BUTTON_NAMES[13]}=13,{" "}
                {STANDARD_BUTTON_NAMES[14]}=14, {STANDARD_BUTTON_NAMES[15]}=15
              </p>
              <p className="play-test__values">
                Achsen:{" "}
                <code>
                  {pad.axes.length > 0 ? pad.axes.map((v) => v.toFixed(2)).join(" | ") : "–"}
                </code>
              </p>
            </article>
          ))
        )}
      </section>

      <HidProbe />

      <section className="play-test__events" data-testid="test-events">
        <h2>Aufgezeichnete Ereignisse (neueste zuerst)</h2>
        {recent.length === 0 ? (
          <p className="play-test__empty">– noch nichts aufgezeichnet –</p>
        ) : (
          <ol>
            {recent.map((event) => (
              <li key={`${event.t}-${event.padIndex}-${event.type}-${event.index}`}>
                [{event.t}ms] #{event.padIndex} {event.type === "button" ? "Taste" : "Achse"}{" "}
                {event.index}: {event.from} → {event.to}
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
