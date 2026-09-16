# Tasks: Verlaessliche Messe-Bots

## Aktuelle Nutzerkorrektur: vollständiger Einzelbot-Lauf

Der Nutzer verlangt ausdrücklich die Arbeit in `/dev` an einem sinnvoll
spielenden Bot über das ganze unveränderte Spiel. Turniertests sind dafür
kein Abnahmekriterium. Isolierte Boingo-Erfolge belegen nur diesen Mechanismus.
Die offen lesbare Beispielstrategie darf konkret für Level 1 aufgebaut und
anhand vollständiger Läufe korrigiert werden; Strategie bleibt Besuchercode,
Bewegungsausführung bleibt im kleinen Framework.


## Status

### Beauftragte autonome Umsetzung v2

- [x] V2-1. Contract und Controller testgetrieben: walk/jump/boingo, Status,
  Besitzwechsel, Invalidierung und beobachtete Landung.
- [x] V2-2. Worker mit run/status, 100-ms-Watchdog, Fehlerstopp und Impulsbeobachtung.
- [x] V2-3. Bestehende Artefakte prüfen, Vorlage/current-bot und Doku umstellen;
  v1 klar ablehnen, ungenutzten Planner entfernen.
- [x] V2-4. Echte Spielprüfung, unabhängiges Review, Gesamttests/Build;
  tatsächliche Reichweite und verbleibende Grenzen dokumentieren.



### Aktuelle Fortsetzung: Besucher-Manöver (zur Umsetzung beauftragt)

- [x] A. Rote Tests für `move`, `continue`, `status`, `cancel` im Navigationskern;
  additive Contract-Typen und geprüfte Einzelmanöver implementieren. Eigene
  Ziele dürfen Rückwege enthalten; kein automatischer Ersatz für Ablehnungen.
- [x] B. Rote Worker-Tests für tickgebundene Tools, Motorbesitz und eigene Actions;
  Runtime anbinden und Kompatibilität alter Bots prüfen.
- [x] C. Roter Artefakt-Test für durch Bot-Code gewählte Boingo-/Plattformziele;
  Beispiel und `current-bot.js` umbauen, Steering/API-Doku auf Handlungsfreiheit
  und explizite Planübergabe korrigieren.
- [x] D. Gezielte und volle Tests, Build, unabhängiges Review, bestehende
  Browser-Vorschau prüfen und tatsächliche Ergebnisse/Restprobleme dokumentieren.

- [x] 30. Urspruengliches Level 1 fuer `/code` wiederherstellen
  Explizit vom Nutzer beauftragt: neues Messelevel und Registry-Eintraege
  entfernen, Originallevel unberuehrt lassen, Moduswechsel/Neustart pruefen.
  Task 22 und alle historischen Vorgaben fuer ein neues Messelevel entfallen.
  Verifiziert: 69 gezielte Tests und gesamter Workspace-Build erfolgreich.

Aktuell: Nutzer hat mit "ja!" den Rueckbau auf den einfachen Messeablauf
freigegeben. Aufgaben fuer die zusaetzliche Testplattform und automatisierte
Abnahmeserien sind aufgehoben; historische Erledigungen unten dokumentieren
nicht den kuenftigen Sollumfang.

- [x] 29. Zusaetzliche Testplattform entfernen und Messeablauf vereinfachen
  Testseite/CLI/Jobs sowie Scene-Test-Hooks entfernen, bestehende Regressionen
  bewahren, Diagnose redundanzfrei halten und Doku auf `/code` plus Traces
  reduzieren. Verifikation: gezielte Regression, Gesamttests und Build.
  Ergebnis: 19 reine Testplattform-Dateien entfernt, keine Test-CLI/-Route/-Jobs
  oder Scene-Testzugriffe mehr. Diagnose behält Ziel-/Plangruende, aber keine
  unbenutzten Laufzeitmetriken oder doppelte Trace-Begrenzung. Action-Ereignisse
  erzeugen nicht mehr fuer jeden Tick neue Diagnosefenster.
  Nachweis: `npm test` mit 1.199 Tests in 139 Dateien erfolgreich;
  `npm run build` erfolgreich; `git diff --check` sauber. Reale Spielqualitaet
  ist damit weiterhin nicht nachgewiesen. Vorhandene Besucherdatei und
  gespeicherte Laufdaten wurden nicht geloescht oder zurueckgesetzt.

