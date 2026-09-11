/**
 * Boot-Szene des `/play`-Modus – siehe `.features/play-mode/design.md`,
 * Abschnitt "Musik & Assets".
 *
 * Zwei Aufgaben, beide bewusst EINMAL zentral statt je Station:
 * 1. Arena-Assets laden (sonst laden beide Racer-Szenen dieselben Keys
 *    parallel – vgl. `MatchBootScene`).
 * 2. Hintergrundmusik abspielen – gemischt über alle Titel (siehe
 *    `musicPlaylist.ts`). Die Racer-Szenen laufen mit
 *    `audio: {music:false, sfx:true}`, sonst liefe die Musik doppelt (US-5).
 */
import Phaser from "phaser";
import { preloadArenaAssets } from "../game/assets/preloadArenaAssets";
import { type AudioSettingsStore, audioSettings } from "../game/audio/audioSettings";
import { createMusicPlaylist, type MusicPlaylist, PLAY_MUSIC_KEYS } from "./musicPlaylist";
import { PLAY_ASSETS_READY, PLAY_BOOT_SCENE_KEY } from "./playBootKeys";

export { PLAY_ASSETS_READY, PLAY_BOOT_SCENE_KEY };

export class PlayBootScene extends Phaser.Scene {
  assetsReady = false;
  private music: Phaser.Sound.BaseSound | null = null;
  private unsubscribeAudio: (() => void) | null = null;
  private unlockPending = false;
  private running = false;
  private readonly playlist: MusicPlaylist;

  constructor(
    private readonly settings: AudioSettingsStore = audioSettings,
    playlist: MusicPlaylist = createMusicPlaylist(PLAY_MUSIC_KEYS)
  ) {
    super(PLAY_BOOT_SCENE_KEY);
    this.playlist = playlist;
  }

  preload(): void {
    preloadArenaAssets(this);
  }

  create(): void {
    this.assetsReady = true;
    this.game.events.emit(PLAY_ASSETS_READY);

    this.running = true;
    this.unsubscribeAudio = this.settings.subscribe(() => this.applyVolume());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.shutdown());
    this.playNext();
  }

  /**
   * Spielt den nächsten Titel der gemischten Liste. Bewusst OHNE `loop`: Erst
   * dadurch kann am Ende eines Titels auf den nächsten gewechselt werden.
   */
  private playNext(): void {
    if (!this.running) return;

    // Browser-Autoplay-Policy: Vor der ersten Nutzerinteraktion ist der
    // AudioContext gesperrt. Gamepad-Eingaben entsperren ihn NICHT – deshalb
    // wird am Stand ohnehin einmal per Maus/Tastatur interagiert.
    if (this.sound.locked) {
      if (!this.unlockPending) {
        this.unlockPending = true;
        this.sound.once(Phaser.Sound.Events.UNLOCKED, () => {
          this.unlockPending = false;
          this.playNext();
        });
      }
      return;
    }

    const key = this.playlist.next();
    if (!key) return;

    try {
      this.music?.destroy?.();
      this.music = this.sound.add(key, {
        loop: false,
        volume: this.settings.getEffectiveVolume(),
      });
      this.music.once(Phaser.Sound.Events.COMPLETE, () => this.playNext());
      this.music.play();
      this.applyVolume();
    } catch {
      this.music = null;
    }
  }

  private applyVolume(): void {
    (this.music as Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound | null)?.setVolume(
      this.settings.getEffectiveVolume()
    );
  }

  shutdown(): void {
    this.running = false;
    this.music?.stop();
    this.music = null;
    this.unsubscribeAudio?.();
    this.unsubscribeAudio = null;
  }
}
