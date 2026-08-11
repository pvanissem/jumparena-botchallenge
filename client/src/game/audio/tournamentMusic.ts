import type { TournamentShowState, TournamentState } from "@arena/shared";
import { AUDIO_KEYS } from "../assets/audio";

export type TournamentMusicKey =
  | typeof AUDIO_KEYS.THEME
  | typeof AUDIO_KEYS.THEME_2
  | typeof AUDIO_KEYS.THEME_3
  | typeof AUDIO_KEYS.EPIC
  | typeof AUDIO_KEYS.END;

export const TOURNAMENT_MUSIC_KEYS: readonly TournamentMusicKey[] = [
  AUDIO_KEYS.THEME,
  AUDIO_KEYS.THEME_2,
  AUDIO_KEYS.THEME_3,
  AUDIO_KEYS.EPIC,
  AUDIO_KEYS.END,
];

export function selectTournamentMusicKey(
  tournament: TournamentState | null,
  show: TournamentShowState | null
): TournamentMusicKey | null {
  if (!tournament || !show) return null;
  if (show.phase !== "match-running") return AUDIO_KEYS.END;
  if (show.activeRoundIndex === null) return AUDIO_KEYS.THEME;

  const distanceToFinal = tournament.rounds.length - 1 - show.activeRoundIndex;
  if (distanceToFinal === 0) return AUDIO_KEYS.EPIC;
  if (distanceToFinal === 1) return AUDIO_KEYS.THEME_3;
  if (distanceToFinal === 2) return AUDIO_KEYS.THEME_2;
  return AUDIO_KEYS.THEME;
}
