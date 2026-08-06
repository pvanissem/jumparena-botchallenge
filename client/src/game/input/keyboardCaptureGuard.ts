/**
 * Fängt die Spieltasten auf DOM-Ebene ab, damit der Browser sie nicht mehr
 * interpretiert (Textselektion, Scrollen, Aktivieren fokussierter Buttons).
 *
 * Hintergrund: Phasers `KeyboardManager` ruft `preventDefault()` nur für
 * *unmodifizierte* Tastendrücke auf. Sprint ist bei uns aber Shift + Pfeil und
 * fällt damit durchs Raster. Siehe `.features/keyboard-input-capture/bugfix.md`.
 */

/** Tasten (KeyboardEvent.key), deren Browser-Default unterdrückt wird. */
export const GAME_KEYS: readonly string[] = [
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  " ",
  "Spacebar", // Legacy-Alias älterer Browser
  "Shift",
];

const GAME_KEY_SET = new Set<string>(GAME_KEYS);

/** `<input>`-Typen, in denen ein Caret steht und Pfeile/Space Text bedeuten. */
const TEXT_INPUT_TYPES = new Set([
  "text",
  "search",
  "url",
  "tel",
  "email",
  "password",
  "number",
  "date",
  "datetime-local",
  "month",
  "time",
  "week",
]);

function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement) return true;
  if (target instanceof HTMLInputElement) return TEXT_INPUT_TYPES.has(target.type);
  return false;
}

/**
 * Registriert die Listener und liefert eine (idempotente) Cleanup-Funktion
 * zurück.
 *
 * WICHTIG - Reihenfolge: Die Listener laufen in der **Bubble-Phase** auf
 * `window`, also in derselben Phase wie Phasers `KeyboardManager`. Phasers
 * Handler verwirft jedes Event mit gesetztem `event.defaultPrevented`
 * (`phaser.js:122550`) - würden wir in der Capture-Phase abbrechen, käme bei
 * Phaser gar kein Tastendruck mehr an und die Steuerung wäre tot.
 *
 * Deshalb MUSS dieser Guard erst installiert werden, NACHDEM die Phaser-Szene
 * bereit ist (siehe `ArenaView`, `onReady`): Listener derselben Phase feuern in
 * Registrierungsreihenfolge, wir laufen also als Letzte. `preventDefault()` am
 * Ende der Bubble-Kette unterdrückt die Default-Aktion des Browsers trotzdem
 * noch zuverlässig.
 *
 * Bewusst KEIN `stopPropagation()`: Phaser und `useAudioUnlockHint` müssen das
 * Event weiterhin sehen.
 */
export function installKeyboardCaptureGuard(target: EventTarget = window): () => void {
  const handle = (event: Event) => {
    const keyboardEvent = event as KeyboardEvent;
    if (!GAME_KEY_SET.has(keyboardEvent.key)) return;
    if (isTextEntryTarget(keyboardEvent.target)) return;

    keyboardEvent.preventDefault();

    // Ein per Maus fokussiertes Bedienelement (Button/Select/Slider) würde
    // Folgeeingaben abfangen - Fokus zurück an den Body geben.
    if (keyboardEvent.type === "keydown") {
      const active = document.activeElement;
      if (active instanceof HTMLElement && active !== document.body && !isTextEntryTarget(active)) {
        active.blur();
      }
    }
  };

  target.addEventListener("keydown", handle, false);
  target.addEventListener("keyup", handle, false);

  let removed = false;
  return () => {
    if (removed) return;
    removed = true;
    target.removeEventListener("keydown", handle, false);
    target.removeEventListener("keyup", handle, false);
  };
}
