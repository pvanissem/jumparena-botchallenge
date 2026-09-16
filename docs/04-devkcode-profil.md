# 04 - devkcode-Profil: Bot-Baumeister

## Besucherworkflow

Ein Besucher beschreibt in 15-20 Minuten seine Strategie. Der Agent bearbeitet
genau `client/src/bot/current-bot.js`: eine direkt abgebbare JavaScript-Datei
mit Metadaten, `apiVersion: 1`, `frameworkVersion: 2` und `decide(state, tools)`.
Gepruefte Bewegungshelfer kommen aus dem Framework. Ziele, Boingo-Nutzung und
eigene Bewegungsregeln darf der Besucher in derselben Bot-Datei bestimmen. Vor dem Bearbeiten die vorhandene Arbeitsdatei lesen und
bewahren: Ein Update ersetzt sie nicht durch die neue Vorlage. Deshalb nicht
behaupten, dass gerade die Vorlage laeuft.

1. Botname, Besucher-Anzeigename und Prioritaeten klaeren. Keine vorgeschriebene
   wortgleiche Begruessung. Bei fehlenden Namen bleiben freundliche Platzhalter.
2. Wunsch kurz bestätigen und konkrete Ziel-, Warte-, Sprung- oder Boingo-Regeln
   in der Bot-Datei individualisieren. Es gibt keinen Autoplaner.
3. Pro Tick höchstens `tools.run(command)` verwenden und dessen Actions
   unverändert zurückgeben. `tools.status()` ist vor der Entscheidung aktuell.
   Gleiche ID/Parameter setzen fort, neue ID ersetzt bewusst den Auftrag.
   Erfolg/Fehler bleiben bis zu einer neuen ID bestehen. Eigene rohe Actions
   und `return []` beenden den bisherigen Auftrag. Eigene Closure-Zustände
   bei Respawn/Epoch-Wechsel zurücksetzen.
4. Speichern: `/code` laedt automatisch neu. Gemeinsam den Bot laufen lassen
   und vorhandene Versuchstraces unter `client/src/bot/runs/` lesen.
5. Kurz erklaeren, was beobachtet wurde, und eine zum Wunsch passende Verbesserung
   vorschlagen. Strategieaenderungen nur mit Zustimmung des Besuchers; keine
   automatische Optimierung oder Erfolgsversprechen.
6. Dieselbe Arbeitsdatei unveraendert kopieren/hochladen. Kein Export- oder
   Buildschritt und kein Core-Code im Artefakt.

API: [02-bot-api.md](02-bot-api.md). Vollstaendige Referenzen:
`examples/strategies/visitor-builder.js`, `sprinter.js`, `collector.js`, `cautious.js`.
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

Nur der Betreiber fuehrt zwischen Sessions explizit `npm run reset-bot` aus,
nachdem die fertige Bot-Datei gesichert wurde. Das kopiert die Vorlage bytegenau
nach `current-bot.js` und leert `runs/`.
Kein Start, Update oder Vorschau-Lauf ersetzt vorhandenen Besuchercode automatisch.

## Offene Abnahme

Unit-/Contract-/Runtime-Tests beweisen keine echte Browserphysik oder Standlast.
Nicht ausgefuehrte Browser-, Last- oder Rechtepruefungen ausdruecklich offenlassen.


## Geprüfter Einstieg für Level 1

Die Startvorlage und `examples/strategies/messe-demo.js` enthalten eine offene
Beispielroute für Level 1. Sie wurde in vollständigen `/dev`-Läufen bis zum Ziel
geprüft. Ziele, Tempo, Sprunghalten und Wartepunkte stehen direkt in der Datei;
Checkpoint-Markierungen bleiben beim Einfügen zusätzlicher Schritte erhalten.
Andere Beispiele zeigen alternative Regeln, haben aber nicht denselben
Voll-Lauf-Nachweis. Die Framework-Helfer wählen keine Route.

In `/dev` zeigt die Toolbar den aktuellen Auftrag und dessen Grund. Mit
„Startpunkt“ lässt sich eine schwierige Stelle ab einem bestehenden Checkpoint
in frischer Welt wiederholen; „Neu“ startet denselben ausgewählten Abschnitt.
