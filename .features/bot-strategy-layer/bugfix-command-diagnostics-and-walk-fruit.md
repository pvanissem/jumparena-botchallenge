# Bugfix: Auftragsdiagnosen erhalten und Früchte auf Laufwegen bewerten

## Status

Vom Nutzer am 17.09.2026 mit „ja“ explizit zur Umsetzung freigegeben.

Gemeinsamer Umfang aus dem übergebenen Vorschlag vom 17.09.2026.
Bezug: `environment-navigation.md`, `.features/bot-trace-reader/requirements.md`,
`docs/02-bot-api.md` (Bewegungsangebote und run/status),
`docs/03-architektur.md` (Versuchstraces) und `docs/10-trace-reader.md`.
Die API-Dokumentation beschreibt `fruitValue` bislang als Flugbahnwert;
dieses Spec präzisiert ihn für die hier beschriebenen Laufangebote.

## Aktuelles Verhalten (Bug)

### Fehlerdiagnosen gehen bei der nächsten Entscheidung verloren

Der Controller kann beim Beobachten des aktuellen States einen bisherigen Auftrag
mit `wrong-landing` beenden. Wartet der Bot anschließend mit `[]`, fehlt die
Navigationsdiagnose im Worker-Ergebnis. Startet er einen neuen Auftrag, beschreibt
die Diagnose nur diesen. Fehlergrund und Bezug zum fehlgeschlagenen Auftrag gehen
dadurch vor der Trace-Aufzeichnung verloren.

### Früchte auf Laufwegen werden nicht bewertet

`movementOptions()` schätzt Fruchtwerte für simulierte Flugbahnen, setzt den Wert
bei Laufangeboten jedoch immer auf null. Das betrifft normale Laufwege,
Annäherungsangebote vor inaktiven Loderix und Rückzüge. Eine fruchtorientierte
Bewertung kann daher den Fruchtgewinn beim Laufen nicht berücksichtigen.

## Erwartetes Verhalten

### AK-1: Statuswechsel vor der Besucherentscheidung sichern

- WHEN die Beobachtung vor `decide()` den Status des bisherigen Auftrags ändert
  SHALL DAS SYSTEM diesen Statuswechsel mit Auftrags-ID und vorhandenem
  Fehlergrund vor der Besucherentscheidung erfassen.
- WHEN ein Auftrag mit `wrong-landing` fehlschlägt und der Bot anschließend wartet
  SHALL DAS SYSTEM den Fehlergrund und den bisherigen Auftragsbezug im Trace
  dieses Ticks erhalten.
- WHEN ein Auftrag fehlschlägt und der Bot im selben Tick einen neuen Auftrag startet
  SHALL DAS SYSTEM den Fehler des bisherigen Auftrags und den aktuellen Auftrag
  unterscheidbar aufzeichnen, ohne den Fehler dem neuen Auftrag zuzuordnen.
- WHEN der Trace-Reader einen solchen Tick auswertet SHALL DAS SYSTEM den
  aufgezeichneten Statuswechsel einschließlich Fehlergrund und Auftragsbezug
  in der kompakten Diagnose anzeigen.

### AK-2: Fruchtwert für den angebotenen Laufweg schätzen

- WHEN ein Laufangebot erzeugt wird SHALL DAS SYSTEM sichtbare Frucht-Collider
  entlang des tatsächlich angebotenen, geprüften Laufwegs mit dem Bot-Collider
  auf Berührung prüfen und deren Werte zum geschätzten `fruitValue` addieren.
- WHEN derselbe Frucht-Collider entlang eines Angebots mehrfach berührt wird
  SHALL DAS SYSTEM seinen Wert für dieses Angebot nur einmal zählen.
- WHEN ein Annäherungs- oder Rückzugsangebot erzeugt wird SHALL DAS SYSTEM
  dessen Fruchtwert nach derselben Regel bestimmen.
- WHEN eine Frucht außerhalb des angebotenen Wegs liegt, insbesondere hinter
  einem verkürzten Laufziel, SHALL DAS SYSTEM sie für dieses Angebot nicht zählen.
- WHEN ein fruchtorientierter Bot zwischen einem Laufweg durch eine Frucht und
  einem Sprung darüber ohne Fruchtkontakt wählt SHALL DAS SYSTEM ihm durch die
  korrekten Angebotswerte die Bevorzugung des Laufwegs ermöglichen.

## Was bleibt unverändert (Regressions-Schutz)

- Bewegungsentscheidung und Gewichtung bleiben in der Besucherstrategie.
- Physik, Scoring, Level, Sichtweite und bestehende Sicherheitsprüfungen bleiben erhalten.
- Die Angebotsprüfung nutzt ausschließlich den sichtbaren State; `fruitValue`
  bleibt eine Schätzung und bestätigt keine tatsächliche Sammlung.
- Bestehende Flugbahnangebote, rohe Actions sowie `tools.run()` und `tools.status()`
  behalten ihren Vertrag. Der Besucherbot wird für den Framework-Fix nicht umgebaut.
- Alte Traces bleiben ohne erfundene Statuswechsel lesbar. Diagnosevalidierung,
  Größenbegrenzungen und die kompakte, rein lesende Reader-Ausgabe bleiben erhalten.
- Auftragswechsel, Reset und Respawn dürfen keine alten Fehler als neue Ereignisse
  fortschreiben oder fremden Aufträgen zuordnen.

