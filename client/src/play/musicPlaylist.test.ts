import { describe, expect, it } from "vitest";
import { AUDIO_KEYS } from "../game/assets/audio";
import { createMusicPlaylist, PLAY_MUSIC_KEYS, shuffle } from "./musicPlaylist";

/** Deterministischer Zufall für reproduzierbare Tests. */
function sequenceRandom(values: number[]): () => number {
  let index = 0;
  return () => values[index++ % values.length];
}

describe("shuffle", () => {
  it("behält alle Elemente", () => {
    const result = shuffle([1, 2, 3, 4, 5], sequenceRandom([0.1, 0.7, 0.3, 0.9]));
    expect([...result].sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it("verändert die Eingabeliste nicht", () => {
    const input = [1, 2, 3];
    shuffle(input, sequenceRandom([0.5]));
    expect(input).toEqual([1, 2, 3]);
  });

  it("mischt tatsächlich um", () => {
    // Zufallswert 0 wählt stets Position 0 als Tauschpartner – das vertauscht
    // die Liste garantiert (0.99 wäre dagegen die Identität: jede Position
    // tauscht mit sich selbst).
    expect(shuffle([1, 2, 3], sequenceRandom([0]))).not.toEqual([1, 2, 3]);
  });

  it("kommt mit einem einzelnen Element zurecht", () => {
    expect(shuffle([7], sequenceRandom([0.4]))).toEqual([7]);
  });

  it("kommt mit einer leeren Liste zurecht", () => {
    expect(shuffle([], sequenceRandom([0.4]))).toEqual([]);
  });
});

describe("createMusicPlaylist", () => {
  const tracks = ["a", "b", "c", "d"];

  it("liefert jeden Titel einmal, bevor sich etwas wiederholt", () => {
    const playlist = createMusicPlaylist(tracks, sequenceRandom([0.3, 0.8, 0.1, 0.6]));
    const played = tracks.map(() => playlist.next());
    expect([...played].sort()).toEqual([...tracks].sort());
  });

  it("spielt nach einer vollen Runde erneut alle Titel", () => {
    const playlist = createMusicPlaylist(tracks, sequenceRandom([0.3, 0.8, 0.1, 0.6]));
    for (const _ of tracks) playlist.next();
    const second = tracks.map(() => playlist.next());
    expect([...second].sort()).toEqual([...tracks].sort());
  });

  it("wiederholt beim Rundenwechsel nicht denselben Titel direkt", () => {
    // Über viele Runden hinweg darf nie zweimal derselbe Titel folgen.
    const playlist = createMusicPlaylist(tracks, Math.random);
    let previous = playlist.next();
    for (let round = 0; round < 200; round++) {
      const current = playlist.next();
      expect(current).not.toBe(previous);
      previous = current;
    }
  });

  it("liefert bei nur einem Titel immer diesen", () => {
    const playlist = createMusicPlaylist(["solo"], Math.random);
    expect([playlist.next(), playlist.next(), playlist.next()]).toEqual(["solo", "solo", "solo"]);
  });

  it("liefert ohne Titel null", () => {
    expect(createMusicPlaylist([], Math.random).next()).toBeNull();
  });

  it("meldet den zuletzt gelieferten Titel", () => {
    const playlist = createMusicPlaylist(tracks, Math.random);
    const track = playlist.next();
    expect(playlist.current()).toBe(track);
  });
});

describe("PLAY_MUSIC_KEYS", () => {
  it("enthält mehrere Titel zum Mischen", () => {
    expect(PLAY_MUSIC_KEYS.length).toBeGreaterThan(1);
  });

  it("nutzt ausschließlich vorhandene Audio-Schlüssel", () => {
    const known = new Set<string>(Object.values(AUDIO_KEYS));
    for (const key of PLAY_MUSIC_KEYS) expect(known.has(key)).toBe(true);
  });

  it("enthält keinen Titel doppelt", () => {
    expect(new Set(PLAY_MUSIC_KEYS).size).toBe(PLAY_MUSIC_KEYS.length);
  });
});
