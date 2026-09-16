# Bugfix: Stillstand nach der ersten Luecke in Level 1

## Fortsetzung am 2026-09-16: Erfahrungen aus dem Stash

Der Nutzer hat die Übertragung in die neue Logik und den Umbau von
`current-bot.js` ausdrücklich zur Umsetzung und zum Ausprobieren beauftragt.
Dies konkretisiert US-2 im bestehenden Scope, ohne Änderung von Level oder API.

- WHEN ein Plan während des Fallens ungültig wird SHALL DIE NAVIGATION sofort
  eine begrenzte Landungsprüfung ausführen, statt durch die Boden-Recovery-Pause
  notwendige horizontale Bewegung zu unterbrechen.
- WHEN eine Flugkorrektur gewählt wird SHALL DIE NAVIGATION deren tragende
  Landefläche und Gefahren erneut prüfen; unbekannter Boden ist kein Nachweis.
- WHEN bewusst gewartet wird oder ein gültiger Sprung läuft SHALL DIE NAVIGATION
  keinen konkurrierenden Rückzug und keine neue Besucherentscheidung erzwingen.

Ansatz: vorhandenen Collider-Predictor verwenden, maximal 256 zusätzliche
Integrationsschritte für wenige Flugkurse. Vorherigen Kurs bevorzugen, sichere
Alternative bei neu beobachteter Gefahr prüfen. Boden-Recovery bleibt begrenzt.
Regressionsfälle für sicheren Rückzug, Warten und Planbesitz erhalten.

- [x] Flugabbruch zuerst als roten Regressionstest nachweisen, dann korrigieren.
- [x] Sichere Alternative, fehlenden Boden und neue Gefahr testen.
- [x] Beispielstrategie testen, lokale Botdatei nach Sicherung ersetzen.
- [x] Master-Mike-Tippfehler mit Regression korrigieren.
- [x] Gesamttests, Build und vorhandene `/code`-Vorschau prüfen; Grenzen berichten.

Live-Befund: Beim Trampolin vor einer 300 px höheren Plattform bleibt der Bot
stehen. Der Planner berücksichtigt nur direkte Ziele bis 190 px höher und
keinen gezielten Kontakt von oben mit anschließender Flugrichtung. Übertragung
der bereits im Stash enthaltenen Boingo-Erkenntnis: zuerst den Kontaktpunkt
ansteuern, nach beobachtetem/geplantem Bounce das Landeziel. Dieselbe einzelne
Bot-Datei und der gemeinsame Predictor bleiben die Grundlage.

- [x] Trampolin-Zwischenziel mit hoher Folgelandung zuerst rot testen, dann im
  bestehenden Planner/Predictor umsetzen; normaler Sprung bleibt unverändert.

### Umsetzung und Nachweise der Fortsetzung

- `airRecovery.ts`: abgebrochener Fall verwendet geprüfte Flugkurse, jeder Tick
  prüft neu. Auch nach früher Landung wird der gesamte noch gehaltene Bot-Tick
  auf Collider/Gefahren geprüft, einschließlich 120-Hz-Physik. Unbekannter Boden
  wird anders als im alten Toolkit nicht als sicher interpretiert.
- `Maneuver.via`: Kontakt von oben mit einem nahen Trampolin, danach Steuerung
  zum hohen Landeziel. Der aktive Plan merkt sich den erreichten Kontakt auch
  nach einem weiteren beobachteten Impuls. Kein neuer Besucher-API-Vertrag.
- Bestehende Tests für sicheren Rückzug, Warte-/Suchfristen, negative Caches,
  Planbesitz und Sprünge unter Überkopfblöcken bleiben grün.
- `examples/strategies/messe-demo.js`: kleiner Sammler mit höchstens 180 px
  Sammelumweg, Risikogrenze und Endspurt ab 25 Sekunden Restzeit/letztem Leben.
  Die lokale `current-bot.js` verwendet diese Strategie. Vorherige Datei gesichert
  unter `/private/tmp/coin-quest-current-bot-before-messe-mix-20260916.js`.
- Vorschau-Startfehler reproduziert und behoben: Trace-Validatoren werden samt
  Contract-Konstanten für die Vite-Konfiguration gebündelt. Client-TypeScript
  prüft mit `noEmit`; Vite erzeugt das Bundle. Dadurch keine Compiler-Ausgaben
  in fremden Workspace-Quellverzeichnissen.
- Abschlussprüfung: **1.224 Tests in 142 Dateien grün**, kompletter Workspace-
  Build grün (bekannte Vite-Chunkgrößenwarnung). Unabhängiges Review: zwei
  weitere Randfälle erst rot reproduziert, korrigiert und erneut geprüft.

Live-Vorläufe mit `Messe-Mix` (`bot-210b13ab`) in `/code`, Level 1, 90 Sekunden,
unbegrenzte Testleben: 201 Fruchtpunkte/6 Tode/DNF, danach 133/3/DNF. Erster
Lauf endete bei einem Trampolin (x≈5904), zweiter auf einer erhöhten Plattform
(x≈1589). Beide ohne technische Fehler. Diese Vorläufe sind keine Aussage zur
Verbesserungsquote gegenüber dem Stash und enthalten Zwischenstände der Motorik.
Die Traces enthalten die Botrevision, aber noch keine Frameworkrevision.

