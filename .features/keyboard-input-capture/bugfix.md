# Bugfix: Spieltasten werden nicht zuverlässig vom Browser abgefangen

## Aktuelles Verhalten (Bug)

Während eines Laufs im Tastatur-Modus (`/dev`) reagiert der Browser weiterhin auf die
Spieltasten:

- Beim Drücken/Halten von **Shift** (Sprint) wandert der Fokus bzw. es passiert
  "Browser-Quatsch" (Fokus-Ringe, Textselektion, Caret-Bewegung).
- Bei **Shift + Pfeiltaste** (Sprint + Laufen) selektiert der Browser Text auf der Seite
  bzw. scrollt.
- **Space** kann ein zuvor per Maus geklicktes DOM-Element (z.B. `↻ Neu`,
  `pixel-btn`, `pixel-select`) erneut auslösen, weil dieses noch den Fokus hält.

## Erwartetes Verhalten

- WHEN eine Taste aus dem Spiel-Tastensatz (`ArrowLeft`, `ArrowRight`, `ArrowUp`,
  `ArrowDown`, `Space`, `Shift`) gedrückt oder losgelassen wird, während die Arena
  gemountet ist, SHALL DAS SYSTEM den Browser-Default unterdrücken
  (`preventDefault()`), unabhängig davon, ob gleichzeitig ein Modifier (Shift/Alt/
  Ctrl/Meta) aktiv ist.
- WHEN eine solche Taste gedrückt wird, während der Fokus auf einem nicht-textuellen
  Bedienelement liegt (Button, Select, Range-Slider, `tabIndex`-Element), SHALL DAS
  SYSTEM verhindern, dass dieses Element aktiviert oder verändert wird.
- WHEN die Arena unmountet wird (Levelwechsel/Remount, Verlassen der Seite), SHALL DAS
  SYSTEM alle dafür registrierten DOM-Listener wieder entfernen.

## Was bleibt unverändert (Regressions-Schutz)

- Die Spielsteuerung selbst (`KeyboardController.getInput()`, Polling über `isDown`)
  bleibt unverändert – es wird nur der Browser-Default unterdrückt, die Phaser-Key-
  States müssen weiter korrekt gesetzt werden.
- Tasten außerhalb des Spiel-Tastensatzes (Tab, Enter, F5, Ctrl/Cmd+R, Cmd+Shift+I,
  Buchstaben) bleiben unangetastet – Navigation, Reload und DevTools müssen am Stand
  weiter funktionieren.
- WHEN der Fokus in einem echten Texteingabefeld liegt (`<input type="text">`,
  `<textarea>`, `contenteditable`), SHALL DAS SYSTEM keine Tasten unterdrücken.
  (Aktuell existiert kein solches Feld, die Ausnahme ist Zukunftssicherung.)
- `useAudioUnlockHint` lauscht weiterhin auf `keydown` und muss weiter ausgelöst
  werden (der Guard ruft nur `preventDefault`, kein `stopPropagation`).
- Bestehende Tests (u.a. `AudioControls.test.tsx`, `KeyboardController.test.ts`)
  bleiben grün.

## Root Cause (nach Analyse)

`RaceScene.createController()` (`client/src/game/scenes/RaceScene.ts:251`) nutzt
`this.input.keyboard.createCursorKeys()`. Das registriert via `addKeys(..., enableCapture=true)`
zwar Captures für UP/DOWN/LEFT/RIGHT/SPACE/SHIFT, aber Phasers `KeyboardManager`
unterdrückt den Browser-Default nur für **unmodifizierte** Tastendrücke
(`node_modules/phaser/dist/phaser.js:122560` und `:122580`):

```js
var modified = (event.altKey || event.ctrlKey || event.shiftKey || event.metaKey);
if (_this.preventDefault && !modified && _this.captures.indexOf(event.keyCode) > -1) {
    event.preventDefault();
}
```

Da `Shift` selbst `event.shiftKey === true` setzt und Sprint per Definition
Shift + Pfeil ist, greift Phasers `preventDefault` für genau die Sprint-Eingaben nie.
Zusätzlich fehlt eine Fokus-Behandlung: nach einem Mausklick auf `pixel-btn`/
`pixel-select` bleibt der Fokus auf dem DOM-Element und Space aktiviert es erneut.

## Getroffene Entscheidungen (Freigabe im Chat)