Aufgehoben sind Tasks 6-10 und 20 fuer die entfernte Testplattform sowie
Task 26 als automatisierte Abnahmeserie. Task 25 bezieht sich kuenftig auf
die normale Regression und den Build, nicht auf eine neue Fixedstep-Teststation.
Ausprobieren und Besucherfeedback erfolgen ausschliesslich im vorhandenen
`/code`-Ablauf. Die frueheren Eintraege bleiben als Aenderungshistorie stehen.

Requirements und ueberarbeitetes Ein-Datei-Design sind freigegeben.
Diese Task-Liste wurde vom Nutzer mit "ok" zur Umsetzung freigegeben.
Implementierung und automatisierte Integration sind weitgehend umgesetzt.
Reale Browser-/Physiknachweise und Standabnahme stehen noch aus; entsprechende
Tasks bleiben bewusst offen. Einzelheiten siehe Abschlussnachweise.

## Arbeitsregeln

Jeder Implementierungstask folgt Rot, Gruen, Refactor: zuerst den genannten
Test schreiben und sein erwartetes Scheitern beobachten, dann minimal
implementieren und bei gruenen Tests aufraeumen. Zugehoerige Regressionen
muessen ebenfalls bestehen, bevor ein Task abgehakt wird. Status wird waehrend
der Umsetzung aktualisiert; keine pauschale Abschlussmarkierung am Ende.

Fixtures pruefen echte `RaceScene`-/Phaser-Ausfuehrung. Mocks sind fuer
Unit-/Transporttests erlaubt, aber kein Ersatz fuer Physiknachweise.
Browser-Voraussetzungen werden frueh geprueft. Ohne vom Betreiber geoeffnete
Testseite bleiben reale Tests offen; kein eigenstaendiger GUI-Start.

Bestehende `current-bot.js` und alte abgegebene Bots werden nicht automatisch
ersetzt. Die Ein-Datei-Abgabe hat keinen Buildschritt und keine Begleitbibliothek.

## A. Wahrnehmung und Laufzeit

- [x] 1. Reale Hazard-Positionen und messbare Geschwindigkeit korrigieren
  (US-1; Design 2). Rot: bewegte Patrol-/Pendel-/Spikehead-Snapshots gegen
  Instanzpositionen testen; erste Beobachtung, Respawn, Controllerwechsel und
  Kollisionscallback duerfen keine falsche Geschwindigkeit erzeugen. Gruen:
  Snapshot auf aktive Instanzen umstellen und Historie nur pro Beobachtungstick
  fortschreiben. Refactor: gemeinsame Umrechnung ohne zweiten Snapshot-Pfad.
  Dateien: `RaceScene.ts`, `game/state/`, Hazard-Anbindung und zugehoerige Tests.

- [x] 2. Block-Collider, Blockfruechte und dynamisches Raster synchronisieren
  (US-1; Design 2). Rot: ausgeloester Block bleibt solide, erzeugte Frucht ist
  sichtbar und verschwindet nach Einsammeln; bewegte/zerstoerte Hazards im Raster
  pruefen. Gruen: aktive Weltobjekte konsistent in Listen und Raster abbilden.
  Refactor: doppelte Aktivitaets-/Fruchtfilter entfernen, Sichtgrenzen bewahren.
  Dateien: `RaceScene.ts`, `visiblePlatforms.ts`, `worldSnapshot.ts`, `tiles.ts`.

- [x] 3. Effektive Geometrie und versionierte Navigation-Observation bereitstellen
  (US-1, US-2; Design 2). Rot: skalierter Body, stabile IDs, relative Bounds,
  One-Way-Kollision, Epochen und Impulszustand testen; alte State-Felder erhalten.
  Gruen: Contract additiv erweitern und reale Werte durch den State-Builder reichen.
  Refactor: Konstanten nicht duplizieren; keine unsichtbaren Objekte offenlegen.
  Dateien: `packages/bot-contract/`, `game/state/`, World-/Scene-Anbindung.

