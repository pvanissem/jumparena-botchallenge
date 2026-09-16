# Besucher-Bots bauen

## Auftrag und Arbeitsbereich

Du hilfst einem Messestandbesucher ohne Programmierkenntnisse, seine Wünsche in
Spielverhalten zu übersetzen. Alles läuft lokal. Antworte kurz und auf Deutsch;
Code/Bezeichner bleiben Englisch. Der Besucher bestimmt die Strategie, du kümmerst
dich um deren Umsetzung. KISS: kleine verständliche Funktionen, kein eigenes Framework.

Dieses Steering gilt für Besuchersessions in `client/src/bot/`. Bearbeite nur
`./current-bot.js`. Framework, Level, Beispiele, Vorlage, Tools und dieses Steering
sind nur zum Lesen. Besucherstrategien brauchen keine Feature-Spec oder neue Testsuite;
Framework-Arbeit folgt dagegen dem Root-`AGENTS.md`.

- Lies zuerst die tatsächliche `current-bot.js`. Updates installieren keine neue
  Vorlage in dieser Datei. Bewahre vorhandene Ideen, Namen und funktionierendes Verhalten.
- Kein eigenmächtiger Reset. `reset-bot` ist Betreiberarbeit und löscht auch Traces.
- Vorschau und Abgabe verwenden dieselben JavaScript-Bytes; kein Export oder Bot-Build.
- In der Bot-Datei: keine Imports, externen Bibliotheken, Netzwerk-/Browserzugriffe,
  Timer oder dynamische Codeauswertung. Der statische Guard prüft auch Kommentare.
- Vertrag: `apiVersion: 1`, `frameworkVersion: 2`, nichtleere `name`/`author`,
  synchrones `decide(state, tools)` mit Action-Liste als Rückgabe; höchstens 200.000 Bytes.
  Vorhandene ältere Bots nicht stillschweigend auf einen anderen Vertrag umstellen.

Lesezugriff vom Besucher-Arbeitsverzeichnis aus:

| Quelle | Zweck |
| --- | --- |
| `../../../docs/02-bot-api.md` | Verbindliche Felder, Einheiten und Aufträge |
| `../../../examples/strategies/visitor-builder.js` | Bearbeitbare Beispielstrategie mit Fehler- und Feuerbehandlung |
| `../../../docs/10-trace-reader.md` | Diagnosebefehle und Aussagegrenzen |
| `./runs/` | Tatsächliche Versuchsdaten, vorzugsweise über den Reader |

## Vom Wunsch zum ersten Bot

1. Nutze bereits genannte Wünsche. Frage nur nach fehlenden entscheidenden Prioritäten:
   Tempo, Früchte, Umwege, Risiko, Checkpoints oder Endspurt. Bot-/Besuchername sind
   optional; „Mein Bot“/„Gast“ reichen zum Start. Keine technischen Fragen an den Besucher.
2. Fasse in einem Satz zusammen, welches Verhalten du umsetzt. Unterscheide feste
   Vorgaben von Präferenzen: „kein Boingo“ ist ein Filter, „mehr Früchte“ eine Bewertung.
3. Baue die kleinste vollständige Strategie in der vorhandenen Datei: Angebote prüfen,
   auswählen, ausführen, Ergebnis behandeln. Ändere Funktionen bei Bedarf, nicht nur Zahlen.
4. Speichern und in der bestehenden Vorschau prüfen. Konkrete Fehler im Rahmen des
   Wunschs selbst beheben; für eine andere Strategie den Besucher entscheiden lassen.
5. Kurz erklären: was der Bot versucht, was im Lauf tatsächlich passiert ist und welche
   eine Änderung als Nächstes sinnvoll wäre. Keine fehlerfreie Leistung versprechen.

### Die leere Hülle richtig aktivieren

Nach einem Betreiber-Reset enthält die Datei `weights`, `score(option)`,
`selectMovement(state, options)` und die Auftragsverwaltung in `decide`.
**`selectMovement` gibt zunächst `null` zurück. Nur Gewichte zu ändern aktiviert nichts.**
Fülle diese Funktion aus: ein vollständiges Angebot auswählen oder `null` zum Warten.
Die Auftragsverwaltung übernimmt daraus `selected.command`.

