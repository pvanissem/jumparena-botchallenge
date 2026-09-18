# 04 - devkcode-Profil: Bot-Baumeister

## Besucherworkflow

Ein Besucher beschreibt in 15-20 Minuten seine Strategie. Der Agent bearbeitet
genau `client/src/bot/current-bot.js`: eine direkt abgebbare JavaScript-Datei
mit Metadaten, `apiVersion: 1`, `frameworkVersion: 2` und `decide(state, tools)`.
Gepruefte Bewegungshelfer kommen aus dem Framework. Ziele, Boingo-Nutzung und
eigene Bewegungsregeln darf der Besucher in derselben Bot-Datei bestimmen. Vor dem Bearbeiten die vorhandene Arbeitsdatei lesen und
bewahren: Ein Update ersetzt sie nicht durch die neue Vorlage. Deshalb nicht
behaupten, dass gerade die Vorlage laeuft.

1. Botname (`name`) und Besucher-Anzeigename (`author`) sind Pflichtangaben vor dem
   Botbau. Fehlende Angaben gemeinsam erfragen; bereits ausdrücklich genannte Namen
   übernehmen. Ein Spitzname genügt als Anzeigename. Platzhalter in Vorlage/Beispielen
   ersetzen keine Besucherangaben, außer der Besucher wählt sie ausdrücklich selbst.
   Nicht ohne beide Angaben mit der Implementierung beginnen. Anschließend fehlende
   Strategieprioritäten klären; keine vorgeschriebene wortgleiche Begrüßung.
2. Wunsch kurz bestätigen und die Bewertung von `tools.options()` in der Bot-Datei
   individualisieren. Gewichte, Bedingungen und eigene Manöver dürfen verändert werden.
   Es gibt keine feste Levelroute; die Angebote stammen aus der sichtbaren Umgebung.
3. Pro Tick höchstens `tools.run(command)` verwenden und dessen Actions
   unverändert zurückgeben. `tools.status()` ist vor der Entscheidung aktuell.
   Gleiche ID/Parameter setzen fort, neue ID ersetzt bewusst den Auftrag.
   Erfolg/Fehler bleiben bis zu einer neuen ID bestehen. Eigene rohe Actions
   und `return []` beenden den bisherigen Auftrag. Eigene Closure-Zustände
   bei Respawn/Epoch-Wechsel zurücksetzen.
4. Speichern: `/code` laedt automatisch neu. Gemeinsam den Bot laufen lassen
   und vorhandene Versuchstraces unter `client/src/bot/runs/` lesen.
5. Kurz erklaeren, was beobachtet wurde, und eine zum Wunsch passende Verbesserung
   vorschlagen. Konkrete Fehler innerhalb des beauftragten Wunschs selbst beheben;
   bei anderen strategischen Prioritäten den Besucher entscheiden lassen. Keine
   Erfolgsversprechen.
6. Dieselbe Arbeitsdatei unveraendert kopieren/hochladen. Kein Export- oder
   Buildschritt und kein Core-Code im Artefakt.

API: [02-bot-api.md](02-bot-api.md). Vollstaendige Referenzen:
`examples/strategies/visitor-builder.js`, `sprinter.js`, `collector.js`.
Verbindliches kurzes Besucher-Steering: `client/src/bot/AGENTS.md`.

## Profilrechte

Arbeitsverzeichnis der Besuchersession ist `client/src/bot/`. Der Betreiber
muss die folgenden Rechte im tatsaechlich verwendeten externen devkcode-Profil
bereitstellen und pruefen. **Dieses Repository behauptet keine bereits
installierte externe Profilkonfiguration.**

| Bereich | Benoetigte Rechte |
| --- | --- |
| `client/src/bot/current-bot.js` | Lesen und Schreiben |
| lokales Steering, API-Dokumentation, `examples/strategies/` | Nur Lesen |
| `client/src/bot/runs/` | Nur Lesen |
| `npm run -s bot:trace`, Skript und importierte Trace-Module | Lokale Read-only-Ausführung / Lesen |
| Navigation, Framework, Server, Buildskripte, Steering | Keine Schreibrechte |

Profilrechte sind Betreiberarbeit. Die bestehende Vorschau mit ihrer lokalen
Trace-Persistenz, nicht der Besucher-Agent, schreibt die Versuchstraces.
Fuer den Besucherworkflow gelten keine neuen Feature-Specs pro Botstrategie;
Framework-/Repository-Aenderungen folgen weiterhin Root-Spec-Gate und TDD.

## Bestehende Vorschau

Die Station verwendet den normalen Start `npm run dev` im Repository-Root und
die Browseransicht `/code`. Es gibt keinen zusaetzlichen Einrichtungs- oder
Verbindungsschritt. Bei jeder gespeicherten Aenderung an `current-bot.js`
laedt Vite die Seite vollstaendig neu; Level und Worker starten frisch.
In der Vorschau den Bot laufen lassen und zusehen. Ist die Seite nicht offen,
den Betreiber bitten, `/code` zu oeffnen; der Agent startet keine GUI selbst.

## Ergebnisse und Diagnose

Zuerst den [kompakten Trace-Reader](10-trace-reader.md) verwenden: aus dem
Besucher-Arbeitsverzeichnis `npm --prefix ../../.. run -s bot:trace`.
`list` zeigt die letzten Versuche, `focus DATEINAME TICK` einen begrenzten Ausschnitt.
Der Standard sucht nur passende Bot-Quellrevisionen. Der Betreiber muss die
Read-only-Ausführung im tatsächlichen externen Profil erlauben; Node 22.14+ ist nötig.


