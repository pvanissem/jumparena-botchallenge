import type { TournamentShowState, TournamentState } from "@arena/shared";
import Phaser from "phaser";
import { useEffect, useRef } from "react";
import { getSharedAudioContext } from "./sharedAudioContext";
import { TournamentMusicScene } from "./TournamentMusicScene";
import { selectTournamentMusicKey, type TournamentMusicKey } from "./tournamentMusic";

export interface TournamentMusicRuntime {
  setTrack(key: TournamentMusicKey | null): void;
  destroy(): void;
}

export type TournamentMusicRuntimeFactory = () => TournamentMusicRuntime;

function createTournamentMusicRuntime(): TournamentMusicRuntime {
  const scene = new TournamentMusicScene();
  const context = getSharedAudioContext();
  const game = new Phaser.Game({
    type: Phaser.HEADLESS,
    width: 1,
    height: 1,
    scene: [scene],
    audio: context ? { context } : undefined,
  });

  return {
    setTrack: (key) => scene.setTrack(key),
    destroy: () => {
      scene.shutdown();
      game.destroy(true);
    },
  };
}

export function useTournamentMusic(
  tournament: TournamentState | null,
  show: TournamentShowState | null,
  createRuntime: TournamentMusicRuntimeFactory = createTournamentMusicRuntime
): void {
  const runtimeRef = useRef<TournamentMusicRuntime | null>(null);
  const selectedTrack = selectTournamentMusicKey(tournament, show);

  useEffect(() => {
    const runtime = createRuntime();
    runtimeRef.current = runtime;
    return () => {
      runtime.destroy();
      runtimeRef.current = null;
    };
  }, [createRuntime]);

  useEffect(() => {
    runtimeRef.current?.setTrack(selectedTrack);
  }, [selectedTrack]);
}
