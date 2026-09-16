# Aktueller Stand: v2-Werkzeugkasten und vollständiger /dev-Lauf

Die Abschnitte darunter sind historische Übergaben. Aktuell gilt
[abnahme-v2.md](abnahme-v2.md): run/status mit walk/jump/boingo,
alter Planner entfernt, Framework-Version 2. Level 1 wurde in vollständigen
echten /dev-Läufen mehrfach abgeschlossen, zuletzt 44,850 s ohne Respawn.
Startvorlage und current-bot sind die offene Level-1-Beispielroute.
1.171 Tests + Workspace-Build grün. Nutzer verlangt autonome Arbeit,
keine Freigabeschleifen und den Fokus auf /dev statt Turniertests.

# Uebergabe: Zwischenstand, nicht als messereif abgenommen

## Fortsetzung 2026-09-16

Der Nutzer hat die Übernahme der Stash-Erfahrungen in die Framework-Navigation
und den Umbau der lokalen `current-bot.js` ausdrücklich beauftragt. Der folgende
alte Stopp beschreibt die vorherige Übergabe, nicht diesen neuen Auftrag.
Aktueller Änderungsumfang, Testnachweise und verbleibende Live-Probleme stehen
im Abschnitt „Fortsetzung am 2026-09-16“ von `bugfix.md`. Weiterhin keine
Leveländerung und keine zusätzliche Testplattform. Noch nicht messereif.

## Besucher-Manöver: implementierte Fortsetzung

Nach „ja bitte mach es besser“ sind eigene Manöver additiv verfügbar:
`tools.move`, `continue`, `status`, `cancel`; `navigate` bleibt optional.
`move` akzeptiert eine sichtbare Plattform, absolutes Landeziel und optional
Boingo/Sprung/Sprint/Sprungdauer. Ablehnungen liefern einen Grund und keine
Ersatzroute. Rohe Actions übernehmen die Kontrolle und löschen den alten Plan.
Der Besucher-Agent darf diese Entscheidungen in `current-bot.js` ändern;
Steering und API-Doku sind entsprechend korrigiert.

`examples/strategies/visitor-builder.js` ist das neue editierbare Beispiel und
liegt auch in der lokalen, ignorierten `current-bot.js` (Messe-Werkstatt).
Die frühere Besucherdatei bleibt unter
`/private/tmp/coin-quest-current-bot-before-messe-mix-20260916.js` gesichert.
Stash und Remote bleiben unverändert; Änderungen sind noch nicht committet.

Verifikation: 1.239 Tests in 143 Dateien erfolgreich, Workspace-Build erfolgreich,
`git diff --check` sauber. Unabhängiges Review fand einen zwischen zwei
Beobachtungen vollständig abgeschlossenen kurzen Sprung; Regression zuerst rot,
danach Fix und komplette Prüfung grün. Boingo-Zielwahl und geänderte Auswahl nur
über Besucher-Code sind durch den echten Worker/Navigator getestet, ebenso
Raw-Action-Übernahme, Abbruch, Tick-Budget und Respawn.

Live: `/code` lädt Revision `bot-c19a9fb8`, ohne technische Botfehler in den
geprüften Traces. Lauf `2026-09-16T07:40:05.494Z` wartete zunächst längere Zeit
auf einer kleinen Plattform, kam dann weiter und starb nach rund 47 s am
Kugelblitz bei x≈1027 (58 Fruchtpunkte). Andere aktuelle Läufe kamen bis hinter
x=3500 und starben an Gegnern. Kein Nachweis einer zuverlässigen Zielankunft
oder allgemeinen Leistungssteigerung. Die belegte Verbesserung ist der nun
wirksame Eingriff aus der Besucherdatei, nicht ein fertig gelöstes Level.

## Nutzerauftrag und Grenzen

Der Nutzer hat die Implementierung gestoppt und diesen Zwischenstand fuer einen
neuen Agenten angefordert. Keine weitere Umsetzung ohne neuen Auftrag.

Ziel ist ein besseres Messestanderlebnis, kein Ausbau von Testinfrastruktur.
Nur eine Bot-Datei als Arbeitsdatei und Abgabe. Hilfen im Framework sind erlaubt.
`/code` verwendet das urspruengliche Level 1. Keine Levelaenderungen.
Eine zwischenzeitlich gebaute Testseite/CLI/Jobverwaltung wurde auf Nutzerwunsch
komplett entfernt. Nicht wieder einfuehren. Historische Specs enthalten noch
ueberholte Abschnitte; deren Statuskorrekturen und diese Uebergabe haben Vorrang.
Der Nutzer moechte keine weiteren Freigaberunden oder umfangreiche Feature-Doku.

## Enthaltene Aenderungen