- **Geltungsbereich:** Der Guard ist immer aktiv, solange die Arena gemountet ist –
  unabhängig vom `controlMode`. Kein Modus-State im Guard.
- **UI-Controls:** Das Spiel hat Vorrang. Lautstärke-Slider und Level-Select sind
  während sichtbarer Arena nicht mehr per Pfeiltasten bedienbar (Messestand-Kontext:
  Bedienung per Maus/Touch). Bewusst akzeptiert.

## Fix-Ansatz

Neues Modul `client/src/game/input/keyboardCaptureGuard.ts` (reine DOM-Logik, ohne
Phaser-Abhängigkeit → gut unit-testbar mit jsdom):

```ts
/** Tasten, deren Browser-Default während eines Laufs unterdrückt wird. */
export const GAME_KEYS: readonly string[];

/** Registriert die Capture-Listener und liefert eine Cleanup-Funktion. */
export function installKeyboardCaptureGuard(target?: Window | Document): () => void;
```

Verhalten:

1. `keydown`/`keyup` werden in der **Bubble-Phase** auf `window` registriert –
   derselben Phase, in der auch Phasers `KeyboardManager` lauscht.

   **Kritisch:** Phasers Handler verwirft jedes Event mit gesetztem
   `event.defaultPrevented` (`phaser.js:122550`):

   ```js
   if (event.defaultPrevented || !_this.enabled || !_this.manager) { return; }
   ```

   Ein Guard in der Capture-Phase würde Phaser also komplett aussperren – die
   Steuerung wäre tot. Deshalb wird der Guard **erst in `onReady`** installiert,
   also nachdem Phasers Listener registriert sind. Listener derselben Phase
   feuern in Registrierungsreihenfolge, unser Handler läuft damit als Letzter.
   `preventDefault()` am Ende der Bubble-Kette unterdrückt die Default-Aktion
   trotzdem noch zuverlässig, da diese erst nach Abarbeitung aller Listener
   ausgeführt wird.
2. Ist `event.key` in `GAME_KEYS` und das Event-Target **kein** Texteingabefeld
   (`isTextEntryTarget()` prüft `input` mit Text-artigem `type`, `textarea`,
   `isContentEditable`), wird `event.preventDefault()` aufgerufen – ohne
   `stopPropagation()`, damit Phaser und `useAudioUnlockHint` das Event weiterhin
   sehen.
3. Zusätzlich wird bei einem Spieltasten-`keydown` ein noch fokussiertes,
   nicht-textuelles Bedienelement per `blur()` freigegeben, damit Folgeeingaben
   sauber ins Spiel gehen.
4. Einbindung in `ArenaView` (`client/src/game/ArenaView.tsx`): Installation im
   `onReady`-Callback der `RaceScene`, Cleanup-Funktion in einem Ref, Aufruf im
   `return` des Mount-Effects. Damit ist der Guard exakt so lange aktiv wie die
   Arena sichtbar ist, und `/admin` sowie andere Seiten bleiben unbeeinflusst.

Ergänzend (defensiv, kostenlos): explizite `input.keyboard.capture`-Liste in der
Phaser-Game-Config, damit die Captures nicht implizit von `createCursorKeys()`
abhängen.

## Test-Strategie (TDD, rot → grün)

Neu: `client/src/game/input/keyboardCaptureGuard.test.ts` (jsdom, Vitest)

- Space-`keydown` ohne Modifier → `defaultPrevented === true`
- `ArrowRight`-`keydown` **mit** `shiftKey: true` → `defaultPrevented === true`
  (Kern-Regression, scheitert im Ist-Zustand)
- `Shift`-`keydown` → `defaultPrevented === true`
- `keyup` derselben Tasten → `defaultPrevented === true`
- `Tab`, `F5`, `a` → `defaultPrevented === false`
- `keydown` mit `<input type="text">` als Target → `defaultPrevented === false`
- fokussierter `<button>` + Space-`keydown` → `document.activeElement !== button`
- Cleanup-Funktion aufgerufen → danach kein `preventDefault` mehr
- Guard ruft kein `stopPropagation` (ein zusätzlicher Bubble-Listener wird erreicht)
- **Reihenfolge (Regression "Steuerung tot"):** ein vorher registrierter,
  Phaser-artiger Bubble-Listener auf `window` sieht das Event mit
  `defaultPrevented === false` – auch bei Sprint (Shift + Pfeil) und bei `keyup` –
  während der Browser-Default am Ende trotzdem unterdrückt ist.