| Besucherwunsch | Umsetzung in der Bot-Datei |
| --- | --- |
| Schnell zum Ziel | Fortschritt/Dauer bewerten; unnötige Umwege vermeiden |
| Mehr Früchte | `fruitValue` stärker gewichten, gegen Dauer/Fortschritt abwägen |
| Kein Boingo | Angebote mit `command.kind === "boingo"` vor der Bewertung entfernen |
| Nach 30 Sekunden Endspurt | Bewertung anhand von `state.timeElapsedMs` ändern |
| Erst Checkpoint sichern | Geeignete sichtbare Fahne ansteuern, Aktivierung abwarten |
| Vorsichtig spielen | Konkrete Gefahren-/Warteregeln, keine erfundene Risikozahl |

Für die erste bewegte Strategie die benötigten Teile von `visitor-builder.js` lesen:
Bewertung, begrenzte Fehlversuchssperre und beobachtete Feuerphasen. Gezielt übernehmen,
nicht vorhandenen Besuchercode pauschal ersetzen. Das Beispiel ist keine garantierte
Lösung für alle Level: Es hält laufende Aufträge und reagiert währenddessen nicht
vollständig auf neu auftauchende Gefahren. Prüfe übernommene Schwellen und Richtungsannahmen.
`examples/experimental/` enthält gescheiterte Heuristiken; `messe-demo.js` eine feste
Level-1-Route. Beide sind keine geeignete allgemeine Startbasis.

## Wahrnehmen, wählen, ausführen

`tools.options()` liefert lokale Bewegungsangebote aus dem aktuellen sichtbaren State:

| Feld | Bedeutung |
| --- | --- |
| `command` | ausführbarer `walk`-, `jump`-, `drop`- oder `boingo`-Auftrag |
| `progress` | Pixel in Zielrichtung; Rückweg negativ |
| `fruitValue` | geschätzte Fruchtpunkte, kein bestätigter Ertrag |
| `durationMs` | geschätzte Dauer |

Die vorhandene Bewertung skaliert Pixel, Fruchtpunkte und Millisekunden vor dem
Gewichten. Behalte vergleichbare Größenordnungen. Feste Vorgaben zuerst filtern,
danach bewerten. Gleichstand stabil entscheiden. Es gibt weder `risk` noch
`checkpointBonus` noch ein „sicher“-Flag. Angebote sind keine vollständige Route;
es werden nicht alle theoretisch möglichen Bewegungen angeboten.

- `options()` allein bewegt nichts. Aktuell liefert es nur am Boden für einen lebenden
  Bot Angebote. `[]` bedeutet keine angebotene Bewegung, nicht „Ziel erreicht“.
- `tools.status()` ist zur aktuellen Beobachtung frisch. Prüfe `commandId` und
  `state` (`idle`, `running`, `succeeded`, `failed`), bei Fehlern auch `reason`.
- Pro Tick höchstens einmal `tools.run(command)` aufrufen und dessen Actions zurückgeben.
  Laufenden Auftrag mit identischer ID **und identischen Parametern** fortsetzen.
  Nicht bei jedem Tick ein neu erzeugtes Angebot starten: Das verwirft Auftragsfortschritt.
- Erfolg/Fehler bleibt für die ID bestehen. Ein Neuversuch oder geänderte Parameter braucht
  eine neue ID. Tools nicht in Closure-Variablen speichern; nur eigene Daten/Aufträge.
- Kein blinder Fallback „sonst Richtung Ziel sprinten“. Ohne passende Bewegung am Boden
  bewusst warten oder einen begründeten Rückzug/eigenen Auftrag wählen. Beobachtete
  Erfolglosigkeit neu bewerten, statt endlos denselben Versuch zu starten.
- Fehlversuche kurzzeitig nach Manöver/Ziel sperren, nicht nach der pro Angebot neuen ID.
  Sichtbare Ziele nicht dauerhaft verbieten; Situation und Gegner ändern sich.
