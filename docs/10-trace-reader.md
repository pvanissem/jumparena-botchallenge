# Kompakte Trace-Diagnose

Voraussetzung: Node.js 22.14 oder neuer. Keine neue Installation, kein Server,
kein Build. Der Reader liest ausschließlich lokale Dateien. Roh-Traces bleiben
unverändert; die Ersparnis entsteht beim Lesen durch den Agenten.

## Aufrufe

Aus dem Repository-Root:

```sh
npm run -s bot:trace
npm run -s bot:trace -- list
npm run -s bot:trace -- summary 2026-09-16T12-42-12-581Z.json
npm run -s bot:trace -- focus 2026-09-16T12-42-12-581Z.json 400
```

Die Dateinamen und den Tick immer aus der tatsächlichen Ausgabe übernehmen;
die letzten beiden Zeilen zeigen nur die Syntax. Namen werden unter
`client/src/bot/runs/` gesucht, explizite Pfade sind ebenfalls möglich.

Im Besucher-Arbeitsverzeichnis `client/src/bot/` stattdessen:

```sh
npm --prefix ../../.. run -s bot:trace
npm --prefix ../../.. run -s bot:trace -- list
npm --prefix ../../.. run -s bot:trace -- focus DATEINAME TICK
```

## Arbeitsablauf

1. Ohne Argumente: neuester gespeicherter Versuch zur Revision der aktuellen
   `current-bot.js`. Ohne Treffer klare Meldung; kein Ersatz durch einen alten Bot.
2. `list`: höchstens fünf neueste lesbare Versuche mit Session, Revision, Ergebnis
   und `currentCode`. Jeder Eintrag ist ein Versuch, keine ganze Session.
3. `summary DATEI`: Metadaten, Summary, höchstens fünf abgeleitete Hinweise,
   sechs letzte Ereignisse und acht gespeicherte Fenster; keine Roh-Samples.
4. `focus DATEI TICK`: ±15 Ticks, höchstens sieben ausgewählte Zeitpunkte und ein
   Geometrie-Snapshot des nächsten gespeicherten Ticks in diesem Bereich.
   `coverage` zeigt fehlende Ticks und die Zahl der tatsächlich gezeigten Samples.
   Pro Objektart höchstens sechs Objekte, bekannte Ziel-IDs zuerst. Eine Tile-Matrix
   wird nicht ausgegeben. Fehlende ältere Checkpoint-Daten bleiben `null`.

Ausgabe: JSON, höchstens 12000 Zeichen. Das ist eine Zeichengrenze, keine feste
Tokenzahl. Überschreitet ein ungewöhnlicher Datensatz sie, wird eine ausdrückliche
Ersatzmeldung ausgegeben; niemals abgeschnittenes JSON. Für seltene Detailfragen
gezielt einen kleinen Ausschnitt der angegebenen Originaldatei lesen.

## Aussagegrenzen

`currentCode` vergleicht die JavaScript-Quellrevision, nicht den Framework-Release.
`attempt.flushedAt` zeigt, wann die Datei zuletzt aktualisiert wurde. Gespeichertes
`status: running` beweist nicht, dass der Browser jetzt noch läuft.
`hints` sind bestehende abgeleitete Hinweise, keine bewiesenen Fehlerursachen.
`traceTruncation` bezeichnet Kürzungen der Originalaufzeichnung;
`omitted*` und `coverage` beschreiben zusätzlich ausgelassene Reader-Ausgaben.
Keine fehlenden Frames interpolieren. Ein `focus`-Snapshot ist keine vollständige
Flugbahn; verschiedene Fenster können Lücken enthalten.

Bei mehreren Respawns über `sessionId` zuordnen, aber Todeszahlen, Früchte oder
Laufzeiten nicht unbesehen aus Versuchssummaries aufsummieren. Die begrenzte Liste
kann ältere Versuche derselben Session auslassen.

## Profilrechte

Der Betreiber muss die Ausführung dieses lokalen Read-only-Befehls im externen
Agent-Profil zulassen, plus Leserechte auf das Skript, seine Trace-Module,
`current-bot.js` und `runs/`. Das Repository ändert keine externen Profilrechte.
Der Besucher-Agent darf das Tool nutzen, aber nicht dessen Implementierung ändern.
