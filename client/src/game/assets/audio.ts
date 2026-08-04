/**
 * Audio-Asset-Registry: Ladepfade und Textur-Keys für Hintergrundmusik und
 * Soundeffekte – analog zu `STATIC_IMAGE_SPECS` in `spriteSheets.ts`, damit
 * `RaceScene.preload()` nur noch iteriert (siehe
 * `.features/game-audio/design.md`, Abschnitt "assets/audio.ts").
 */
const BASE = "assets/Audio";

export const AUDIO_KEYS = {
  THEME: "theme",
  JUMP: "jump",
  COLLECT: "collect",
  DAMAGED: "damaged",
  PLAYER_DAMAGED: "playerdamaged",
  FALL: "fall",
  CHECKPOINT: "checkpoint",
  COMPLETE: "complete",
  BOINGO: "boingo",
} as const;

export type AudioKey = (typeof AUDIO_KEYS)[keyof typeof AUDIO_KEYS];

export interface AudioSpec {
  key: AudioKey;
  path: string;
}

export const AUDIO_SPECS: readonly AudioSpec[] = [
  { key: AUDIO_KEYS.THEME, path: `${BASE}/theme.mp3` },
  { key: AUDIO_KEYS.JUMP, path: `${BASE}/jump.mp3` },
  { key: AUDIO_KEYS.COLLECT, path: `${BASE}/collect.mp3` },
  { key: AUDIO_KEYS.DAMAGED, path: `${BASE}/damaged.mp3` },
  { key: AUDIO_KEYS.PLAYER_DAMAGED, path: `${BASE}/playerdamaged.mp3` },
  { key: AUDIO_KEYS.FALL, path: `${BASE}/fall.mp3` },
  { key: AUDIO_KEYS.CHECKPOINT, path: `${BASE}/checkpoint.mp3` },
  { key: AUDIO_KEYS.COMPLETE, path: `${BASE}/complete.mp3` },
  { key: AUDIO_KEYS.BOINGO, path: `${BASE}/boingo.mp3` },
];
