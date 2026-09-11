/**
 * Gemischte Hintergrundmusik für den `/play`-Modus.
 *
 * Pur und ohne Phaser: Die Reihenfolge entsteht hier, das Abspielen übernimmt
 * `PlayBootScene`. Der Zufallsgenerator wird injiziert, damit die Reihenfolge
 * im Test reproduzierbar ist.
 */
import { AUDIO_KEYS, type AudioKey } from "../game/assets/audio";

/** Alle Titel, die am Stand in Frage kommen (Reihenfolge egal – wird gemischt). */
export const PLAY_MUSIC_KEYS: readonly AudioKey[] = [
  AUDIO_KEYS.THEME,
  AUDIO_KEYS.THEME_2,
  AUDIO_KEYS.THEME_3,
  AUDIO_KEYS.EPIC,
  AUDIO_KEYS.END,
];

/** Fisher-Yates – gleichverteilt und ohne die Eingabe zu verändern. */
export function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

export interface MusicPlaylist {
  /** Nächster Titel – oder `null`, wenn es keine Titel gibt. */
  next(): string | null;
  /** Zuletzt gelieferter Titel. */
  current(): string | null;
}

/**
 * Endlose, gemischte Wiedergabeliste: Jeder Titel kommt einmal pro Runde dran,
 * danach wird neu gemischt. Beim Rundenwechsel wird sichergestellt, dass nicht
 * zweimal hintereinander derselbe Titel läuft.
 */
export function createMusicPlaylist(
  tracks: readonly string[],
  random: () => number = Math.random
): MusicPlaylist {
  let queue: string[] = [];
  let last: string | null = null;

  function refill(): void {
    queue = shuffle(tracks, random);

    // Direktwiederholung über die Rundengrenze hinweg vermeiden.
    if (tracks.length > 1 && queue[0] === last) {
      queue.push(queue.shift() as string);
    }
  }

  return {
    next() {
      if (tracks.length === 0) return null;
      if (queue.length === 0) refill();

      last = queue.shift() ?? null;
      return last;
    },
    current() {
      return last;
    },
  };
}
