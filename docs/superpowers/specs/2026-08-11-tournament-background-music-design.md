# Design: Rundenabhängige Turniermusik

## Ziel

`/present` erhält eine durchgehende, mit Phaser abgespielte Hintergrundmusik. Während aller
Nicht-Live-Phasen läuft `end.mp3`. In laufenden Matches richtet sich der Track nach der Entfernung
der aktuellen Runde zum Finale.

## Musikzuordnung

Für ein laufendes Match wird `distanceToFinal = rounds.length - 1 - activeRoundIndex` berechnet:

| Zustand | Track |
| --- | --- |
| `match-running`, `distanceToFinal = 0` | `epic.mp3` |
| `match-running`, `distanceToFinal = 1` | `theme3.mp3` |
| `match-running`, `distanceToFinal = 2` | `theme2.mp3` |
| `match-running`, `distanceToFinal >= 3` | `theme.mp3` |
| Jede andere Show-Phase | `end.mp3` |

Damit beginnen Turniere mit vier Bots direkt mit `theme3.mp3`, Turniere mit zwei Bots direkt mit
`epic.mp3`, und größere Turniere nutzen in frühen Runden `theme.mp3`.

## Architektur

Eine kleine, persistente Phaser-Game-Instanz lebt auf `/present` unabhängig von `MatchView` und
damit über Phasenwechsel hinweg. Ihre `TournamentMusicScene` lädt ausschließlich die fünf
Musiktracks und besitzt genau einen aktiven Loop.

Ein React-Hook übersetzt `TournamentState` und `TournamentShowState` über eine pure Selektor-Funktion
in einen Audio-Key und übergibt Änderungen an die Scene. Die Scene stoppt den bisherigen Loop nur
bei einem tatsächlichen Trackwechsel und startet anschließend den neuen Track. Dadurch gibt es
weder parallele Hintergrundtracks noch Neustarts bei fachlich identischen State-Nachrichten.

`MatchBootScene` bleibt für das einmalige Laden der Arena-Assets und deren Lifecycle zuständig,
spielt im Turniermodus aber keine Hintergrundmusik mehr. Die Racer-Szenen bleiben wie bisher stumm;
ihre Phaser-Soundeffekte funktionieren unverändert. `useShowAudioCue` darf `boingo.mp3` und
`complete.mp3` weiterhin einmalig über die Hintergrundmusik legen.

Die persistente Musik-Instanz verwendet `getSharedAudioContext()` und den vorhandenen
`audioSettings`-Store. Änderungen an Mute oder Lautstärke werden ohne Trackneustart auf den laufenden
Sound angewendet.

## Phasen und Startzustand

- Sobald auf `/present` ein Turnier-/Show-Kontext vorhanden ist, wählt der Controller einen Track.
- Alle Phasen außer `match-running` verwenden `end.mp3`, einschließlich `ready`, Matchup,
  Countdown, Ergebnis, Bracket-Update und Champion.
- Fehlen Turnier oder Show noch vollständig, bleibt die Musik aus; der Roster-/Setup-Screen ist
  keine Intermission eines gestarteten Turniers.
- Bei gesperrtem Browser-Audio bleibt die Show funktionsfähig. Nach dem bestehenden Audio-Unlock
  startet beziehungsweise setzt Phaser den gewünschten Track fort.

## Fehlerbehandlung

- Ungültiger oder fehlender `activeRoundIndex` während `match-running` fällt auf `theme.mp3` zurück.
- Ein fehlendes Asset darf die Turniersteuerung nicht stoppen; Phaser protokolliert den Ladefehler,
  während die UI weiterläuft.
- React-Unmount zerstört die dedizierte Phaser-Instanz und beendet den aktiven Loop.

## Tests

- Unit-Tests für die Trackauswahl: frühe Runde, Viertel-, Halb- und Finale sowie alle Nicht-Live-
  Phasen und unvollständiger State.
- Lifecycle-Tests für die Musiksteuerung: Start, echter Trackwechsel, identischer Track ohne Neustart,
  Lautstärke/Mute und Cleanup.
- Regressionstest, dass `MatchBootScene` keine eigene Turnier-Hintergrundmusik mehr startet.
- Bestehende Cue-, Match- und Present-Tests bleiben grün.
- Manueller Browser-Test eines Turniers prüft Intermission → Match → Ergebnis und mindestens einen
  Wechsel in eine spätere Runde.

## Nicht-Ziele

- Crossfades, Beat-Synchronisation oder serverseitige Musiksteuerung.
- Änderungen an Soundeffekten oder Musik in `/dev`.
- Musik im `/admin`-Control-Room.
