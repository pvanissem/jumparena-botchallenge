/**
 * Szenen-Schlüssel und Ereignisname der `PlayBootScene`.
 *
 * Bewusst in einem eigenen, Phaser-freien Modul: `StationSceneHost` braucht
 * nur diese beiden Konstanten. Würde er `PlayBootScene` importieren, zöge er
 * Phaser in jeden Test mit hinein.
 */

export const PLAY_BOOT_SCENE_KEY = "play-boot";

/** Wird auf `game.events` gefeuert, sobald alle Arena-Assets geladen sind. */
export const PLAY_ASSETS_READY = "play-assets-ready";
