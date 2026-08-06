# Tasks: Movement-Sprint-And-Variable-Jump

Bezug: `requirements.md`, `design.md`. Reihenfolge = Abhängigkeitsreihenfolge.

- [x] 1. `Action`/`ACTIONS` um `"sprint-left"`/`"sprint-right"` erweitern (rot: `state.test.ts`
      erst anpassen, dann grün implementieren) (Bezug: US-1)
      `packages/bot-contract/src/state.ts` + `state.test.ts`.

- [x] 2. Test für `movement.ts` (rot) (Bezug: US-4, US-5, US-6)
      `movement/movement.test.ts`: `rampedSprintSpeed`, `jumpVelocityForSpeed`,
      `shouldCutJump` gemäß design.md Test-Strategie.
- [x] 3. `movement.ts` implementieren (grün)
      `movement/movement.ts` mit `MOVEMENT_TUNING`, den drei pure Funktionen.

- [x] 4. Test für `KeyboardController` Shift/Sprint (rot) (Bezug: US-2)
      `KeyboardController.test.ts`: neue Fälle für `shift`-Taste, `getInput().sprint`,
      `getNextAction()` liefert `sprint-left`/`sprint-right`.
- [x] 5. `KeyboardController.ts` anpassen (grün)
      `CursorKeysLike.shift`, `KeyboardInput.sprint`, angepasste `getNextAction()`/`getInput()`.

- [x] 6. `RaceScene.ts` anpassen (Bezug: US-2, US-3, US-4, US-5)
      - `MOVEMENT_TUNING`-Import statt lokaler `MOVE_SPEED`/`JUMP_VELOCITY`-Konstanten.
      - Neue Felder `sprintHoldMs`, `jumpStartMs`, `currentDelta`.
      - Neue Methoden `applyMovement`/`applyJumpOnly`.
      - `applyKeyboardInput`/`applyBotAction` überarbeitet (Sprint-Parsing, "jump" behält
        horizontale Velocity, "idle" resettet `sprintHoldMs`).
      - Shift-Key-Erzeugung in `createController()`.
      Ungetestet (Phaser), manuelle Verifikation gemäß design.md.

- [x] 7. Doku-Updates (Bezug: "Begleitende Doku-Updates")
      `docs/02-bot-api.md` (Action-Typ, Regel 4, Sprint-/Jump-Erklärung),
      `docs/09-bot-artefakt-und-turnier.md` (Action-String-Kommentar).

- [x] 8. Vollständiger Testlauf + manuelle Verifikation
      `npx vitest run` (client) grün, `tsc --noEmit` sauber, manuelle Checkliste aus
      design.md im Browser (`/dev`, Tastatur + Bot-Modus).
