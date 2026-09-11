/**
 * Logischer Eingabe-Snapshot und Flankenerkennung – quellenunabhängig.
 *
 * Der Snapshot ist die gemeinsame Sprache zwischen Eingabequelle (Rohzugriff
 * per WebHID) und Spiel-/Menülogik.
 */
import { PLAY_INPUTS, type PlayInput } from "./inputs";

/** Zustand aller acht logischen Eingaben für genau einen Zeitpunkt. */
export type InputSnapshot = Record<PlayInput, boolean>;

export function emptySnapshot(): InputSnapshot {
  return {
    left: false,
    right: false,
    up: false,
    down: false,
    jump: false,
    sprint: false,
    confirm: false,
    back: false,
  };
}

/**
 * Steigende Flanken zwischen zwei Snapshots: nur Eingaben, die JETZT aktiv
 * sind und es vorher nicht waren. Grundlage dafür, dass Menü-Eingaben genau
 * einmal pro Tastendruck wirken (US-2) – ohne Timer/Entprell-Heuristik.
 */
export function risingEdges(previous: InputSnapshot | null, next: InputSnapshot): InputSnapshot {
  const edges = emptySnapshot();
  for (const input of PLAY_INPUTS) {
    edges[input] = next[input] && !(previous?.[input] ?? false);
  }
  return edges;
}

/** Ob irgendeine der acht Eingaben aktiv ist. */
export function hasAnyInput(snapshot: InputSnapshot): boolean {
  return PLAY_INPUTS.some((input) => snapshot[input]);
}
