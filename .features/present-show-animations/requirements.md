# Requirements: Present-Show-Animationen

Status: Freigegeben durch „Ja mach mal“.

## Kontext

Gezielter Ausbau der visuellen Inszenierung aus
`.features/tournament-show-flow/requirements.md` (US-5, US-7, US-8).
Bezug: `docs/09-bot-artefakt-und-turnier.md`, Turnierverlauf in `/present`.
Aktuell besitzen Matchup und Teilnehmerkarten einfache Einblendungen;
Countdown-Ziffern haben keinen eigenen Auftritt. Gewünscht ist eine
deutlich ausdrucksstärkere Messe-Show im vorhandenen Pixel-/Neon-Stil.

## User Stories

### US-1: Match-Intro mit Arcade-Charakter

Als Zuschauer möchte ich die bevorstehende Begegnung deutlich inszeniert
sehen, damit ich die Kontrahenten und den Matchstart wahrnehme.

- WHEN ein neues Match-Intro erscheint SHALL DAS SYSTEM die Teilnehmerkarten
  zeitlich versetzt aus wechselnden Richtungen einfliegen und kurz einrasten
  lassen; Botname und Autor bleiben anschließend ruhig lesbar.
- WHEN der Countdown eine neue Zahl anzeigt SHALL DAS SYSTEM jede Ziffer
  mit einem kurzen Zoom-Impuls und einem auslaufenden Neon-Ring inszenieren.
- WHEN Live-Zwischenstände oder andere Updates eintreffen SHALL DAS SYSTEM
  Intro-Animationen nicht erneut starten.

### US-2: Sieger und Champion feiern

Als Zuschauer möchte ich einen klaren Sieger-Moment erleben, damit das
Ergebnis mehr Wirkung als eine reine Tabelle hat.

- WHEN das Match-Ergebnis erscheint SHALL DAS SYSTEM die Siegerüberschrift
  markant einblenden und die Ergebniszeilen anschließend gestaffelt zeigen.
- WHEN der Champion erscheint SHALL DAS SYSTEM Krone und Gewinnername mit
  einem kurzen Auftritt, einem dekorativen Strahlenkranz und einem
  begrenzten Pixel-Konfetti-Ausbruch hervorheben.
- WHEN ein Ergebnis oder Champion angezeigt wird SHALL DAS SYSTEM Namen,
  Platzierungen und Punkte trotz der Effekte jederzeit lesbar halten.

### US-3: Passende Übergänge und messetauglicher Betrieb

Als Standbetreiber möchte ich eine lebendige, flüssige Präsentation, die
das Rennen und die Steuerung zuverlässig weiterlaufen lässt.

- WHEN die Warteliste oder der Present-Turnierbaum erscheint SHALL DAS
  SYSTEM Karten beziehungsweise Runden kurz gestaffelt einblenden.
- WHEN ein Match läuft SHALL DAS SYSTEM die Spielansicht und ihre Kamera
  ruhig halten und keine dekorativen Dauereffekte darüberlegen.
- WHEN Show-Phasen wechseln SHALL DAS SYSTEM die bestehenden serverseitigen
  Phasendauern und den Startzeitpunkt des Matches beibehalten.
- WHEN Animationen dargestellt werden SHALL DAS SYSTEM die bestehende
  Unterstützung für zwei bis vier Teilnehmer und kleinere Viewports bewahren.
- WHEN reduzierte Bewegung angefordert wird SHALL DAS SYSTEM die neuen
  Bewegungs- und Partikeleffekte deaktivieren und Inhalte direkt anzeigen.
- WHEN Effekte umgesetzt werden SHALL DAS SYSTEM ohne neue Animationsbibliothek
  und ohne zusätzliche Phaser-Instanz auskommen; dekorative Elemente dürfen
  keine Eingaben abfangen oder von Screenreadern vorgelesen werden.

## Nicht-Ziele

- Änderungen an Admin-Optik, Spielphysik, Scoring oder Turnierregeln.
- Neue Soundeffekte oder veränderte Show-Phasendauern.
- Stroboskop-Effekte, dauerndes Bildschirmwackeln oder zusätzliche Bedienelemente.

## Offene Fragen

Keine. Arcade-/Neon-Inszenierung mit Einflug, Countdown-Impuls,
gestaffeltem Ergebnis und Pixel-Konfetti beim Champion ist freigegeben.
