/**
 * Gemeinsamer, defensiver Zugriff auf `localStorage` – siehe
 * `.features/play-mode/design.md`, Abschnitt "Persistenz".
 *
 * Die Stores injizieren `StorageLike`, damit sie ohne Browser testbar sind;
 * `safeLocalStorage()` liefert die reale Instanz und überlebt blockierten oder
 * fehlenden Speicher (privater Modus, Quota).
 */

export type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function safeLocalStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}
