import Phaser from "phaser";
import { AUDIO_KEYS } from "../game/assets/audio";
import { preloadArenaAssets } from "../game/assets/preloadArenaAssets";
import { audioSettings } from "../game/audio/audioSettings";

export const MATCH_BOOT_SCENE_KEY = "match-boot";
/** Wird auf `game.events` gefeuert, sobald alle Arena-Assets geladen sind. */
export const MATCH_ASSETS_READY = "match-assets-ready";

/**
 * Lädt einmalig alle Arena-Assets und verantwortet die Hintergrundmusik des
 * gesamten Matches.
 *
 * Warum eine eigene Boot-Szene:
 * 1. Würden die vier Racer-Szenen gleichzeitig starten, würde jede dieselben
 *    Assets in die Ladewarteschlange stellen (die Existenzprüfung greift nicht,
 *    solange parallel geladen wird) – Phaser meldet dann massenhaft
 *    `Texture key already in use`.
 * 2. Das `ready`-Event des Spiels feuert, BEVOR Assets geladen sind. Ein
 *    `sound.add("theme")` zu diesem Zeitpunkt wirft
 *    `Audio key "theme" not found in cache`.
 *
 * Die Racer-Szenen laufen bewusst stumm (`audio: false`), damit Soundeffekte
 * bei vier Racern nicht vierfach übereinanderliegen und die Musik nicht stoppt,
 * sobald der erste Racer fertig ist.
 */
export class MatchBootScene extends Phaser.Scene {
  assetsReady = false;

  private music: Phaser.Sound.BaseSound | null = null;
  private unsubscribeAudio: (() => void) | null = null;

  constructor() {
    super(MATCH_BOOT_SCENE_KEY);
  }

  preload(): void {
    preloadArenaAssets(this);
  }

  create(): void {
    this.assetsReady = true;
    this.game.events.emit(MATCH_ASSETS_READY);
    this.startMusic();
  }

  /**
   * Browser blockieren Audio bis zur ersten Nutzerinteraktion. Phaser meldet
   * das über `sound.locked` + `UNLOCKED`-Event – ohne diese Behandlung
   * protokolliert der Browser "The AudioContext was not allowed to start".
   */
  private startMusic(): void {
    if (this.sound.locked) {
      this.sound.once(Phaser.Sound.Events.UNLOCKED, () => this.playMusic());
      return;
    }
    this.playMusic();
  }

  private playMusic(): void {
    if (this.music) return;

    this.music = this.sound.add(AUDIO_KEYS.THEME, {
      loop: true,
      volume: audioSettings.getEffectiveVolume(),
    });
    this.music.play();
    this.applyVolume();
    this.unsubscribeAudio = audioSettings.subscribe(() => this.applyVolume());
  }

  private applyVolume(): void {
    (this.music as Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound | null)?.setVolume(
      audioSettings.getEffectiveVolume()
    );
  }

  shutdown(): void {
    this.music?.stop();
    this.music = null;
    this.unsubscribeAudio?.();
    this.unsubscribeAudio = null;
  }
}