Vorschau-Traces unter `runs/` umfassen einzelne Versuche zwischen Respawns,
nicht den Gesamtlauf. Nur tatsaechlich vorhandene Traces auswerten und vor der
Zuordnung zum aktuellen Code `run.botRevision` pruefen. Zuerst `run`, `summary`
und `findings` lesen, dann hoechstens zwei relevante `events`-/`windows`-Ausschnitte.
Trace v2 zeigt
Navigation, relevante Collider/Utilities und State-/Action-Korrelation; die
Ausgabe ist begrenzt und markiert Kuerzungen. `events` sind Fakten, `findings`
Hinweise. Persistierte v1-Traces bleiben ohne erfundene Navigationsabsicht lesbar.
Bei fehlendem oder veraltetem Trace keine Diagnose zum aktuellen Bot erfinden.
Maximal zwei Beobachtungen erklaeren und eine Verbesserung vorschlagen.
Technische Gueltigkeit, spielerisches Ergebnis und Strategiewunsch getrennt
bewerten; aus einem Lauf keine allgemeine Leistungssteigerung ableiten.

## Release und Sessionwechsel

Vorschau, Upload und Turnier benoetigen denselben Framework-Release.
Dieser wird vor einer Turnierserie eingefroren; ein Update kann unveraenderte
Bot-Dateien anders laufen lassen. Die Bewegungshelfer bleiben im Framework; die Strategie gehört in die Besucherdatei.
Framework-v1-Bots müssen gezielt migriert oder neu erzeugt werden. Reine Action-Bots
ohne Framework-Version bleiben nutzbar.

Nur der Betreiber fuehrt zwischen Sessions explizit `npm run reset-bot` aus.
Der Befehl sichert die vorhandene Bot-Datei zuerst unverändert unter
`bots/<author>-<name>-<timestamp>.js` im Repository-Root. Namen werden für
Dateinamen bereinigt; fehlende oder nicht statisch lesbare Metadaten erhalten
`unbekannt` bzw. `unbenannt`. Besuchercode wird dabei nicht ausgeführt.
Vorhandene Archive werden niemals überschrieben, auch unveränderte Vorlagen
werden gesichert. Das lokale Archiv ist git-ignoriert.
Erst nach erfolgreicher Sicherung wird die Vorlage bytegenau nach
`current-bot.js` kopiert und `runs/` geleert. Ohne vorhandene Bot-Datei wird
direkt die Vorlage angelegt. Scheitert die Sicherung, bleiben Bot und Traces erhalten.

Vor dem Reset prüft der Befehl den Git-Status. Änderungen außerhalb von
`client/src/bot/current-bot.js` (auch gestagte, gelöschte und unversionierte
Dateien) lösen eine auffällige Warnung mit Dateiliste aus. Git-ignorierte Dateien
werden wie bei normalem `git status` nicht gemeldet. Der Betreiber prüft diese
Änderungen selbst; es gibt kein automatisches Git-Restore. Ist die Git-Prüfung
nicht möglich, erscheint ebenfalls eine Warnung; Sicherung und Reset werden
trotzdem versucht. Das ersetzt keine Sandbox oder Zugriffsbeschränkung.
Kein Start, Update oder Vorschau-Lauf ersetzt vorhandenen Besuchercode automatisch.

## Offene Abnahme

Unit-/Contract-/Runtime-Tests beweisen keine echte Browserphysik oder Standlast.
Nicht ausgefuehrte Browser-, Last- oder Rechtepruefungen ausdruecklich offenlassen.


## Checkpoint-Strategien

Die API liefert sichtbare Fahnen in `state.checkpoints` mit Kontaktfläche,
`reached` und `active`. `state.respawnPoint` nennt den bekannten Wiedererscheinungspunkt.
Der Agent kann damit „erst Checkpoint sichern, dann Risiko“ als eigene Regel
umsetzen; entscheidend ist der beobachtete Kontakt, nicht bloß das Überfliegen.
Details und Kompatibilität stehen in `docs/02-bot-api.md`.

## Einstieg und Spielprüfung

Die Startvorlage ist eine leere Strategie-Hülle mit `weights`, `score`,
`selectMovement` und Auftragsverwaltung in `decide`. `selectMovement` liefert
zunächst `null`; reine Gewichtsänderungen bewegen den Bot daher noch nicht.
Der Besucher-Agent füllt diese Auswahl passend zum Wunsch aus und darf auch
Bewertung, eigene Regeln und Auftragsfortsetzung verändern. `visitor-builder.js`
zeigt eine ausführlichere Bewertung wahrnehmungsbasierter Angebote samt
Fehlversuchssperre und beobachteten Feuerphasen. Die historische `messe-demo.js`-Route
ist kein allgemeines Besucherbeispiel. Aktuelle Laufnachweise und Einschränkungen
stehen in `.features/bot-strategy-layer/environment-navigation.md`.

In `/dev` zeigt die Toolbar den aktuellen Auftrag und dessen Grund. Mit
„Startpunkt“ lässt sich eine schwierige Stelle ab einem bestehenden Checkpoint
in frischer Welt wiederholen; „Neu“ startet denselben ausgewählten Abschnitt.
