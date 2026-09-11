/**
 * Verwaltet die WebHID-Controller der `/play`-Seite – siehe
 * `.features/play-mode-webhid/bugfix.md`.
 *
 * Aufgaben:
 * - bereits freigegebene Geräte beim Laden automatisch wieder öffnen
 *   (WebHID merkt sich die Freigabe je Herkunft – am Stand also kein Dialog
 *   nach jedem Neustart),
 * - neue Geräte über den Browser-Dialog hinzufügen,
 * - Zuordnung Gerät → Station.
 */
import { useCallback, useEffect, useState } from "react";
import { HidSource } from "./input/hid/HidSource";
import { hidDeviceKey } from "./input/hid/hidMapping";
import { getHidApi, type HidDeviceLike } from "./input/hid/hidTypes";
import { STATION_IDS, type StationId } from "./input/inputs";

export interface HidStationDevice {
  source: HidSource;
  deviceKey: string;
  label: string;
}

export interface UseHidDevicesResult {
  devices: HidStationDevice[];
  error: string | null;
  supported: boolean;
  /** Öffnet den Browser-Dialog zur Geräteauswahl. */
  requestDevice: () => Promise<void>;
}

async function openDevice(device: HidDeviceLike): Promise<HidStationDevice | null> {
  try {
    const source = new HidSource(device);
    await source.start();
    return {
      source,
      deviceKey: hidDeviceKey(device),
      label: device.productName || "HID-Controller",
    };
  } catch {
    return null;
  }
}

export function useHidDevices(): UseHidDevicesResult {
  const [devices, setDevices] = useState<HidStationDevice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const hid = getHidApi();

  // Bereits freigegebene Geräte ohne Dialog wieder aufnehmen.
  useEffect(() => {
    if (!hid) return;
    let cancelled = false;

    void hid.getDevices().then(async (granted) => {
      const opened = (await Promise.all(granted.map(openDevice))).filter(
        (entry): entry is HidStationDevice => entry !== null
      );
      if (!cancelled) setDevices(opened);
    });

    return () => {
      cancelled = true;
    };
  }, [hid]);

  const requestDevice = useCallback(async () => {
    if (!hid) {
      setError("Dieser Browser unterstützt WebHID nicht.");
      return;
    }

    try {
      const chosen = await hid.requestDevice({ filters: [] });
      const device = chosen[0];
      if (!device) {
        setError("Kein Gerät ausgewählt.");
        return;
      }

      const opened = await openDevice(device);
      if (!opened) {
        setError("Gerät konnte nicht geöffnet werden.");
        return;
      }

      setError(null);
      setDevices((current) =>
        current.some((entry) => entry.source === opened.source) ? current : [...current, opened]
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }, [hid]);

  return { devices, error, supported: hid !== null, requestDevice };
}

/** Gerät einer Station zuordnen: erstes Gerät links, zweites rechts. */
export function deviceForStation(
  devices: readonly HidStationDevice[],
  stationId: StationId
): HidStationDevice | null {
  return devices[STATION_IDS.indexOf(stationId)] ?? null;
}
