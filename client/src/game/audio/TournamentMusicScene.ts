import Phaser from "phaser";
import { AUDIO_SPECS } from "../assets/audio";
import { type AudioSettingsStore, audioSettings } from "./audioSettings";
import { TOURNAMENT_MUSIC_KEYS, type TournamentMusicKey } from "./tournamentMusic";

export const TOURNAMENT_MUSIC_SCENE_KEY = "tournament-music";

const musicKeys = new Set<string>(TOURNAMENT_MUSIC_KEYS);

export class TournamentMusicScene extends Phaser.Scene {
  private desiredKey: TournamentMusicKey | null = null;
  private currentKey: TournamentMusicKey | null = null;
  private music: Phaser.Sound.BaseSound | null = null;
  private ready = false;
  private unlockPending = false;
  private unsubscribeAudio: (() => void) | null = null;

  constructor(private readonly settings: AudioSettingsStore = audioSettings) {
    super(TOURNAMENT_MUSIC_SCENE_KEY);
  }

  preload(): void {
    for (const spec of AUDIO_SPECS) {
      if (!musicKeys.has(spec.key) || this.cache.audio.exists(spec.key)) continue;
      this.load.audio(spec.key, spec.path);
    }
  }

  create(): void {
    this.ready = true;
    this.unsubscribeAudio = this.settings.subscribe(() => this.applyVolume());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.shutdown());
    this.syncTrack();
  }

  setTrack(key: TournamentMusicKey | null): void {
    if (key === this.desiredKey) return;
    this.desiredKey = key;
    this.syncTrack();
  }

  shutdown(): void {
    this.ready = false;
    this.stopCurrentTrack();
    this.unsubscribeAudio?.();
    this.unsubscribeAudio = null;
  }

  private syncTrack(): void {
    if (!this.ready || this.desiredKey === this.currentKey) return;

    this.stopCurrentTrack();
    if (!this.desiredKey) return;

    if (this.sound.locked) {
      if (!this.unlockPending) {
        this.unlockPending = true;
        this.sound.once(Phaser.Sound.Events.UNLOCKED, () => {
          this.unlockPending = false;
          this.syncTrack();
        });
      }
      return;
    }

    try {
      const key = this.desiredKey;
      this.music = this.sound.add(key, {
        loop: true,
        volume: this.settings.getEffectiveVolume(),
      });
      this.currentKey = key;
      this.music.play();
      this.applyVolume();
    } catch {
      this.music = null;
      this.currentKey = null;
    }
  }

  private stopCurrentTrack(): void {
    this.music?.stop();
    this.music = null;
    this.currentKey = null;
  }

  private applyVolume(): void {
    (this.music as Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound | null)?.setVolume(
      this.settings.getEffectiveVolume()
    );
  }
}
