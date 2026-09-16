# 04 - devkcode-Profil: Bot-Baumeister

## Besucherworkflow

Ein Besucher beschreibt in 15-20 Minuten seine Strategie. Der Agent bearbeitet
genau `client/src/bot/current-bot.js`: eine direkt abgebbare JavaScript-Datei
mit Metadaten, `apiVersion: 1`, `frameworkVersion: 1` und `decide(state, tools)`.
Navigation, Sprungphysik und Recovery kommen aus dem Framework, nicht aus einer
zweiten Besucherdatei. Vor dem Bearbeiten die vorhandene Arbeitsdatei lesen und
bewahren: Ein Update ersetzt sie nicht durch die neue Vorlage. Deshalb nicht
behaupten, dass gerade die Vorlage laeuft.

1. Botname, Besucher-Anzeigename und Prioritaeten klaeren. Keine vorgeschriebene
   wortgleiche Begruessung. Bei fehlenden Namen bleiben freundliche Platzhalter.
2. Wunsch kurz bestaetigen und `choose(context, options)` individualisieren:
   Fruchtwert, Umweg, Risiko, Fortschritt/Zeit, Leben oder Endspurt.
3. `tools.navigate({ choose })` einmal synchron aufrufen und dessen Actions
   unveraendert zurueckgeben. Keine konkurrierenden Richtungs-/Sprungreflexe.
4. Speichern: `/code` laedt automatisch neu. Gemeinsam den Bot laufen lassen
   und vorhandene Versuchstraces unter `client/src/bot/runs/` lesen.
5. Kurz erklaeren, was beobachtet wurde, und eine zum Wunsch passende Verbesserung
   vorschlagen. Strategieaenderungen nur mit Zustimmung des Besuchers; keine
   automatische Optimierung oder Erfolgsversprechen.
6. Dieselbe Arbeitsdatei unveraendert kopieren/hochladen. Kein Export- oder
   Buildschritt und kein Core-Code im Artefakt.

API: [02-bot-api.md](02-bot-api.md). Vollstaendige Referenzen:
`examples/strategies/sprinter.js`, `collector.js`, `cautious.js`.
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
Bot-Dateien anders laufen lassen. Die Navigation bleibt im Framework,
nicht als Bibliothek in der Besucherdatei.

Nur der Betreiber fuehrt zwischen Sessions explizit `npm run reset-bot` aus,
nachdem die fertige Bot-Datei gesichert wurde. Das kopiert die Vorlage bytegenau
nach `current-bot.js` und leert `runs/`.
Kein Start, Update oder Vorschau-Lauf ersetzt vorhandenen Besuchercode automatisch.

## Offene Abnahme

Unit-/Contract-/Runtime-Tests beweisen keine echte Browserphysik oder Standlast.
Nicht ausgefuehrte Browser-, Last- oder Rechtepruefungen ausdruecklich offenlassen.
