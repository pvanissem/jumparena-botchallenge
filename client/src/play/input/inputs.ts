/**
 * Logische Eingaben und Kalibrierungs-Schrittfolge des `/play`-Modus.
 *
 * Bewusst unabhängig von der konkreten Eingabequelle: Der Rohzugriff (WebHID)
 * bildet diese acht Eingaben ab, ohne dass hier etwas über Bytes, Buttons oder
 * Achsen bekannt sein muss.
 */

export const PLAY_INPUTS = [
  "left",
  "right",
  "up",
  "down",
  "jump",
  "sprint",
  "confirm",
  "back",
] as const;

export type PlayInput = (typeof PLAY_INPUTS)[number];

/** Abfragereihenfolge im Kalibrierungs-Assistenten. */
export const CALIBRATION_STEPS: readonly PlayInput[] = PLAY_INPUTS;

/** Beschriftung der Eingaben in der Oberfläche. */
export const INPUT_LABELS: Record<PlayInput, string> = {
  left: "LINKS",
  right: "RECHTS",
  up: "HOCH",
  down: "RUNTER",
  jump: "SPRUNG",
  sprint: "SPRINT",
  confirm: "BESTÄTIGEN / START",
  back: "ZURÜCK",
};

/** Die beiden Spielstationen (Bildschirmhälften). */
export type StationId = "left" | "right";

/** Reihenfolge der Stationen – zugleich die Zuordnung der Controller. */
export const STATION_IDS: readonly StationId[] = ["left", "right"];

/** Kurzform für HUD und Schaltflächen. */
export const STATION_SHORT_LABELS: Record<StationId, string> = {
  left: "Spieler 1",
  right: "Spieler 2",
};

/** Ausführliche Form inkl. Bildschirmseite (Assistent, Einrichtung). */
export const STATION_LABELS: Record<StationId, string> = {
  left: "Spieler 1 (LINKS)",
  right: "Spieler 2 (RECHTS)",
};