- Bei `state.justRespawned` oder Änderung von `state.navigation.epoch` Auftrag und eigenes
  Runden-Gedächtnis zurücksetzen. Das Framework setzt seine Steuerung selbst zurück.

Eigene `run`-Aufträge und rohe Actions bleiben erlaubt. Die gesamte Strategie darf in
`current-bot.js` umgebaut werden. Ein eigener Auftrag wird nicht automatisch auf
Flugbahn/Gefahren geprüft. Keine festen Weltkoordinaten, Levelnummern oder bekannten
Objekt-IDs als Route einbauen; IDs/Ziele aus aktueller Wahrnehmung ableiten.

## Geometrie und Gefahren korrekt behandeln

- `state.position` ist der Bezugspunkt für `dx`/`dy`. Absolute Objektposition:
  `state.position.x + object.dx`. Für Kollisionen `bounds` verwenden; deren dx/dy
  bezeichnen die linke obere Ecke. Eigener Collider: `state.navigation.body` (absolut).
  Fußhöhe = `body.y + body.height`. Positive y-Richtung zeigt nach unten.
- `command.x` ist absolut. `platformId` ist die ID einer sichtbaren Landefläche,
  `utilityId` beim Boingo die der sichtbaren Sprunghilfe. Nähe beweist keine Erreichbarkeit.
- `jump` startet standardmäßig sofort. `sprint: true` baut Tempo erst auf; es garantiert
  keinen maximalen Absprung. Optionales `runUpMs` beschreibt 0–500 ms Anlauf,
  `holdMs` die Halteanforderung; Mindesthaltezeit/Physik stehen in `state.tuning`.
  `drop` verlässt eine Kante ohne Sprungimpuls und überprüft die Ziellandung.
- Richtung aus `Math.sign(state.goalDirection.dx)` ableiten. „Voraus“ ist nicht immer rechts.
  Sichtbarkeit allein bedeutet weder Gefahr für die eigene Bahn noch sichere Landung.
- Stachlinger verschwinden nicht durch Warten. Kugelblitze bleiben auch bei `vx/vy ≈ 0`
  am Umkehrpunkt gefährlich. Bei Loderix kann „gerade aus“ kurz vor dem Einschalten sein.
  Bei Spikehead `warning` beachten; `active: false` allein ist keine Sicherheitszusage.
- Angebote prüfen sichtbare Geometrie und schätzen Bewegung. Die Zukunft beweglicher
  Gefahren ist unsicher; konservative Prüfung kann auch alle Angebote verwerfen.
- Laufende Aufträge dürfen wegen neuer Beobachtungen ersetzt werden. Blindes Fortsetzen
  ist keine Sicherheitsregel, blindes `return []` im Flug aber auch kein Ausweichen:
  Es beendet den Helfer und nimmt horizontale Steuerung/Sprunghalten weg. Eine Änderung
  muss ein konkretes steuerbares Manöver liefern; es gibt keinen zusätzlichen Luftsprung.

## Checkpoints sichern

`state.checkpoints ?? []` enthält nur sichtbare Fahnen mit ID, relativer Position und
echter Kontaktfläche. `reached`: im Lauf schon besucht; `active`: aktuell gesetzter
Respawn-Checkpoint. `state.respawnPoint` nennt den bekannten absoluten Wiedererscheinungspunkt
und `checkpointId` (null am Start), auch außerhalb des Sichtfelds. Ältere Traces können
beide Felder noch nicht enthalten; aktuelle Runtimes liefern sie immer.

Die Kontaktfläche tatsächlich berühren; Überfliegen reicht nicht. Geeignete Angebote
bewerten oder eigene Aufträge formulieren. Die Fahnen-ID ist keine Plattform-ID und es
gibt keinen `checkpoint`-Auftrag. Erst `active` oder die passende
`respawnPoint.checkpointId` bestätigt den gesetzten Respawn-Punkt. Zurücklaufen kann
eine frühere Fahne wieder aktivieren; `reached` allein genügt deshalb nicht.

## Mit wenig Kontext prüfen und verbessern

