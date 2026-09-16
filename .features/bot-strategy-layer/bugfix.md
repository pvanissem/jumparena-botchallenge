# Bugfix: Stillstand nach der ersten Luecke in Level 1

## Status

Vom Nutzer mit "mach" zur Umsetzung beauftragt. Implementierung laeuft.
Bezug: bestehende Framework-Navigation, Requirements US-2 und aktueller
Scope ohne Levelaenderungen oder zusaetzliche Testplattform.

## Aktuelles Verhalten (Bug)

Der Besucherbot Fluppo (`bot-11e102a9`) nutzt korrekt
`decide(state, tools)` und `tools.navigate({ choose })`.
Der Lauf `2026-09-16T06-16-19-868Z.json` zeigt nach 1,65 Sekunden
Stillstand bei x=471,07 auf Level 1 bis zum Zeitlimit, ohne technische Fehler.
Ab Tick 50 meldet die Navigation `no-known-continuation` beziehungsweise
`blocked-unchanged`. Die Besucherstrategie wird mangels Optionen nicht aufgerufen.

## Erwartetes Verhalten

- WHEN ein naher Block den Aufstieg behindert SHALL DIE NAVIGATION auch
  vorbereitende Bewegungen auf der aktuellen Stuetzflaeche und geeignete
  Zwischenlandungen pruefen, statt nur direkte Spruenge anzubieten.
- WHEN sich Gefahren nach einer abgeschlossenen ergebnislosen Suche aendern
  SHALL DIE NAVIGATION neue Optionen pruefen, ohne durch staendige Bewegungen
  in einen unbegrenzten Suchneustart zu geraten.
- WHEN keine sichere Fortsetzung nachgewiesen ist SHALL DIE NAVIGATION
  keinen blinden Sprung oder Rueckzug ueber eine Plattformkante erzwingen.

## Was bleibt unveraendert (Regressions-Schutz)

Keine Aenderung an Fluppos Datei, Level 1, Scoring, Sichtweite oder Physik.
Keine neue Testseite, CLI oder Logging-Plattform. Ein-Datei-Abgabe bleibt.
Bestehende Landungs-/Kollisionspruefung, Suchbudgets, laufender Planbesitz
und Schutz vor endlosen Suchneustarts bleiben erhalten.

## Root Cause (nach Analyse)

1. Der Planner erkennt nur Hindernisse auf aktueller Koerperhoehe als Anlass
   fuer einen Anlauf. `block-1` haengt ueber dem stehenden Bot und wird deshalb
   nicht beruecksichtigt, obwohl alle generierten Spruenge seitlich dagegen
   stossen. Die sichere Standflaeche und passende Zwischenziele werden nicht
   ausreichend abgetastet. Reproduktion aus Trace-Tick 50: abgeschlossene
   Suche mit null Optionen nach 255 Integrationsschritten, kein Budgetabbruch.
2. Ein abgeschlossener leerer Suchcache ueberlebt die Blockierpause und
   Gefahrenaenderungen. Die vorhandene Aktualitaetspruefung filtert nur
   existierende Routen; sie kann keine neu moeglichen Routen erzeugen.

## Fix-Ansatz

Zuerst kleine Regressionstests mit der aufgezeichneten Geometrie fuer
Ueberkopfblock, Stacheln und folgende Luecke sowie fuer geaenderte Hazards.
Vorbereitende Ziele aus tragfaehigen Standintervallen und Hindernisgeometrie
ableiten, einschliesslich Zwischenlandungen hinter dem Hindernis. Kein
fest eingebauter Level-1-x-Wert und keine Lockerung der Sicherheitspruefung.
Negative Suchergebnisse bei relevanter neuer Information begrenzt erneuern.

Der unveraenderte Predictor findet fuer den Trace-Zustand bereits eine
dreiteilige Route: zurueckgehen, ueber Block/Stacheln springen, Luecke queren.
Das ist nur ein Beleg fehlender Suchkandidaten, kein Live-Erfolgsnachweis:
Die erste gefundene Route hat einen zu knappen Puffer fuer ein Erfolgsversprechen.
Regressionen muessen auch tickweise Planausfuehrung und Abweichungen pruefen.
Abschliessend denselben Besucherbot im bestehenden `/code` ausprobieren und
den neuen Trace auswerten. Keine Zielquote ohne beobachteten Lauf behaupten.

## Reproduktionsgrenzen

Bot-Revision stimmt mit der aktuellen Datei ueberein. Der Trace enthaelt
gerundete Werte und weder vollstaendiges Tuning noch eine Frameworkrevision.
Fuer die Reproduktion wurden fehlende Physikkonstanten und Weltgrenzen aus
dem aktuellen Code ergaenzt. Der Originalzustand ist deshalb nicht verlustlos
rekonstruierbar, das leere Suchergebnis und der Cachefehler sind reproduziert.
