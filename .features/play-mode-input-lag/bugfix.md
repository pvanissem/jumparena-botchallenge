# Bugfix: Gamepad-Eingaben im `/play`-Modus gehen verloren

Bezug: `.features/play-mode/` (US-2 „einmal pro Tastendruck", US-3 Steuerung,
US-7 Bedienbarkeit am Stand).

## Aktuelles Verhalten (Bug)

Beim Drücken einer Gamepad-Taste in den Menüs von `/play` (Startbildschirm,
Namenseingabe, Zwischenanzeigen) reagiert die Oberfläche unzuverlässig: Mal wird
ein Druck erkannt, mal nicht. Die Eingabe kommt „sehr unregelmäßig rein".

## Erwartetes Verhalten

Jeder Tastendruck am zugeordneten Gamepad wird genau einmal und ohne spürbare
Verzögerung erkannt – unabhängig davon, wie lange die Taste gehalten wird und
was auf der anderen Station gerade passiert.

## Was bleibt unverändert (Regressions-Schutz)

- Die reinen Reducer (`station.ts`, `nameEntry.ts`, `calibration.ts`) und ihre
  Tests bleiben inhaltlich unverändert – der Fehler liegt nicht in der Logik.
- Die Steuerung IM Level (`GamepadController` + `RaceScene`) bleibt unverändert:
  Sie liest bereits direkt im Phaser-`update()` und ist nicht betroffen.
- Zeitgesteuerte Phasen (Countdown 3 s, Zwischenanzeige 4 s, Game-Over-Timeout
  45 s) behalten ihr Verhalten.
- Beide Stationen bleiben vollständig unabhängig.

## Root Cause (nach Analyse)

Drei sich verstärkende Ursachen in der React-Verdrahtung (`PlayPage.tsx`,
`useStation.ts`), nicht in der Eingabelogik:

1. **Ticks in jedem Frame.** `useFrameLoop` rief `station.tick(deltaMs)` 60×/s
   auf. `stationReducer` liefert für `tick` immer ein NEUES State-Objekt (schon
   wegen `phaseElapsedMs`), also rendert React 60×/s neu – pro Station, also
   120 Renders/s. Zeit braucht aber nur ein kleiner Teil der Phasen
   (`countdown`, `level-result`, `game-over`); in `attract`, `name-entry` und
   `playing` ist der Tick vollständig nutzlos.
2. **Effekt-Sturm.** Der Level-Start-Effekt in `useStation` hat `state` in den
   Dependencies und lief damit ebenfalls bei jedem Frame erneut.
3. **Zwei rAF-Schleifen pro Station** (`useGamepadEdges` + `useFrameLoop`), die
   sich zusammen mit Phasers eigener Schleife und den Re-Renders um denselben
   Thread streiten.

Folge: Die Polling-Frequenz bricht ein. Die Flankenerkennung sieht ein Pad nur
noch alle paar hundert Millisekunden – ein kurzer Tastendruck, der zwischen zwei
Polls gedrückt UND losgelassen wird, existiert für die Anwendung nie. Das erklärt
exakt das beobachtete, sporadische Verhalten.

## Fix-Ansatz

1. **Eine einzige rAF-Schleife pro Station** (`useStationInputLoop`), die
   Polling, Flankenerkennung, Verbindungsprüfung und Ticks bündelt.
   `useGamepadEdges` entfällt ersatzlos (wird von nichts anderem genutzt).
2. **Eingaben weiterhin mit voller Frame-Rate pollen** – Flanken werden sofort
   dispatcht (sie treten selten auf, kosten also kaum Renders).
3. **Ticks nur, wenn eine Phase tatsächlich auf Zeit wartet**
   (`countdown | level-result | game-over`), und dort auf ~10 Hz gedrosselt
   (akkumuliertes Delta). In `attract`, `name-entry` und `playing` entstehen so
   gar keine tick-bedingten Re-Renders mehr.
4. **Verbindungsstatus nur bei Änderung** in den React-State schreiben.
5. Level-Start-Effekt in `useStation` auf die tatsächlich benötigten
   Dependencies reduzieren, damit er nicht mehr pro Frame läuft.