- [x] 4. Worker-Bereitschaft und sauberes Beenden absichern
  (US-3, US-4, US-5; Design 6). Rot: keine Ticks vor `module-ready`, Initfehler,
  Deadline, Dispose und ueberlappende Anfragen testen. Gruen: Ready-Barriere,
  maximal eine Anfrage und definierte Promise-Aufloesung implementieren.
  Refactor: Cleanup idempotent halten; produktives 5-ms-Limit bewahren.
  Dateien: `BotRunner.ts`, `botWorker.ts`, Worker-Protokoll und Tests.

- [x] 5. Beobachtung, Entscheidung und Action-Anwendung zeitlich korrelieren
  (US-1, US-4; Design 2, 6). Rot: konsistente Physikphase, Szene-/Worker-Ticks,
  Moduswechsel und spaete Antworten pruefen; Restzeit ohne Tick-Bursts testen.
  Gruen: Epoche und State-Tick durchreichen, Anwendung separat erfassen und
  veraltete Antworten verwerfen. Refactor: gleiche Reihenfolge in Arena/Match/Test.
  Dateien: `RaceScene.ts`, Controller, Worker-Protokoll und Trace-Anbindung.

## B. Reale Testbasis

Abhaengigkeit: A fuer konsistente Beobachtung und Ready-Barriere. Kleine
Unit-Tests fuer Testprotokoll und Transport koennen bereits parallel entstehen.

- [x] 6. Ergebnisvertrag und begrenzten Testauftrag einfuehren
  (US-4; Design 7). Rot: ungueltige Szenarien, Modi, Sourcegroessen, Bedingungen
  und terminale Ergebnisse pruefen. Gruen: Protokoll und Validierung fuer
  unveraenderte Bot-Bytes, SHA-256 und getrennte Spiel-/Infrastrukturresultate.
  Refactor: keine frei waehlbaren Server-Dateipfade; bestehende Scorelogik nutzen.
  Dateien: `client/src/testing/`, zugehoerige Tests.

- [x] 7. Lokalen Vite-Auftragstransport und serverseitige Persistenz bauen
  (US-4, US-5; Design 7, 11). Rot: deaktivierter Endpoint, Loopback/Origin/
  lokale Herkunft, Busy, Lease, Abbruch, Groessenlimits und Schreibfehler testen.
  Gruen: ein aktiver Auftrag, begrenzte Aufbewahrung und atomare Ergebnisse
  unter `runs/evaluations/`. Refactor: keine Tokenlogs oder offenen LAN-Endpunkte.
  Dateien: `client/vite/botTestPlugin.ts`, Vite-Konfiguration und Tests.

- [ ] 8. Browser-Testtreiber gegen die vorhandene Phaser-Szene anbinden
  (US-3, US-4; Design 7, 10). Rot: Boot-Barrieren, Framefolge, ausstehende
  Entscheidungen, Grenzen und Cleanup des Treibers testen. Eine echte minimale
  Lauf-Fixture mit Assertion vor der Anbindung anlegen. Gruen: separate Testseite,
  vollstaendige `game.step`-Fixedsteps und unveraenderter Echtzeitpfad.
  Refactor: eine Physikkonfiguration fuer Arena, Match und Test, kein Doppel-Step.
  Dateien: `client/src/testing/`, `ArenaView.tsx`, `RaceScene.ts`, Match-Host.
  Abschluss erst nach ausgefuehrtem Browser-Smoke-Test, nicht nur Lifecycle-Mocks.

- [x] 9. CLI fuer Diagnose, Teststart und Ergebnisabfrage liefern
  (US-4, US-5; Design 7, 11). Rot: fehlender Browser, Serverfehler, Busy,
  Deadline, Abbruch und unveraenderte Sourceuebernahme pruefen. Gruen:
  `npm run bot:test -- doctor` und `run` mit begrenztem Polling bereitstellen.
  Refactor: maschinenlesbare Resultate, keine Schreibrechte auf Ergebnisse noetig.
  Dateien: `scripts/bot-test.mjs`, `package.json`, CLI-Tests.

