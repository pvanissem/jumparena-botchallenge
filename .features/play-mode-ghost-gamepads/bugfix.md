# Bugfix: Gamepad-Eingaben kommen unzuverlässig in der React-Oberfläche an

Bezug: `.features/play-mode/`, `.features/play-mode-input-lag/bugfix.md`
(erster, unvollständiger Anlauf).

## Aktuelles Verhalten (Bug)

Im Kalibrierungs-Assistenten (und in den Menüs) werden Tastendrücke nur
sporadisch erkannt. Man muss mehrfach drücken oder halten. Die eingebaute
Pad-Diagnose zeigt dabei:

```
USB Gamepad (STANDARD GAMEPAD Vendor: 0079 Product: 0011) · Tasten: – · Achsen: –
```

Also ein Pad MIT Kennung, aber OHNE Buttons und OHNE Achsen – zeitweise
erscheinen dann doch Tasten.

## Erwartetes Verhalten

Jeder Tastendruck wird zuverlässig und sofort erkannt, unabhängig davon, wie
viele Einträge `navigator.getGamepads()` liefert und welcher davon die echten
Daten trägt.

## Was bleibt unverändert (Regressions-Schutz)

- Reducer-Logik (`calibration.ts`, `station.ts`, `nameEntry.ts`) inklusive der
  Ruhezustands-Erkennung aus dem vorigen Bugfix.
- Steuerung im Level (`GamepadController` liest direkt im Phaser-`update()`).
- Drosselung der Phasen-Ticks (`useStationInputLoop`).

## Root Cause (nach Analyse)

Zwei Annahmen in meiner Umsetzung sind falsch:

1. **„Der Index in `navigator.getGamepads()` identifiziert ein Pad."**
   Billige USB-Adapter (hier Vendor 0079 / DragonRise) erscheinen in Chrome
   regelmäßig als MEHRERE Einträge: ein leerer Platzhalter mit Kennung, aber
   `buttons.length === 0` und `axes.length === 0`, und daneben der echte
   Eintrag. Welcher Index welcher ist, kann zwischen Frames wechseln. Die
   Anwendung bindet eine Station aber fest an `padIndex` und liest danach nur
   noch DIESEN Index – trifft sie den Platzhalter, kommt nie wieder etwas an.
   Die Diagnose zeigte aus demselben Grund nur das erste verbundene Pad und
   damit potenziell dauerhaft den Platzhalter.

2. **„Jeder Eintrag mit `connected === true` ist ein benutzbares Pad."**
   Ein Eintrag ohne Buttons und ohne Achsen kann per Definition keine Eingabe
   liefern, wird aber überall als gültiges Pad behandelt (Zuordnung,
   Verbindungsprüfung, `snapshot()`).

Zusätzlich erschwert die bisherige Struktur die Fehlersuche: Jede Komponente
betreibt ihre eigene rAF-Schleife, und es gibt keine Möglichkeit, am Stand zu
sehen, was `getGamepads()` tatsächlich liefert.

## Fix-Ansatz

1. **Nur benutzbare Pads berücksichtigen.** Ein Pad gilt als benutzbar, wenn es
   verbunden ist UND mindestens einen Button oder eine Achse meldet. Leere
   Platzhalter werden überall ignoriert.
2. **Stationen an die Hardware-Kennung binden, nicht an den Index.** Gespeichert
   wird `padId` + zuletzt bekannter Index; bei jedem Zugriff wird das Pad neu
   aufgelöst (erst über den Index, sonst über die Kennung). Wechselt der Index,
   folgt die Station automatisch.
3. **Eine einzige, gemeinsame Frame-Schleife** für die ganze Seite statt einer
   pro Komponente (`frameClock`), damit Polling-Frequenz und Reihenfolge
   nachvollziehbar sind.
4. **Ehrliche Diagnose:** eine aufklappbare Ansicht, die ALLE Einträge aus
   `getGamepads()` mit Index, Kennung, Anzahl Buttons/Achsen, gedrückten Tasten
   und Achsenwerten zeigt, dazu die gemessene Frequenz der Schleife und ein
   Protokoll der letzten Roh-Änderungen. Damit ist am Stand sofort sichtbar,
   welcher Eintrag echte Daten liefert.

## Nachtrag: hinfällig

Die hier beschriebene Ursache (Platzhalter-Einträge in `getGamepads()`) war
eine Fehlannahme. Die Messung am Stand ergab: Es gab keine Platzhalter, sondern
Chromiums Mapping meldet für diesen Adapter schlicht keine Achsen und die
Tasten 14/15 (links/rechts) nie – siehe `.features/play-mode-webhid/bugfix.md`.

Der gesamte Gamepad-API-Pfad inklusive der hier ergänzten Platzhalter-Prüfung
wurde anschließend entfernt. Dieses Dokument bleibt als Analyse-Historie
bestehen.
