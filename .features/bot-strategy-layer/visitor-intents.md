> VERWORFEN: Durch environment-navigation.md ersetzt. Nutzer lehnt Levelzuschnitt ausdrücklich ab.

# Besucherwünsche statt Bewegungsprogrammierung

## Auftrag / Freigabe
16.09.2026: Nutzer fordert ausdrücklich Umsetzung einer Lösung, die natürliche Besucherwünsche zuverlässig in Botverhalten übersetzt; autonom arbeiten, KISS. Die vorherige Empfehlung eines allgemeinen geometrischen Bots wird durch diesen konkreten Ansatz ersetzt.

## Requirements
- WHEN der Agent „zum Ziel, keine Bonusumwege“ übersetzt SHALL tools.race({objective: "finish"}) eine gepflegte Level-1-Route ausführen.
- WHEN der Besucher zusätzliche Früchte möchte SHALL objective "fruit" eine explizite Bonusvariante wählen; keine Behauptung global optimaler Punktzahl.
- WHEN ein anderer Level oder eine unbekannte Option verwendet wird SHALL eine verständliche Fehlermeldung erscheinen statt erfundener Navigation.
- WHEN der Bot nichts auswählt SHALL das leere Template weiterhin [] liefern.
- WHEN Respawn oder Stopp erfolgt SHALL interner Routenzustand korrekt zurückgesetzt werden; eine laufende Variante bleibt bis Reset konstant.
- WHEN Bewegungen scheitern SHALL ein begrenzter Neuversuch erfolgen; nach wiederholtem Scheitern klarer Fehler statt Endlosschleife.

## Design
Eine additive race-Funktion neben run/status. Geprüfte, levelgebundene Routen sind Spieldaten in bot-navigation, keine LLM-erzeugte Physiksimulation. Die vorhandenen Bewegungshelfer bleiben unverändert. Eine kleine Routenausführung verwaltet Fortschritt, Warten, Respawn und Wiederholung. Sie wird im vorhandenen Controller-Facade gekapselt; der Worker behält seine synchronen Ein-Aufruf-/Ownership-Regeln. Die aktuelle Botdatei enthält nur Metadaten und Strategieauswahl. Vorherigen Besuchercode sichern.

Explizite Grenze: Erste durchgängige Umsetzung nur für Level 1 und zwei Wünsche. Keine allgemeine Übersetzung beliebiger Sprache im Framework. Der Agent übersetzt nur in dokumentierte Fähigkeiten; neue Wünsche benötigen neue geprüfte Verhaltensvarianten. Boingos sind auf diesem Level obligatorisch und können nicht abgeschaltet werden.

## Tasks
- [ ] Tests zuerst: Auswahl, falscher Level/Optionen, Respawn, Retry und Worker-Lebenszyklus.
- [ ] Zwei gepflegte Routen und race-Anbindung implementieren.
- [ ] Schlechte Beispiele aus empfohlenem Einstieg entfernen; konkrete Wunsch-zu-Code-Beispiele dokumentieren.
- [ ] Beide Varianten in /dev tatsächlich durchlaufen, beobachtete Ergebnisse dokumentieren.