- [ ] 10. Wahrnehmungsregressionen gegen echte Phaser-Bodies nachweisen
  (US-1, US-3; Design 2, 9, 10). Reale Assertions fuer A ergaenzen; bereits
  durch A behobene Faelle sind Integrationsnachweise, kein nachtraeglicher
  Rot-Nachweis. Rot: verbleibende Abweichungen vor weiteren Korrekturen gezielt
  reproduzieren. Gruen:
  ausschliesslich gemeinsame Produktivpfade korrigieren. Refactor: kleine
  Fixtures fuer bewegte Hazards, Blockfrucht, Collider, Respawn und Skalierung.
  Abschluss: maximal 0,01 px Observation-/Body-Abweichung; keine testexklusiven
  Ersatzdaten, die einen Fehler der produktiven Snapshot-Verdrahtung verbergen.

## C. Framework-Navigation

Abhaengigkeit: B liefert den echten Physiknachweis. Framework-Code wird nicht
in die Besucherdatei kopiert; bestehende Toolkit-Regressionsfaelle werden bewahrt.

- [ ] 11. Navigation-Paket und gemeinsame Bewegungsbasis testgetrieben einrichten
  (US-2, US-3; Design 1, 4). Zuerst Vitest-/Typecheck-Setup fuer
  `packages/bot-navigation/`. Rot: Sprint-Reset und normale/extern ausgeloeste
  Sprungphasen mit Unit- und echten Mechanik-Fixtures pruefen. Gruen: vorhandene
  reine Bewegung wiederverwenden und Arena-Sprint-/Bounce-Abweichungen korrigieren.
  Refactor: kein Phaser/DOM im Paket; gleicher Bewegungspfad fuer Tastatur und Bot.

- [ ] 12. Bewegungsprognose mit soliden und One-Way-Kollisionen implementieren
  (US-2, US-3; Design 4, 10). Rot: Lauf, Jump-Hold, Cut, Wand, Decke,
  One-Way-Landung und unbekannten Boden pruefen. Gruen: begrenzte Integration
  im echten Physikraster und nachgewiesene Landung mit Flaechen-ID/Body-Puffer.
  Refactor: vorhandene brauchbare Helfer uebernehmen, optimistische
  Weltgrenzen-/Zielnaehe-Freigaben ausschliessen. Phaser-Toleranzen nachweisen.

- [ ] 13. Boingo- und Stomp-Manoever samt Folgelandung modellieren
  (US-2, US-3; Design 4, 9). Rot: Kontakt, externer Impuls und Folgeflug gegen
  reale Fixtures testen; nicht stompbare Hazards bleiben gefaehrlich. Gruen:
  zusammenhaengende Manoever mit bestaetigtem Impuls und tragfaehiger Landung.
  Refactor: keine vy-Schwellwert-Heuristik als alleiniger Bounce-Nachweis.

- [x] 14. Lokale Zielrouten und echte Sammelerreichbarkeit erzeugen
  (US-2; Design 3, 4). Rot: gleiche Hoehe, erhoehte Frucht, Frucht links,
  Wandumweg, Zwischenlandung und Frucht ohne sichere Fortsetzung testen.
  Gruen: begrenzter Stuetzflaechen-Graph mit stabilen Ziel-/Routen-IDs,
  `target-reachable` beziehungsweise `local-progress`. Refactor: keine
  Ersetzung von `goalDirection`, keine Fruchtoption nur wegen Punktnaehe.

- [ ] 15. Suchbudget und dynamisches Risiko begrenzen
  (US-2, US-3; Design 3, 4). Rot: maximale Ziele/Zustaende/Tiefe/Schritte,
  Cacheinvalidierung und weitere Hazards im Flugkorridor pruefen. Gruen:
  begrenzte mehrtickige Planung und dokumentierte Risikokosten implementieren.
  Refactor: Suchbudgetende von Unerreichbarkeit trennen; bekannte Kollisionen
  nicht als blossen Risikoaufschlag behandeln. Echten Worker-Roundtrip messen.

- [x] 16. Planbesitz, Zielbindung und begrenzte Recovery implementieren
  (US-2; Design 4). Rot: neue Fruchtprioritaet im Flug, verlorene Sicht,
  Respawn, neue Gefahr, Pendeln und sichere Rueckwaertsbewegung pruefen.
  Gruen: Navigatorphasen, sichere Entscheidungsgrenzen, Deadlines und
  Ziel-Sperren umsetzen. Refactor: keine konkurrierenden Motorikregeln;
  `blocked` diagnostizieren statt blinder Spruenge oder endloser Recovery.

