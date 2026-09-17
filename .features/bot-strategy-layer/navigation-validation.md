# Prüfung der Zielnavigation, 17.09.2026

Implementiert: `tools.navigate` für Zielrichtung, sichtbare Früchte und Plattformen.
Besucher wählen Ziele, Vorsicht und Boingo-Erlaubnis; die gemeinsame Navigation
verwaltet die Bewegungsaufträge. `run`, `options` und rohe Actions bleiben verfügbar.
Die leere Vorlage enthält einen optionalen `selectGoal`-Einstieg und bleibt leer.

## Reale Läufe

Bestehende Phaser-Vorschau, Levelanfang, 90 Sekunden, unbegrenzte Leben.
Level 1 zunächst auf `/code`, alle weiteren unten auf `/dev`.
Keine Änderung an Leveln, Physik, Gefahren, Sichtfeld oder Scoring.
Dies sind einzelne Prüfläufe, keine belastbare Erfolgsquote.

| Bot | Level | Ziel | Zeit laut UI | Tode | Fruchtpunkte | Session (UTC) |
| --- | --- | --- | --- | --- | --- | --- |
| Sprinter | 1 | ja | 35,5 s | 0 | 104 | 10:58:13.322 |
| Sprinter | 2 – Kaizo | ja | 32,8 s | 1 | 50 | 11:01:49.100 |
| Sprinter | 3 – Night | ja | 12,9 s | 0 | 102 | 10:59:48.581 |
| Sprinter | 4 – Underground | ja | 13,9 s | 2 | 85 | 11:00:13.231 |
| Sprinter | 5 – Desert | ja | 14,0 s | 0 | 86 | 11:00:42.118 |
| Sprinter | 6 – Frost | ja | 11,5 s | 0 | 84 | 11:01:11.869 |
| Sammler | 3 – Night | ja | 10,8 s | 0 | 135 | 11:03:35.218 |
| Vorsichtig | 1 | nein | 90,0 s | 1 | 119 | 11:04:23.452 |
| Vorsichtig | 3 – Night | ja | 13,2 s | 0 | 92 | 11:06:51.231 |

Botrevisionen: Sprinter `bot-3256f543`, Sammler `bot-f3da96a3`.
Vorsichtige Variante: `bot-1055bbd8`; diese liegt zuletzt als aktueller Testbot
in `client/src/bot/current-bot.js`. Die zuvor vorhandene Besucherdatei wurde vor
den Tests nach `/tmp/coin-quest-before-navigation.js` gesichert.
Die Laufdateien liegen lokal in `client/src/bot/runs/` und werden nicht eingecheckt.
Sammler-Nachweis: Tick 66 bewegt nach links, Tick 67 sammelt `coin-2` bei x≈475.
Damit ist neben der anderen Zielwahl im Unit-Test auch ein Rückweg mit Sammlung
im echten Spiel dokumentiert. Höhere Punktzahl allein wäre dafür unzureichend.

Die Sprinter-Läufe entstanden vor den abschließenden, durch Regressionstests
abgesicherten Korrekturen für Plattformkontakt und nachträgliches Boingo-Verbot.
Beide betreffen Intent-Fälle, die der Sprinter nicht verwendet. Der Sammler-Lauf
enthält diese Korrekturen. Der aktuelle Navigationsstand (SHA-256 über Dateinamen
und Inhalte von navigator.ts, options.ts, index.ts und botWorkerRuntime.ts) ist
`9e191edc2579f4ced719c5f57e2c44a8c7c933998be766dbcd195d05dc559860`.

## Automatische Prüfungen

- Gesamtsuite: 142 Dateien, 1.251 Tests bestanden.
- Workspace-Build bestanden; bestehender Vite-Hinweis auf große Bundles.
- Lint der geänderten TypeScript-Dateien und `git diff --check` ohne Befund.
- Regressionen für die beobachteten Engstellen, Fruchtziele gegen Zielrichtung,
  Zielwechsel im Flug, Worker-Kontrollübergabe, begrenzte Wiederholungen,
  Plattformkontakt und nachträgliches Boingo-Verbot.
- Verschobene Geometrie und umbenannte Objekt-IDs erzeugen dieselben Actions
  für drei aufgezeichnete Engstellen.

## Offene Nachweise und Grenzen

Die vollständige Abnahme aus `reliable-movement-requirements.md` ist **nicht**
erreicht: keine 9/10-Serie je Strategie, keine 5/5-Serie je Engstelle und noch
kein erneuter blinder Besuchertest. Frühere Entwicklungsstände hatten DNF-Läufe.
Der aktuelle vorsichtige Bot auf Level 1 scheiterte am Zeitlimit mit einem Tod;
zuletzt wartete er bei x≈3800. Sichere, verlässliche Ankunft für alle Spielstile ist nicht
belegt. Die lokale Navigation ist keine garantierte Route und kann blockieren.

## Erweiterung: eigene Bewegungsauswahl

`NavigationIntent.choose` erlaubt dem Besucher-Agenten freie Auswahlregeln über
unveränderliche, beschreibende Angebote. Die ID-Auswahl bindet weiterhin den
beobachtungsbasierten Motor; keine Anlauf- oder Flugverwaltung in der Bot-Datei.
Bewusstes Warten wird als `strategy-wait` gemeldet. Erfolglos ausgeführte Manöver
bleiben auch mit eigener Auswahl zeitlich begrenzt. Unbekannte IDs werden abgelehnt.

