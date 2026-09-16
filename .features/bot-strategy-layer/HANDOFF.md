# Uebergabe: Zwischenstand, nicht als messereif abgenommen

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