- [x] 17. `frameworkVersion` und `tools.navigate` im Worker bereitstellen
  (US-2, US-5; Design 3, 5). Rot: alte Bots mit einem Argument, Tools-Bots,
  unbekannte Version, getrennte Instanzen, fehlende Observation, Mehrfachaufruf
  und Aufruf ausserhalb von `decide` pruefen. Gruen: versionierte Tools im
  Worker erzeugen und nur an deklarierende Bots uebergeben. Refactor: keine
  Engineobjekte oder Navigatorreferenzen offenlegen; Guard unveraendert anwenden.
  Dateien: `bot-contract`, `bot-navigation`, Worker und Uploadvalidierung.

## D. Diagnose und Vergleich

Abhaengigkeit: A und B; Navigationsdiagnose wird nach C angeschlossen.

- [x] 18. Framework-Entscheidungsgruende mit derselben Workerantwort transportieren
  (US-4; Design 6, 8). Rot: Ziel-/Plan-ID, Phase, relevante Objekte,
  Action-Override, ungueltige Diagnose und 2-KiB-Grenze pruefen. Gruen:
  Workerdiagnose hostseitig validieren und Tick/Epoche/Anwendung zuordnen.
  Refactor: kein zweiter `decide`-Aufruf, keine erfundene Absicht alter Bots.

- [x] 19. Trace v2 mit relevanter Geometrie und Utilities bereitstellen
  (US-4; Design 8). Rot: relevante statt erste Plattformen, Utilities,
  Fensterzusammenfuehrung, 2-MiB-Grenze, v1-Lesen und persistierte v2-Runs testen.
  Gruen: begrenzte v2-Aufzeichnung samt Trunkierungsmarkierung implementieren.
  Refactor: unbelegte starke Findings abschwaechen; Fakten und Hinweise trennen.
  Dateien: `game/trace/`, `botTracePlugin.ts`, Trace-UI und Tests.

- [x] 20. Revisionsvergleich und vollstaendige Laufmetriken abschliessen
  (US-4; Design 7). Rot: Botrevision allein veraendert versus anderes Framework,
  andere Leben, Slots, Mitspieler, Level oder Modus pruefen. Gruen:
  `npm run bot:test -- compare --before <datei> --after <datei>` und vollstaendige
  Gesamtlaufergebnisse liefern. Refactor: Framework-/Engine-/Fixture-Hashes
  einschliesslich relevanter uncommittierter Quellen; Pruefling nicht als
  unvergleichbare Bedingung behandeln. DNF und Infrastrukturabbruch unterscheiden.

## E. Besucherbots und Messelevel

Abhaengigkeit: C; reale Leistung und Diagnose werden mit B/D geprueft.

- [x] 21. Kurzes funktionierendes Ein-Datei-Template und Referenzbots liefern
  (US-2, US-3, US-5; Design 3, 5). Rot: sofortige Bewegung, verschiedene
  Ziel-/Routenentscheidungen, Endspurt, Namen und gueltige Abgabe pruefen.
  Gruen: Template sowie Sprinter, Sammler und Vorsichtiger auf Framework-Tools
  umstellen. Refactor: Toolkit-Regressionsfaelle im Framework erhalten,
  keine Physik-/Sprungzaehler im Besucher-Code und keine zweite Arbeitsdatei.
  Bestehende Arbeitsdatei bleibt bis zu ausdruecklichem Reset unveraendert.

- [ ] 22. Messelevel mit optionalen Strategieumwegen integrieren
  (US-3; Design 9). Rot: Levelgeometrie, Registry-Gleichheit, `/code`-Auswahl,
  Hauptweg und unterscheidbare Routen mit echten Szenariotests pruefen.
  Gruen: `level-messe` nach dem Design anlegen und explizit auswaehlbar machen.
  Refactor: notwendige Geometriekorrekturen dokumentieren; alte Levels und
  bestehende Turnier-Stages nicht migrieren. Revision vor Abnahmeserie einfrieren.