Nachweis vom selben Startpunkt auf `/dev`, Night, unveränderte Spielbedingungen:

| Strategie | Botrevision | Zeit | Tode | Fruchtpunkte | Session UTC |
| --- | --- | --- | --- | --- | --- |
| Dachläufer | bot-5ceda099 | 10,8 s | 0 | 77 | 11:13:52.452 |
| Bodenläufer | bot-64d40b2b | 14,9 s | 0 | 80 | 11:15:40.941 |
| Hüpfer (Messe-Agent) | bot-c946fee6 | 15,0 s | 0 | 97 | 11:17:21.050 |

Konkreter Unterschied: Dachläufer startet ein Sprungmanöver und befindet sich
später bei x≈298/y≈311; Bodenläufer läuft zunächst bis x≈283/y≈481 und springt
anschließend zu `block-1`. Damit ist der Einfluss auf Route und Bewegungsart
belegt, nicht allein ein Unterschied bei Endpunktzahlen.

Der Messe-Agent erhielt ausschließlich den Auftrag, anhand Besucheranleitung,
API-Dokumentation und Beispielen „kurze Sprünge, Gegner überspringen“ umzusetzen.
Seine Antwort wurde unverändert als `examples/navigation/hopper.js` übernommen
und im Browser ausgeführt. Keine Framework-Reparatur für diesen Wunsch.
Automatische Tests prüfen außerdem Sprung statt Warten vor demselben Gegner,
kürzere statt längere Sprünge, Flugfortsetzung, unveränderliche Angebote,
ungültige IDs und die begrenzte Wiederholung erfolgloser Manöver.

Aktuelle Gesamtsuite: 143 Dateien / 1.263 Tests bestanden. Build und Lint der
betroffenen TypeScript-Dateien grün. Das ist ein Nachweis der Kontrollmöglichkeit,
keine allgemeine Erfolgsquote und keine vollständige Abnahme aller Hängesituationen.

Zusätzlicher Desert-Versuch mit Hüpfer: 13 Fruchtpunkte, anschließend fehlende
Bewegungsangebote und Stillstand. Kein erfolgreicher Lauf. Dieser Versuch deckte
auf, dass `choose([]) => null` fälschlich als bewusstes Warten behandelt wurde.
Regressionstest und Fix: Nur Verzicht auf vorhandene Angebote ist `strategy-wait`;
bei leerer Auswahl gelten wieder `no-route` bzw. das begrenzte Blockadebudget.
Das repariert die Diagnose, nicht die fehlende Route. Der Bot liegt weiter als
aktueller Testbot bereit; keine Änderung an Leveln oder Spielmechanik.

## Desert-Korrektur nach dem Blockadebericht

Ursachen wurden aus dem unveränderten Hüpfer-Trace reproduziert:

- Der zusätzliche Sicherheitsabstand zu den Stacheln sperrte auch einen physisch
  freien Rückzug. Jetzt darf ein Rückzug den bestehenden Abstand erhalten oder
  vergrößern, solange sein gesamter Weg kollisionsfrei bleibt.
- Eine Spikehead-Warnung wurde nur an dessen Ausgangsposition geprüft. Jetzt
  wird die angekündigte Fallspalte berücksichtigt; wer bereits darunter steht,
  darf horizontal fliehen, ohne reale Collider ignorieren zu dürfen.
- Ein kurzer Sprung konnte direkt unter dem Spikehead enden. Solche Landepunkte
  werden anhand der sichtbaren Geometrie ausgeschlossen, auch vor der Warnung.

Alle Regeln sind geometrisch; keine Desert-Koordinaten oder Level-IDs im
Produktivcode. Botdatei unverändert (`bot-c946fee6`), Level und Physik unverändert.
Sieben Regressionstests in `escape.test.ts`, Gesamtsuite vor dem zusätzlichen
siebten Test 1.269/1.269 grün, zusätzlicher Test ebenfalls grün; Build erfolgreich.
Read-only Review prüfte die Flucht-Ausnahme und Landepunktprüfung.

Aktueller Stand auf `/dev`, Desert, Levelanfang, 90s, unbegrenzte Leben:

- Session 11:29:30.131Z: Ziel in 15,9s, 0 Tode, 88 Fruchtpunkte.
- Session 11:30:02.755Z: Ziel in 16,3s, 0 Tode, 48 Fruchtpunkte.

Ein früherer Zwischenstand schaffte einen Lauf, blieb im Wiederholungslauf aber
an der Spikehead-Plattform stehen. Er wurde deshalb nicht als behoben gewertet;
die obigen Läufe enthalten zusätzlich die korrigierte Landepunktprüfung.
- Dritter Kontrolllauf, Session 11:30:48.387Z: Ziel in 16,1s, 0 Tode,
  60 Fruchtpunkte. Damit drei aufeinanderfolgende erfolgreiche Desert-Läufe mit
  dem finalen Stand; keine allgemeine Garantie für andere Strategien oder Level.
