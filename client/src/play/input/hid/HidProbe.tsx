/**
 * WebHID-Rohansicht für den Selbsttest – siehe
 * `.features/play-mode-webhid/bugfix.md`.
 *
 * Zeigt die unveränderten HID-Report-Bytes des Geräts. Damit lässt sich am
 * Stand in Sekunden prüfen, ob Richtungen, die Chromiums Gamepad-Mapping
 * verschluckt, im Rohdatenstrom vorhanden sind.
 */
import { useCallback, useRef, useState } from "react";
import { useFrameLoop } from "../../useFrameLoop";
import { formatReportBytes, toHex } from "./formatBytes";
import { HidSource } from "./HidSource";
import { diffReportBytes } from "./hidBindings";
import { getHidApi, isHidSupported } from "./hidTypes";

interface ByteChange {
  t: number;
  byteIndex: number;
  from: number;
  to: number;
}

const MAX_CHANGES = 60;

export function HidProbe() {
  const [source, setSource] = useState<HidSource | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bytes, setBytes] = useState<number[]>([]);
  const [changes, setChanges] = useState<ByteChange[]>([]);
  const [reportCount, setReportCount] = useState(0);

  const previousRef = useRef<number[]>([]);
  const changesRef = useRef<ByteChange[]>([]);
  const elapsedRef = useRef(0);

  const connect = useCallback(async () => {
    const hid = getHidApi();
    if (!hid) {
      setError("Dieser Browser kennt WebHID nicht.");
      return;
    }

    try {
      // Ohne Filter: Der Nutzer wählt sein Gerät selbst aus der Browser-Liste.
      const devices = await hid.requestDevice({ filters: [] });
      const device = devices[0];
      if (!device) {
        setError("Kein Gerät ausgewählt.");
        return;
      }

      const next = new HidSource(device);
      await next.start();
      previousRef.current = [];
      changesRef.current = [];
      setChanges([]);
      setError(null);
      setSource(next);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }, []);

  useFrameLoop((deltaMs) => {
    if (!source) return;
    elapsedRef.current += deltaMs;

    const report = source.latest();
    if (!report) return;

    const changed = diffReportBytes(previousRef.current, report.bytes);
    if (changed.length > 0 && previousRef.current.length > 0) {
      const t = Math.round(elapsedRef.current);
      const entries = changed.map((byteIndex) => ({
        t,
        byteIndex,
        from: previousRef.current[byteIndex] ?? 0,
        to: report.bytes[byteIndex] ?? 0,
      }));
      changesRef.current = [...changesRef.current, ...entries].slice(-MAX_CHANGES);
      setChanges(changesRef.current);
    }

    previousRef.current = report.bytes;
    setBytes(report.bytes);
    setReportCount(source.reportCount());
  }, source !== null);

  if (!isHidSupported()) {
    return (
      <section className="play-test__hid">
        <h2>Rohzugriff (WebHID)</h2>
        <p className="play-test__empty">
          Dieser Browser unterstützt WebHID nicht. In Chrome oder Edge steht der Rohzugriff zur
          Verfügung.
        </p>
      </section>
    );
  }

  return (
    <section className="play-test__hid" data-testid="hid-probe">
      <h2>Rohzugriff (WebHID)</h2>

      {!source && (
        <>
          <p className="play-test__empty">
            Liest das Gerät direkt aus – ohne die Mapping-Schicht des Browsers. Damit werden auch
            Richtungen sichtbar, die die normale Gamepad-Schnittstelle verschluckt.
          </p>
          <button type="button" className="play-button" onClick={connect}>
            Controller per WebHID verbinden
          </button>
        </>
      )}

      {error && <p className="play-calibration__error">{error}</p>}

      {source && (
        <>
          <p className="play-test__values">
            {source.describe()} · empfangene Reports: <strong>{reportCount}</strong>
          </p>
          <p className="play-test__values" data-testid="hid-bytes">
            Bytes:{" "}
            <code>{bytes.length > 0 ? formatReportBytes(bytes) : "– noch nichts empfangen –"}</code>
          </p>
          <div data-testid="hid-changes">
            <h3>Änderungen (neueste zuerst)</h3>
            {changes.length === 0 ? (
              <p className="play-test__empty">– noch nichts registriert –</p>
            ) : (
              <ol>
                {[...changes].reverse().map((change) => (
                  <li key={`${change.t}-${change.byteIndex}-${change.to}`}>
                    [{change.t}ms] Byte {change.byteIndex}: {toHex(change.from)} →{" "}
                    {toHex(change.to)}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </>
      )}
    </section>
  );
}