- Reale Hazardpositionen/-geschwindigkeiten, freigelegte Fruechte, verbleibende
  Block-Collider und skalierte Body-Abmessungen im Bot-State.
- Worker-Ready-Barriere, sauberes Dispose, Tick-/Epochenkorrelation und
  Actions vor dem folgenden Physikschritt statt erst danach.
- `@arena/bot-navigation`: lokale Planung und Planausfuehrung.
  `frameworkVersion: 1` aktiviert `decide(state, tools)` mit `tools.navigate`.
  Alte Bots ohne dieses Feld behalten den bisherigen Aufruf.
- Kurzes Template, drei komplette Referenzbots, vereinfachtes Besucher-Steering.
- Bestehende `/code`-Traces mit Navigationsgruenden und relevanter Geometrie;
  keine neue Bedienoberflaeche. Alte Toolkit-Tests als Legacy-Fixture erhalten.

## Zuletzt bearbeiteter Fehler

Besucherbot Fluppo blieb nach der ersten Luecke bei x=471,07 stehen,
in einem anderen Versuch bei x=901,35. Keine Runtimefehler; Framework bot keine
Route mehr an. Ursache: Ueberkopfblock behindert Sprung, vorbereitender Anlauf
und passende Zwischenlandungen fehlten. Dazu wurde ein leerer Suchcache bei
veraenderten Gefahren auch nach der Blockierpause wiederverwendet.

Die unmittelbar letzten, noch nicht gemeinsam endgeprueften Aenderungen:

- `packages/bot-navigation/src/planner.ts`: tragfaehige Anlaufpunkte und innere
  Landeziele, Puffer an Steuerungsgrenzen, Vermeidung von Vorbereitungs-Schleifen.
- `overheadBlock.fixtures.ts` / `overheadBlock.test.ts`: beide aufgezeichneten
  Stillstaende als minimale, anonymisierte Geometrie; geschlossene Steuerungs-
  tests mit Predictor und kleinen Positionsabweichungen. Kein Phaser-Nachweis.
- `index.ts` / `negativeCache.test.ts`: negative beziehungsweise vollstaendig
  weggefilterte Ergebnisse nach drei Sekunden bei geaenderten Hazards erneuern.
  Laufende Suche behaelt ihre Deadline; kein Reset bei jeder Hazardbewegung.

## Teststand und offene Arbeit

- Vor dem letzten Bugfix: 1.199 Tests und Gesamtbuild erfolgreich; danach
  Level-1-Rueckbau mit 69 gezielten Tests und Gesamtbuild erfolgreich.
- Letzter Planner-Agent meldet 128 Core-/Artefakt-Tests und Typecheck gruen.
- Cache-Agent meldet acht neue Cachetests und 240 Core-/Contract-/Shared-Tests
  gruen; sein Zwischenlauf sah noch zwei gleichzeitig bearbeitete
  OverheadBlock-Tests fehlschlagen. Ein gemeinsamer abschliessender Lauf nach
  beiden Aenderungen wurde wegen Nutzerstopp NICHT mehr ausgefuehrt.
- Naechster sinnvoller Schritt: `npm test`, `npm run build`, dann denselben
  Besucherbot in vorhandenem `/code` pruefen und frischen Trace auswerten.
- Keine nachgewiesene Zielquote, keine echte Phaser-Verifikation der letzten
  Routen und keine Garantie fuer das komplette 5-ms-Workerbudget.
- Bekannte globale Lintfehler in zuvor unveraenderten UI-Dateien:
  `AudioControls.tsx`, `BotUploadForm.tsx`, `ScoreHud.tsx`.

## Lokale Daten nicht im Commit

`client/src/bot/current-bot.js` und `runs/` sind gitignoriert und wurden weder
zurueckgesetzt noch mitgepusht. Die aktuelle Besucherdatei enthielt weiterhin
das alte, unbenutzte Toolkit und am Ende diesen aktiven Vertrag:
`apiVersion: 1`, `frameworkVersion: 1`, `decide(state, tools)` delegiert an
`tools.navigate({ choose })`. Die Auswahl bevorzugt Ziel-Fortschritt geteilt
durch geschaetzte Dauer. Denselben Algorithmus zeigt `examples/strategies/sprinter.js`.

Lokal relevante Traces: `2026-09-16T06-16-19-868Z.json` Tick 50 und
`2026-09-16T06-14-29-317Z.json` Tick 253. Botrevision `bot-11e102a9`.
Die neuen Geometrie-Fixtures erlauben Reproduktion ohne diese privaten Runs.
Trace-Rundung und aus aktuellem Code ergaenztes Tuning sind in den Fixtures
dokumentiert. Ein Predictor-Test allein ist kein erfolgreicher Spieltest.