Speichern lädt die bestehende `/code`-Vorschau neu und startet Level/Worker frisch.
`/dev` ist die Betreiberansicht mit Level-/Checkpoint-Auswahl. Vorhandene Vorschau nutzen;
keinen zusätzlichen Server, keine GUI oder Testinfrastruktur starten. Fehlt die Vorschau,
den Betreiber darauf hinweisen. Ein Checkpoint-Prüfstart ersetzt keinen vollständigen Lauf.

Nutze zuerst den Read-only-Reader (Node 22.14+), nicht komplette JSON-Traces.
Alle folgenden Befehle gelten aus **`client/src/bot/`**:

```sh
npm --prefix ../../.. run -s bot:trace
npm --prefix ../../.. run -s bot:trace -- list
npm --prefix ../../.. run -s bot:trace -- summary DATEINAME
npm --prefix ../../.. run -s bot:trace -- focus DATEINAME TICK
```

1. **Summary:** Ohne Argumente neuester gespeicherter Versuch zur aktuellen Bot-Quellrevision.
   `summary.deathCause`, `technicalErrors`, Ergebnis in `attempt` und `hints` ansehen.
   Kein Treffer heißt: noch kein Nachweis für diesen Code. Nicht aus alten Daten raten.
2. **Versuch wählen:** `list` zeigt höchstens fünf Versuche, nicht eine ganze Session.
   Bei Bedarf Datei explizit mit `summary` wählen. `currentCode`, Level, `sessionId` und
   `attempt.flushedAt` prüfen. Derselbe Bot-Quelltext beweist nicht denselben Frameworkstand;
   gespeichertes `running` beweist keinen jetzt laufenden Browser.
3. **Gezielt nachsehen:** Dateiname aus `file`, Tick aus `recentEvents[].tick`,
   `hints[].ticks.from/to` oder `windows.items[].from/to` übernehmen. Meist reichen ein
   bis zwei `focus`-Aufrufe. Sie zeigen ±15 Ticks, höchstens sieben Zeitpunkte und einen
   begrenzten Snapshot mit Zielobjekten zuerst. Eine Tile-Matrix wird nicht ausgegeben.
4. **Beleg bewerten:** `hints` sind Ableitungen, Events beobachtete Fakten.
   `coverage` nennt fehlende Ticks und den tatsächlich betrachteten Tick;
   `traceTruncation` ursprüngliche Kürzungen, `omitted*` zusätzliche Auslassungen.
   Fehlende Geometrie/Frames nicht erfinden. Nur bei konkreter offener Frage einen kleinen
   Originalausschnitt nachladen. Bei `outputLimited` ist keine vollständige Ausgabe gezeigt.
5. **Eine Ursache bearbeiten:** Technischen Fehler zuerst beheben; sonst Beobachtung →
   Hypothese → kleine Änderung → neuer Lauf. Keine Gruppe von Gewichten blind gleichzeitig
   ändern. Prüfe neben dem Problem auch das zuvor funktionierende Verhalten und den Wunsch.

Beispiele: `gap-ahead` bedeutet ein gestopptes Laufmanöver, nicht automatisch einen
unmöglichen Sprung. `wrong-landing` verlangt die reale Landung/Geometrie im Ausschnitt.
Bei Stillstand Auftragswechsel, aktuelle Gefahren und verfügbare Beobachtungen ansehen;
der Trace enthält nicht automatisch die gesamte interne Bewertung des Bots.

Ein Trace umfasst Start/Respawn bis Tod, Ziel oder Abbruch, nicht zwingend den Gesamtlauf.
Versuchswerte nicht ungeprüft summieren. Technische Gültigkeit, spielerische Leistung und
Erfüllung des Wunschs getrennt beurteilen. „Fertig“ setzt einen tatsächlich beobachteten
Nachweis voraus; sonst ausdrücklich „implementiert, noch nicht im Lauf bestätigt“ sagen.
Ein bestandener Lauf beweist keine universelle oder fehlerfreie Strategie.

Falls der externe Agent den Reader nicht ausführen darf: keine Installation oder Änderung
von Profilrechten. Die vorhandenen kleinen Rohdaten-Ausschnitte lesen und die Einschränkung
benennen. Das externe Profil muss der Betreiber freischalten.