- [ ] 23. Unveraenderte Ein-Datei-Abgabe und Reset end-to-end absichern
  (US-5; Design 5, 10). Rot: Hashgleichheit Arbeitsdatei/Vorschau/Test/Upload,
  Sourcewechsel, Modulfehler und expliziten Reset mit Ergebnisbereinigung testen.
  Gruen: verbleibende Integrationsluecken schliessen. Refactor: kein Bundler,
  Wrapper oder Core-Code im Artefakt; alte v1-Beispiele unveraendert durch
  Upload und echten Worker ausfuehren. Kein automatisches Ueberschreiben.

- [x] 24. Steering und Betreiberanleitung auf Tools und kurze Tests ausrichten
  (US-4, US-5; Design 11). Rot: aus Steering extrahierte Codebeispiele auf
  aktuellen Contract und Worker-Aufruf pruefen. Gruen: kurze Anleitung fuer
  `current-bot.js`, Ziele/Prioritaeten, Testbefehle und Traceinterpretation.
  Refactor: alte widerspruechliche Low-Level-Beispiele entfernen, Entwicklungs-
  Gates vom Besucherworkflow abgrenzen. Profilrechte, Browser-Setup und
  Framework-Release dokumentieren; keine existierende externe Konfiguration
  behaupten. Erstpruefung plus maximal zwei Reparaturrunden in fuenf Minuten.

## F. Verifikation und Abnahme

- [ ] 25. Gesamte automatisierte Regression und Framework-Build pruefen
  (US-1 bis US-5; Design 10). `npm test`, `npm run build` und `npm run lint`
  ausfuehren; zusaetzlich die echte Fixedstep-Fixture-Suite ueber `bot:test`.
  Fehler jeweils zuerst als Regression reproduzieren, minimal korrigieren und
  erneut pruefen. Vorbestehende unabhaengige Fehler getrennt dokumentieren.
  Framework-Build ist kein Build der Besucherdatei. Echte Physiknachweise
  und Unit-Ergebnisse im Abschluss getrennt ausweisen.

- [ ] 26. Referenzbots unter echter Turnierlast abnehmen
  (US-3; Design 9, 10). Voraussetzungen: Betreiber-Browser und Standhardware,
  eingefrorenes Messelevel/Framework und drei feste Referenzdateien. Zehn
  vollstaendige Echtzeitlaeufe je Bot in Vierergruppen mit drei Leben und
  90 s ausfuehren; vierte Spur und Slots festlegen/dokumentieren.
  Mindestens neun von zehn Zielerreichungen je Bot ohne technische Fehler.
  Alle Ergebnisse beruecksichtigen, Infrastrukturabbrueche offenlegen;
  bei Code-/Fixtureaenderung betroffene Serie neu beginnen. Kein Abhaken
  aufgrund von Fixedstep-Erfolgen oder ohne tatsaechliche Ausfuehrung.

- [ ] 27. Besucher-Dry-Run und AK-Abgleich dokumentieren
  (US-1 bis US-5; Design 10, 11, 13). Mit realen Besucherprofilrechten eine
  Session durchfuehren: Startbot, persoenliche Strategie, begrenzter Test,
  Feedback und Abgabe derselben Datei. Ziel-/Routenunterschiede sowie
  Zeitbudget pruefen. Technische Gueltigkeit, Leistung und Strategiewunsch
  getrennt bewerten. Jeden AK mit Test-/Laufnachweis abgleichen; offene
  Browser-/Standpruefungen oder Nichterfuellung ausdruecklich offen lassen.

## Abschlussnachweise

- [x] 28. Token-Autorisierung auf expliziten Nutzerwunsch entfernen
  (US-4; Design 7). Zur Umsetzung mit "bitte ausbauen" beauftragt.
  Rot: Plugin ohne Token starten, CLI ohne Token ausfuehren und Browser ohne
  Geheimniseingabe verbinden; Requests ohne Authorization nachweisen.
  Gruen: Tokenoption, Header und Eingabefeld entfernen. Refactor: Setup-Doku
  korrigieren; Loopback-/Origin-, Lease-, Groessen- und Deadline-Tests erhalten.
  Verifiziert: 1.255 Vitest-Tests, sieben CLI-Tests und kompletter Workspace-Build
  erfolgreich. Keine Tokenvoraussetzung mehr in Plugin, CLI oder Browserseite.

