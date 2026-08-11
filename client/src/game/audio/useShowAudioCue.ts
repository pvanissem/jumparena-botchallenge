import type { TournamentShowState } from "@arena/shared";
import { useEffect, useRef } from "react";
import { audioSettings } from "./audioSettings";

type AudioPlayer = (src: string, volume: number) => Promise<unknown>;

function defaultPlayer(src: string, volume: number): Promise<unknown> {
  const audio = new Audio(src);
  audio.volume = volume;
  return audio.play();
}

function cueFor(show: TournamentShowState): string | null {
  if (show.phase === "matchup-intro") return "/assets/Audio/boingo.mp3";
  if (show.phase === "match-result" || show.phase === "champion") {
    return "/assets/Audio/complete.mp3";
  }
  return null;
}

export function useShowAudioCue(
  show: TournamentShowState | null,
  play: AudioPlayer = defaultPlayer
): void {
  const playedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!show) return;
    const cue = cueFor(show);
    if (!cue) return;
    const key = `${show.phase}:${show.activeMatchId ?? "tournament"}`;
    if (playedKeyRef.current === key) return;
    playedKeyRef.current = key;

    const volume = audioSettings.getEffectiveVolume();
    if (volume <= 0) return;
    void play(cue, volume).catch(() => {
      // Browser können Autoplay blockieren; die Show darf dadurch nie stoppen.
    });
  }, [play, show]);
}
