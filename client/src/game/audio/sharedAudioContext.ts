/**
 * Liefert einen app-weit einzigen `AudioContext`, den alle `Phaser.Game`-
 * Instanzen über `new Phaser.Game({ audio: { context } })` teilen (siehe
 * `ArenaView.tsx`).
 *
 * Hintergrund/Bugfix: Jeder Level-Wechsel bzw. "↻ Neu" mountet `ArenaView`
 * über den `key`-Mechanismus komplett neu (siehe `DevPage.tsx`) und zerstört
 * dabei das alte `Phaser.Game` (`game.destroy(true)`). Ohne diesen geteilten
 * Context erzeugt Phasers `WebAudioSoundManager#createAudioContext` bei jedem
 * Neu-Mount einen BRANDNEUEN `AudioContext` (siehe
 * node_modules/phaser/src/sound/webaudio/WebAudioSoundManager.js), der per
 * Browser-Autoplay-Policy wieder im Zustand `suspended` startet und eine
 * ERNEUTE Nutzer-Geste zum Entsperren braucht (vgl.
 * `.features/game-audio-unlock-hint/bugfix.md`). Die Geste, die den
 * Level-Wechsel/Neustart ausgelöst hat, ist zu diesem Zeitpunkt aber bereits
 * abgeschlossen (React-Effects laufen erst NACH dem Event) - der neue Context
 * bleibt also gesperrt, bis eine weitere, komplett separate Interaktion
 * passiert. Das erweckt genau den Eindruck, Lautstärke/Mute würden "nach
 * einem Level-Wechsel wieder nicht live funktionieren".
 *
 * Mit einem einzigen, wiederverwendeten `AudioContext` (der genau einmal pro
 * Seitenaufruf entsperrt werden muss) bleibt der Entsperrt-Zustand über
 * beliebig viele Neustarts/Level-Wechsel hinweg erhalten, weil
 * `createAudioContext` bei übergebenem `audioConfig.context` lediglich
 * `context.resume()` aufruft, statt einen neuen Context zu instanziieren.
 */
function createAudioContext(): AudioContext | undefined {
  if (typeof window === "undefined") return undefined;

  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  return Ctor ? new Ctor() : undefined;
}

let sharedContext: AudioContext | undefined;

export function getSharedAudioContext(): AudioContext | undefined {
  if (!sharedContext) {
    sharedContext = createAudioContext();
  }
  return sharedContext;
}