## Root Cause (nach Analyse)

1. `client/src/sandbox/botWorkerRuntime.ts` ruft vor `decide()`
   `current.status(state)` auf, verwirft jedoch dessen Rückgabe. Nach der Entscheidung
   wird der Status nur ausgewertet, wenn `tools.run()` benutzt wurde. Ein neuer
   `run()` ersetzt den bisherigen Controllerstatus; beim Warten wird anschließend
   der Controller zurückgesetzt. Der Trace erhält keinen unabhängigen Snapshot
   des zuvor beobachteten Statuswechsels.
2. `packages/bot-navigation/src/options.ts` übergibt für alle drei Arten von
   Laufangeboten den konstanten Fruchtwert null. Nur die Flugbahnsimulation prüft
   Frucht-Collider und dedupliziert anhand der Frucht-ID.
3. `client/src/game/trace/navigationDiagnostic.ts` erlaubt nur die bisherigen
   Diagnosefelder. Eine ergänzende Statuswechselinformation muss deshalb durch
   Typen, Validierung, Aufzeichnung und Reader transportiert werden.

## Fix-Ansatz

### Fehlerdiagnosen

Vor der Besucherentscheidung einen unabhängigen Snapshot des beobachteten
Statuswechsels samt bisherigem Auftragsbezug sichern. Die Information additiv und
begrenzt durch den bestehenden Diagnose-/Trace-Pfad transportieren. Der Status
des anschließend ausgeführten Auftrags bleibt davon unterscheidbar. Den Reader
um die Darstellung ergänzen und alte Daten ohne diese Information weiterhin lesen.

### Laufweg-Früchte

Die sichtbaren Frucht-Collider gegen den vom Bot-Körper überstrichenen Bereich
zwischen Ausgangsposition und endgültigem Laufziel prüfen. Pro Angebot jede
Frucht-ID höchstens einmal zählen. Normale Lauf-, Annäherungs- und Rückzugsangebote
verwenden dieselbe Berechnung; eine spätere Zielverkürzung darf keine Früchte
außerhalb des endgültigen Wegs im Wert belassen. Die API-Dokumentation entsprechend
präzisieren.

## Umsetzung und Verifikation nach Freigabe

- [x] Regressionen zuerst rot: echter Controller mit `wrong-landing` → Warten
      und `wrong-landing` → neuer Auftrag im Worker; Fehler und alter Auftragsbezug
      müssen bis in die Trace-Diagnose erhalten bleiben.
- [x] Diagnosepfad minimal korrigieren; Reader-Darstellung, Validierung,
      Alt-Trace-Kompatibilität und Schutz gegen veraltete Statuswechsel testen.
- [x] Laufweg-Regressionen zuerst rot: berührte Frucht, Mehrfachberührung,
      Frucht außerhalb/oberhalb des Wegs sowie hinter einem verkürzten Ziel;
      Annäherung und Rückzug einschließen.
- [x] Fruchtwertberechnung für Laufangebote implementieren und fruchtorientierte
      Auswahl zwischen Lauf durch die Frucht und Sprung darüber testen.
- [x] Betroffene API-/Trace-Dokumentation aktualisieren und refaktorieren,
      während die relevanten Tests grün bleiben.
- [x] Relevante Navigation-, Worker-, Trace-/Reader- und Strategie-Tests sowie
      TypeScript-Prüfungen der betroffenen Workspaces ausführen; Ergebnisse und
      Abgleich mit AK-1/AK-2 dokumentieren.

## Abschluss am 17.09.2026

- AK-1 erfüllt: optionaler `statusTransition`-Snapshot vor `decide()`, getrennt
  vom neuen Auftrag; streng validiert und kopiert, als Recorder-Fensteranker
  berücksichtigt und in Reader-Summary/Focus sichtbar. Regressionen mit echtem
  Controller prüfen Warten, neuen Auftrag und Fortsetzung der fehlgeschlagenen ID;
  Folgeticks und Respawn wiederholen den Fehler nicht. Alte Traces bleiben lesbar.
- AK-2 erfüllt: einheitliche Collider-Prüfung beim Hinzufügen jedes Laufangebots
  gegen dessen endgültigen überstrichenen Bereich. Tests decken Mehrfachkontakt,
  mehrere Früchte, Linksrichtung, verschobene Geometrie, Annäherung, Rückzug und
  ausgeschlossene Früchte ab. Fruchtorientierte Auswahl bevorzugt den Laufweg,
  während reine Fortschrittsbewertung im selben Szenario einen Sprung wählt.
- Rot-Nachweis: zunächst fünf fehlschlagende Diagnose-/Recorder-Tests, anschließend
  drei Reader-Summary-Tests und sechs Laufweg-Regressionen; danach jeweils grün.
- Abschlussprüfung: **262 Tests in 23 Dateien bestanden** mit
  `npm test -- packages/bot-navigation client/src/sandbox client/src/game/trace client/src/bot/strategyArtifacts.test.ts client/vite/botTracePlugin.test.ts`.
- `npx tsc --noEmit -p client/tsconfig.json` und
  `npx tsc --noEmit -p packages/bot-navigation/tsconfig.json` bestanden.
- Biome-Prüfung der elf geänderten TypeScript-Dateien ohne Fehler; zwei bereits
  vorhandene Non-null-Assertion-Warnungen in `BotRunRecorder.test.ts`.
  `git diff --check` bestanden.
