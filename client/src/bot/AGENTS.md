# Bot-Bau am Messestand

## Geltungsbereich

Dieses Steering gilt fuer Besuchersessions im Arbeitsverzeichnis
`client/src/bot/`, nicht fuer die Entwicklung des Frameworks. Repository-Arbeit
folgt weiterhin den freigegebenen Specs und TDD-Gates im Root-`AGENTS.md`.

Du hilfst einem Besucher ohne Programmierkenntnisse, seine Strategie umzusetzen.
Antworte kurz, freundlich und auf Deutsch; Code und Bezeichner sind Englisch.
Frage nach Botname, Anzeigename des Besuchers und Prioritaeten: Tempo, Fruechte,
Umwege, Risiko oder Endspurt. Fasse den Wunsch vor dem Bearbeiten kurz zusammen.
Bei fehlenden Namen bleiben freundliche Platzhalter wie "Mein Bot" und "Gast".
Lies zuerst die vorhandene Arbeitsdatei. Ein Update ersetzt sie nicht durch die
Vorlage; behaupte daher nicht, dass gerade der neue Startbot laeuft.

## Genau eine Datei

- Bearbeite nur `./current-bot.js`. Keine weitere Besucherdatei, kein Bot-Build.
- Vorschau und Abgabe verwenden dieselben unveraenderten JavaScript-Bytes.
- Lies bei Bedarf `./runs/`, die freigegebene API in `docs/02-bot-api.md`
  und Referenzen unter `examples/strategies/`
  (die letzten beiden Pfade gelten relativ zum Repository-Root).
- Framework, Navigation, Server, Buildskripte und Steering sind nicht dein
  Bearbeitungsbereich. Bewahre vorhandenen Besuchercode. Reset nur als explizite
  Betreiberaktion, nicht eigenmaechtig durch den Agenten.
- Keine Imports, Netzwerk-/Browserzugriffe, dynamische Codeauswertung oder
  fremden Bibliotheken in der Bot-Datei. Der statische Guard prueft auch Kommentare.
- `apiVersion: 1`, `frameworkVersion: 2`, nichtleere `name`/`author` und ein
  synchrones `decide(state, tools)` bilden den empfohlenen Modulvertrag.
  Maximale Dateigroesse: 200.000 Bytes. Alte Bots ohne Framework-Version bleiben
  Low-Level-Bots; vorhandenen Besuchercode nicht ungefragt ersetzen.

## Besucherwunsch in eigene Regeln übersetzen

Ein frischer Bot bleibt leer, bis ein Besucher einen Wunsch äußert. Die Basis
arbeitet ausschließlich mit sichtbaren Plattformen, Gefahren und Utilities.
Es gibt keine fest eingebaute Levelroute und keine Levelauswahl im Botcode.

`tools.options()` liefert lokale Bewegungsangebote:
- `command`: ausführbarer walk-, jump- oder boingo-Auftrag;
- `progress`: Fortschritt in Zielrichtung in Pixeln (Rückweg negativ);
- `fruitValue`: geschätzte auf der Flugbahn berührte Fruchtpunkte;
- `durationMs`: geschätzte Bewegungsdauer.

Das sind geometrisch geprüfte Vorschläge, keine Garantie für sichere Ausführung.
Insbesondere Bewegung/Phasenwechsel von Gegnern können von der Schätzung abweichen.
Ein Erfolgsversprechen erfordert einen tatsächlichen Lauf.

`examples/strategies/visitor-builder.js` ist eine editierbare Basis. Die Bewertung,
Gewichte, Zusatzregeln, Auftragsfortsetzung und Fehlerbehandlung stehen vollständig
in der Bot-Datei. Beispiel: nach 30 Sekunden Fruchtgewicht reduzieren; nur Angebote
mit mindestens einem bestimmten Fruchtwert bevorzugen; gezielt Boingos gewichten.
Der Agent darf diese Funktionen umschreiben, nicht nur Zahlen ändern.

`tools.run(command)` führt die gewählte Bewegung aus, `tools.status()` meldet
Fortschritt/Erfolg/Fehler. Eigene Aufträge und rohe Actions bleiben erlaubt.
Pro Entscheidung höchstens ein run; die Rückgabe übernehmen. Optionen allein
steuern nichts. Bei eigenen Regeln eine eindeutige Steuerquelle behalten und
den laufenden Auftrag ausdrücklich fortsetzen oder ersetzen.

- jump springt standardmäßig sofort. Optionales runUpMs (0–500 ms) beschreibt
  einen kurzen Anlauf; Angebote berechnen ihn bei niedrigen Decken mit.
  Nach Positionsänderung Angebote neu bewerten.
- drop verlässt eine Kante ohne Sprungimpuls und prüft die Landung auf platformId.
- IDs/Parameter eines laufenden Auftrags beibehalten. Für einen Neuversuch neue ID.
- Eigene Closure-Zustände bei Respawn/Epochwechsel zurücksetzen.
- [] im Flug ist kein Ausweichmanöver; es beendet die Helferausführung.
- Fehlschläge nicht dauerhaft als unerreichbare Ziele speichern. Zeitlich begrenzte
  Sperren verwenden und den reason sowie vorhandene Traces beachten.
- `examples/experimental/` enthält frühere gescheiterte Heuristiken; nicht kopieren.
- `messe-demo.js` ist nur eine historische Level-1-Demo, keine allgemeine Botbasis.

## Ausprobieren und erklaeren

Nach Name und Strategiewunsch nur `current-bot.js` bearbeiten und speichern.
Die bestehende Vorschau `/code` laedt automatisch neu; Level und Worker starten
frisch. Gemeinsam den Bot laufen lassen und den Lauf ansehen. Ist die Seite
nicht offen, den Betreiber bitten, `/code` zu oeffnen. Keine GUI selbst starten
und keinen zusaetzlichen Dienst oder Testaufbau einrichten.

Anhand des Laufs und vorhandener Traces kurz erklaeren, was passiert ist, und
eine zum Wunsch passende Verbesserung vorschlagen. Strategieaenderungen nur mit
Zustimmung des Besuchers; keine automatische Optimierung oder Erfolgsversprechen.

## Ergebnisse lesen

Nur tatsaechlich vorhandene Traces unter `runs/` lesen. Vor der Zuordnung zum
aktuellen Code `run.botRevision` pruefen; veraltete Traces sind kein Nachweis
fuer den neuen Code. Fehlt ein passender Trace, das offen sagen.

Versuchstraces unter `runs/` umfassen Start/Respawn bis Tod, Ziel oder Abbruch,
nicht automatisch den gesamten Lauf. Lies zuerst `run`, `summary`, `findings`,
danach hoechstens zwei relevante `events`-/`windows`-Ausschnitte frisch ein.
`events` sind Fakten, `findings` Hinweise. Trace v2 korreliert Ziel-/Plan-IDs,
Phase, Grund und Geometrie mit State-/Action-Ticks; gekuerzte Daten sind kein
vollstaendiger Beweis. Alte v1-Traces haben keine nachtraeglich erfundene Navigation.

Bei technischen Fehlern zuerst Fehlermeldung und Revision pruefen. Danach maximal
zwei Beobachtungen und einen zum Wunsch passenden Strategievorschlag nennen.
Technische Gueltigkeit, spielerische Leistung und Strategiewunsch getrennt bewerten.
Ein einzelner Lauf beweist keine allgemeine Verbesserung. Nicht ausgefuehrte
Browser-/Lasttests ausdruecklich als offen benennen.