Abschlusslauf nach allen Review-Fixes: **110 Fruchtpunkte, 1 Tod, DNF nach
90 Sekunden, 45 Gesamtpunkte**, Stillstand auf der erhöhten Plattform.
Keine Zielerreichung behauptet; der nächste konkrete Arbeitsfall ist die
Fortsetzungsplanung von dieser Plattform. Vorschau: `http://127.0.0.1:5174/code`.
Die technischen Prüfungen sind bestanden, die spielerische Zuverlässigkeit ist
weiterhin offen. Kein Commit/Push, Stash unverändert erhalten.

## Status

Vom Nutzer mit "mach" zur Umsetzung beauftragt. Implementierung laeuft.
Bezug: bestehende Framework-Navigation, Requirements US-2 und aktueller
Scope ohne Levelaenderungen oder zusaetzliche Testplattform.

## Aktuelles Verhalten (Bug)

Der Besucherbot Fluppo (`bot-11e102a9`) nutzt korrekt
`decide(state, tools)` und `tools.navigate({ choose })`.
Der Lauf `2026-09-16T06-16-19-868Z.json` zeigt nach 1,65 Sekunden
Stillstand bei x=471,07 auf Level 1 bis zum Zeitlimit, ohne technische Fehler.
Ab Tick 50 meldet die Navigation `no-known-continuation` beziehungsweise
`blocked-unchanged`. Die Besucherstrategie wird mangels Optionen nicht aufgerufen.

## Erwartetes Verhalten

- WHEN ein naher Block den Aufstieg behindert SHALL DIE NAVIGATION auch
  vorbereitende Bewegungen auf der aktuellen Stuetzflaeche und geeignete
  Zwischenlandungen pruefen, statt nur direkte Spruenge anzubieten.
- WHEN sich Gefahren nach einer abgeschlossenen ergebnislosen Suche aendern
  SHALL DIE NAVIGATION neue Optionen pruefen, ohne durch staendige Bewegungen
  in einen unbegrenzten Suchneustart zu geraten.
- WHEN keine sichere Fortsetzung nachgewiesen ist SHALL DIE NAVIGATION
  keinen blinden Sprung oder Rueckzug ueber eine Plattformkante erzwingen.

## Was bleibt unveraendert (Regressions-Schutz)

Keine Aenderung an Fluppos Datei, Level 1, Scoring, Sichtweite oder Physik.
Keine neue Testseite, CLI oder Logging-Plattform. Ein-Datei-Abgabe bleibt.
Bestehende Landungs-/Kollisionspruefung, Suchbudgets, laufender Planbesitz
und Schutz vor endlosen Suchneustarts bleiben erhalten.

## Root Cause (nach Analyse)

1. Der Planner erkennt nur Hindernisse auf aktueller Koerperhoehe als Anlass
   fuer einen Anlauf. `block-1` haengt ueber dem stehenden Bot und wird deshalb
   nicht beruecksichtigt, obwohl alle generierten Spruenge seitlich dagegen
   stossen. Die sichere Standflaeche und passende Zwischenziele werden nicht
   ausreichend abgetastet. Reproduktion aus Trace-Tick 50: abgeschlossene
   Suche mit null Optionen nach 255 Integrationsschritten, kein Budgetabbruch.
2. Ein abgeschlossener leerer Suchcache ueberlebt die Blockierpause und
   Gefahrenaenderungen. Die vorhandene Aktualitaetspruefung filtert nur
   existierende Routen; sie kann keine neu moeglichen Routen erzeugen.

## Fix-Ansatz

Zuerst kleine Regressionstests mit der aufgezeichneten Geometrie fuer
Ueberkopfblock, Stacheln und folgende Luecke sowie fuer geaenderte Hazards.
Vorbereitende Ziele aus tragfaehigen Standintervallen und Hindernisgeometrie
ableiten, einschliesslich Zwischenlandungen hinter dem Hindernis. Kein
fest eingebauter Level-1-x-Wert und keine Lockerung der Sicherheitspruefung.
Negative Suchergebnisse bei relevanter neuer Information begrenzt erneuern.

Der unveraenderte Predictor findet fuer den Trace-Zustand bereits eine
dreiteilige Route: zurueckgehen, ueber Block/Stacheln springen, Luecke queren.
Das ist nur ein Beleg fehlender Suchkandidaten, kein Live-Erfolgsnachweis:
Die erste gefundene Route hat einen zu knappen Puffer fuer ein Erfolgsversprechen.
Regressionen muessen auch tickweise Planausfuehrung und Abweichungen pruefen.
Abschliessend denselben Besucherbot im bestehenden `/code` ausprobieren und
den neuen Trace auswerten. Keine Zielquote ohne beobachteten Lauf behaupten.

## Reproduktionsgrenzen

Bot-Revision stimmt mit der aktuellen Datei ueberein. Der Trace enthaelt
gerundete Werte und weder vollstaendiges Tuning noch eine Frameworkrevision.
Fuer die Reproduktion wurden fehlende Physikkonstanten und Weltgrenzen aus
dem aktuellen Code ergaenzt. Der Originalzustand ist deshalb nicht verlustlos
rekonstruierbar, das leere Suchergebnis und der Cachefehler sind reproduziert.
