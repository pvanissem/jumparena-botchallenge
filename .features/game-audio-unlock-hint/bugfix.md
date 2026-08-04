# Bugfix: Hintergrundmusik startet augenscheinlich erst beim Bedienen des Lautstärke-Reglers

## Aktuelles Verhalten (Bug)

Die Hintergrundmusik (`RaceScene.create()`, siehe `.features/game-audio/design.md` US-1)
ist beim Laden von `/dev` zunächst nicht hörbar. Erst wenn die Nutzerin den
Lautstärke-Regler (`AudioControls`) bedient, setzt die Musik ein. Das wirkt wie ein Bug im
Feature `game-audio` (US-1 AC1: "SHALL DAS SYSTEM die Hintergrundmusik ... starten").

## Root Cause (nach Analyse)

Kein Fehler in unserem Code, sondern die **Autoplay-Policy moderner Browser** (Chrome,
Firefox, Safari): Ein `AudioContext` wird im Zustand `suspended` erzeugt und darf per
Spezifikation erst nach einer echten Nutzer-Geste (Klick/Touch/Tastendruck) per JavaScript
mit `context.resume()` reaktiviert werden. Phaser implementiert das bereits korrekt (siehe
`node_modules/phaser/dist/phaser.js`, `WebAudioSoundManager#unlock` /
`HTML5AudioSoundManager#isLocked`): Es registriert `mousedown`/`touchstart`/`keydown`-
Listener auf `document.body` (nicht nur auf den Spiel-Canvas!) und reaktiviert den Context
bzw. spielt bereits gequeuete `play()`-Aufrufe beim ersten Interaktions-Event automatisch ab.

Der in `RaceScene.create()` bereits vorhandene `this.music.play()`-Aufruf (siehe
`client/src/game/scenes/RaceScene.ts`) wird also korrekt "vorgemerkt" und beginnt exakt in
dem Moment zu spielen, in dem der Browser die erste Interaktion auf der Seite registriert —
das ist zufällig häufig der Lautstärke-Regler, weil das oft die erste Mausaktion nach dem
Laden ist. Ein Klick auf einen beliebigen anderen Button, eine Tasteneingabe oder ein
Bot-Auswahl-Klick hätte denselben Effekt (früher, je nachdem was zuerst passiert).

**Es gibt keine Möglichkeit, Audio ganz ohne jede Nutzer-Interaktion abzuspielen** – das wäre
ein von allen gängigen Browsern absichtlich verhindertes Verhalten (Schutz vor ungewollt
lauten/autoplaying Webseiten) und ist unabhängig von Phaser oder unserem Code.

## Erwartetes Verhalten

Da "wirklich sofort ganz ohne Interaktion" technisch nicht erreichbar ist, wird stattdessen
das früheste browser-konforme Verhalten sichergestellt und für Standbesucher transparent
gemacht:

- Die Musik beginnt exakt bei der **ersten** Interaktion mit der Seite (Klick, Touch oder
  Tastendruck) – unabhängig davon, ob diese Interaktion der Lautstärke-Regler, ein anderer
  Button oder eine Spieltaste ist (das ist durch Phasers vorhandenen Mechanismus, siehe
  oben, bereits gegeben und erfordert keine Code-Änderung).
- Solange der Ton noch gesperrt ist (kein Interaktions-Event ist bisher aufgetreten), zeigt
  die UI einen kurzen, unaufdringlichen Hinweis ("Ton startet mit der ersten Interaktion"),
  damit Standbesucher nicht denken, die Musik sei kaputt/fehlt.

## Was bleibt unverändert (Regressions-Schutz)

- Alle bestehenden Akzeptanzkriterien aus `.features/game-audio/requirements.md` (US-1 bis
  US-5) bleiben unverändert gültig und erfüllt.
- Keine Änderung an `audioSettings.ts`, `useAudioSettings.ts`, Server-Wiring oder den
  Message-Typen.
- `AudioControls` bleibt funktional identisch (Toggle/Slider verhalten sich unverändert);
  der neue Hinweistext ist rein additiv und blendet sich nach der ersten Interaktion
  automatisch aus.

## Fix-Ansatz

Neuer, kleiner Hook `useAudioUnlockHint()` (`client/src/game/audio/useAudioUnlockHint.ts`):
lauscht einmalig auf `pointerdown`/`keydown` auf `window` und liefert `locked: boolean`
(startet `true`, wird nach dem ersten Event dauerhaft `false`). In `DevPage.tsx` wird bei
`locked === true` ein kurzer Hinweistext neben `AudioControls` angezeigt.
