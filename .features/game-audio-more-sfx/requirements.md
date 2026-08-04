# Requirements: Game-Audio – weitere Soundeffekte (damaged, playerdamaged, fall, checkpoint, complete)

## Kontext

Erweitert `.features/game-audio/` (Hintergrundmusik + jump/collect) um fünf weitere,
bereits als Assets vorliegende Soundeffekte unter `client/public/assets/Audio/`:
`damaged.mp3`, `playerdamaged.mp3`, `fall.mp3`, `checkpoint.mp3`, `complete.mp3`. Nutzt
dieselbe Infrastruktur (`AUDIO_KEYS`/`AUDIO_SPECS`, `audioSettings`-Store, `playSfx`-Helper
in `RaceScene.ts`) – keine neue Architektur nötig.

## User Stories

### US-1: Gegner besiegt

Als Standbetreuer möchte ich, dass beim Besiegen eines Hazards (Stomp von oben) ein Sound
abgespielt wird, damit dieser Erfolgsmoment akustisch spürbar ist.

Akzeptanzkriterien:
- WHEN ein Racer einen stompable Hazard von oben trifft (Kontaktergebnis `"stomped"`) SHALL
  DAS SYSTEM den Sound `damaged` einmalig abspielen.

### US-2: Spieler nimmt Schaden

Als Standbetreuer möchte ich, dass bei jedem Schadenskontakt mit einem Hazard (kein Stomp)
ein Sound abgespielt wird, damit negative Ereignisse akustisch spürbar sind.

Akzeptanzkriterien:
- WHEN ein Racer durch Hazard-Kontakt Schaden nimmt (Kontaktergebnis ungleich `"none"` und
  ungleich `"stomped"`) SHALL DAS SYSTEM den Sound `playerdamaged` einmalig abspielen.

### US-3: Spieler fällt von der Karte

Als Standbetreuer möchte ich, dass beim Herunterfallen von der Karte (Pit-Fall) ein Sound
abgespielt wird.

Akzeptanzkriterien:
- WHEN ein Racer die Karte nach unten verlässt (`applyPitFall`-Zweig in `RaceScene.update`)
  SHALL DAS SYSTEM den Sound `fall` einmalig abspielen.

### US-4: Checkpoint aktiviert

Als Standbetreuer möchte ich, dass beim erstmaligen Aktivieren eines Checkpoints ein Sound
abgespielt wird.

Akzeptanzkriterien:
- WHEN ein Racer einen Checkpoint zum ersten Mal erreicht (identisch zum bestehenden
  "Fahne hissen"-Zweig, nicht bei wiederholtem Überlappen) SHALL DAS SYSTEM den Sound
  `checkpoint` einmalig abspielen.

### US-5: Level abgeschlossen

Als Standbetreuer möchte ich, dass beim Erreichen des Ziels ein Sound abgespielt wird, damit
der Abschluss eines Laufs akustisch spürbar ist.

Akzeptanzkriterien:
- WHEN ein Racer das Ziel erreicht (`onGoalOverlap`, `applyGoalReached`-Zweig) SHALL DAS
  SYSTEM den Sound `complete` einmalig abspielen.

## Nicht-Ziele

- Kein Sound bei wiederholtem Berühren eines bereits aktivierten Checkpoints.
- Kein Sound bei Time-Limit-Erreichen oder DNF (nicht Teil dieses Scopes – nur reguläres
  Zielerreichen, US-5).
- Keine Änderung an Lautstärke-/Mute-Steuerung (nutzt bestehende Master-Lautstärke).

## Offene Fragen

Keine – Assets liegen bereits vor, Muster ist durch `game-audio` etabliert.
