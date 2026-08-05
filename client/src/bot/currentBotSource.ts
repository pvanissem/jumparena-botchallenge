/**
 * Bot-Quelltext als Rohstring (Vite-`?raw`-Import). Bewusst nicht
 * unit-getestet: `?raw`-Import + `import.meta.hot` sind laufzeit-/
 * Vite-spezifisch (analog zu sandbox/botWorker.ts), manuell verifiziert
 * (siehe .features/dev-station-mode/design.md, Test-Strategie).
 *
 * Jede Änderung an current-bot.js löst einen vollständigen Seiten-Reload
 * aus (statt partiellem Hot-Swap) - dadurch starten Level, Racer-State und
 * BotRunner/Worker garantiert komplett frisch, ohne Sonderfall-Logik in
 * ArenaView/RaceScene.
 */
import currentBotSource from "./current-bot.js?raw";

if (import.meta.hot) {
  import.meta.hot.accept(() => {
    window.location.reload();
  });
}

export { currentBotSource };