Letzter Integrationsstand nach den Navigator-Reviewkorrekturen:

- `npm test`: 1.251 Tests in 148 Dateien bestanden.
- `node --test scripts/bot-test.test.mjs`: sechs CLI-Tests bestanden.
- `npm run build`: alle Workspace-Builds erfolgreich; Vite meldet den grossen
  Phaser-Hauptchunk als Warnung.
- `npm run lint`: fuenf bestehende Fehler in den unveraenderten Dateien
  `AudioControls.tsx`, `BotUploadForm.tsx` und `ScoreHud.tsx`. Zusaetzlich
  Warnungen, unter anderem Non-Null-Assertions und erhaltene Legacy-Fixture.
- Historischer `npm run bot:test -- doctor`-Check vor Task 28: wegen fehlendem
  Token blockiert. Diese Voraussetzung ist inzwischen entfernt; kein
  Browser-/Physiklauf wurde dadurch nachtraeglich als bestanden gewertet.
- `git diff -- client/src/bot/current-bot.js`: leer; Besucherdatei unveraendert.
- Reale Framework-/Fixture-Laufrevisionen liegen mangels Browserlauf noch
  nicht vor. Unit-/Wiring-Tests sind kein Nachweis der echten Spiellaeufe.

Review-Regressionsfaelle wurden zuerst rot reproduziert und dann korrigiert:
Browser-Worker-Handler ohne Getter, verzoegerte Action-Anwendung, Echtzeit-
Framebudget auf 120/144-Hz-Displays, Vite-Config-Import, notwendiger Anlauf
vor Waenden, staendige Suchneustarts durch bewegte Hazards, kombinierter
Boingo-/Gegnerkontakt und zu grosser kalter Planungsaufruf.

Verbleibende Arbeit und Nachweisgrenzen:

- Tasks 8/10: Browsertreiber und echte Mechanik-Fixtures implementiert, aber
  noch nicht im Browser ausgefuehrt. Private Fixtures sind gezielt injizierbar.
- Tasks 11-13: Navigation und Bewegungsprognose unit-getestet; Phaser-Toleranzen
  und Bounce-Folgelandungen noch nicht real bestaetigt. Bewegungsformeln im
  Planner nutzen Contract-Tuning, sind aber noch kein gemeinsam importierter
  Integrationsbaustein mit der Arcade-Anbindung.
- Task 15: Arbeit auf 256 Integrationsschritte je Aufruf reduziert, Suche
  fortsetzbar. Lokale Kalt-/Warmlaufmessungen liegen vor, aber kein Nachweis
  des kompletten 5-ms-Worker-Roundtripbudgets unter Standlast.
- Task 22: Messelevel und `/code` integriert; echte Hauptweg-/Umweglaeufe fehlen.
- Task 23: Bytegleichheit und Reset mit temporaeren Fixtures getestet; vollstaendiger
  Browser-Upload-/Worker-Nachweis steht aus.
- Task 25: Unit-Regression und Build gruen, reale Fixedstep-Abnahme noch offen.
- Task 26: CLI-Testtreiber fuehrt bislang Einzellaeufe aus. Eine automatisierte
  Vierergruppen-Abnahmeserie ist noch nicht implementiert/ausgefuehrt; der
  bestehende MatchRunner bleibt der produktive Gruppenpfad.
- Task 27: Besucherprofilrechte, 15-20-Minuten-Nutzerreise und die geforderte
  Quote von mindestens neun Zielerreichungen aus zehn Laeufen je Referenzbot
  sind nicht nachgewiesen. Das Feature ist noch nicht als messereif abgenommen.


## Abschluss v2 am 16.09.2026

Vollständige Level-1-Läufe in `/dev` bis zum Ziel; letzte Fassung 44,850 s,
ohne Respawn oder technischen Fehler. Nachweis: [abnahme-v2.md](abnahme-v2.md).
1.171 Tests in 136 Dateien und gesamter Workspace-Build erfolgreich.
Startvorlage, Arbeitsbot und explizites Messe-Beispiel verwenden dieselbe
editierbare Route. Unabhängiges Abschlussreview ohne kritische Findings.
Keine Commits oder Veröffentlichung.
