# Design: Game-Audio – weitere Soundeffekte

Bezug: `requirements.md` (US-1 bis US-5), aufbauend auf `.features/game-audio/design.md`.

## Ansatz

Reine Erweiterung der bestehenden Registry und Wiring-Stellen, keine neue Architektur:

- `game/assets/audio.ts`: `AUDIO_KEYS` um `DAMAGED`, `PLAYER_DAMAGED`, `FALL`, `CHECKPOINT`,
  `COMPLETE` ergänzen, `AUDIO_SPECS` entsprechend erweitern (Pfade `assets/Audio/{damaged,
  playerdamaged,fall,checkpoint,complete}.mp3`).
- `RaceScene.ts`:
  - `onHazardOverlap`: `contact === "stomped"` → `playSfx(AUDIO_KEYS.DAMAGED)`;
    sonst (Schaden, nicht `"none"`) → `playSfx(AUDIO_KEYS.PLAYER_DAMAGED)`.
  - `update()`, Pit-Fall-Zweig (`this.player.y > this.level.worldHeight + 100`) →
    `playSfx(AUDIO_KEYS.FALL)`.
  - `onCheckpointOverlap`: im bereits vorhandenen "erstmalige Aktivierung"-Zweig (nach dem
    `activatedCheckpointIds`-Guard) → `playSfx(AUDIO_KEYS.CHECKPOINT)`.
  - `onGoalOverlap`: nach `applyGoalReached` → `playSfx(AUDIO_KEYS.COMPLETE)`.
- Kein neuer Store/State nötig; `playSfx` (bereits vorhanden aus `game-audio`) wird
  wiederverwendet.

## Test-Strategie

- `assets/audio.ts`: reine Konstanten, kein Test nötig (bestehende Konvention).
- `RaceScene.ts`-Wiring: wie im gesamten Projekt etabliert nicht unit-getestet (Phaser/Canvas
  nötig), manuell verifiziert (Stomp-Sound bei Hazard-Stomp, Schadens-Sound bei
  Hazard-Kontakt, Fall-Sound bei Pit-Fall, Checkpoint-Sound nur beim ersten Aktivieren,
  Complete-Sound bei Zielerreichen).

## Auswirkungen auf bestehenden Code

- `client/src/game/assets/audio.ts`: additive Erweiterung.
- `client/src/game/scenes/RaceScene.ts`: fünf zusätzliche `playSfx(...)`-Aufrufe an
  bestehenden Stellen, keine Restrukturierung.
