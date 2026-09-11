/**
 * Arcade-Namenseingabe (8 Zeichen, Carousel) – siehe
 * `.features/play-mode/design.md`, Abschnitt "Namenseingabe" (US-2).
 *
 * Pur und ohne Auto-Repeat: Der Reducer wird ausschließlich mit FLANKEN
 * gefüttert (siehe `risingEdges`), dadurch gilt "einmal pro Tastendruck"
 * strukturell – ohne Entprell-Timer.
 */

export const NAME_LENGTH = 8;
export const NAME_CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ";
export const DEFAULT_PLAYER_NAME = "GAST";

export interface NameEntryState {
  chars: string[];
  cursor: number;
}

export type NameEntryEvent = { type: "up" | "down" | "left" | "right" };

export function createNameEntryState(): NameEntryState {
  return { chars: Array<string>(NAME_LENGTH).fill(NAME_CHARSET[0]), cursor: 0 };
}

function shiftChar(char: string, offset: number): string {
  const index = NAME_CHARSET.indexOf(char);
  const base = index < 0 ? 0 : index;
  const next = (base + offset + NAME_CHARSET.length) % NAME_CHARSET.length;
  return NAME_CHARSET[next];
}

export function nameEntryReducer(state: NameEntryState, event: NameEntryEvent): NameEntryState {
  switch (event.type) {
    case "left":
      return { ...state, cursor: Math.max(0, state.cursor - 1) };
    case "right":
      return { ...state, cursor: Math.min(NAME_LENGTH - 1, state.cursor + 1) };
    case "up":
    case "down": {
      const chars = [...state.chars];
      chars[state.cursor] = shiftChar(chars[state.cursor], event.type === "down" ? 1 : -1);
      return { ...state, chars };
    }
  }
}

/** Fertiger Anzeigename; nur Leerzeichen ⇒ neutraler Standardname (US-2). */
export function finalizeName(state: NameEntryState): string {
  const name = state.chars.join("").trim();
  return name.length > 0 ? name : DEFAULT_PLAYER_NAME;
}
