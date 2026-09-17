# 03 - Technische Architektur

## Aktueller Datenfluss

```text
current-bot.js (eine unveraenderte Datei)
  -> Vorschau /code / manueller Upload
  -> Guard + Browser-Modul-Worker + Modulvalidierung
  -> module-ready
  -> decide(state, tools) bei frameworkVersion: 2
       tools.navigate(intent) -> lokale Zielnavigation -> Bewegungsmotor
       tools.run(command) / tools.status() / tools.options() -> @arena/bot-navigation
     oder decide(state) fuer Bots ohne Framework-Version
  -> Action[] + optionale Navigationsdiagnose
  -> korrelierte Anwendung in folgenden RaceScene-Physikschritten
```

Das fruehe Konzept mit 16-Bot-Heats, geteilter Welt und 150-ms-Ticks ist
abgeloest. Aktuell gibt es Single-Elimination mit zwei oder vier Bots pro
Match, je eine getrennte `RaceScene`-Welt pro Bot im gemeinsamen Canvas und
ein Bot-Intervall von etwa 33 ms. Die Spiellogik bleibt vollstaendig im Browser.

## Komponenten

| Komponente | Verantwortung |
| --- | --- |
| `packages/bot-contract/` | State, Actions, Modulvalidierung, `ToolsApi`, `NavigationIntent`, `ControlCommand`, `ControlStatus` und Guard |
| `packages/bot-navigation/` | Lokale Zielnavigation, Bewegungsangebote, beobachteter Ablauf für walk/jump/drop/boingo und eindeutiger Befehlsbesitz |
| `client/src/sandbox/` | Modul-Worker, Ready-Barriere, Timeouts, versionierte Tools je Bot |
| `client/src/game/state/` | Snapshot realer Bodies/Objekte und additive Navigation-Observation |
| `client/src/game/scenes/RaceScene.ts` | Gemeinsame Spielregeln fuer Vorschau und Match |
| `client/src/match/MatchRunner.ts` | Getrennte Szenen und Kamera-Viewports pro Teilnehmer |
| `client/src/game/trace/` | Begrenzte Versuchstraces und vorsichtige Diagnose |
| `client/vite/botTracePlugin.ts` | Vorhandene Persistenz der Vorschau-Traces unter `client/src/bot/runs/` |

Navigation hat keine Phaser-, DOM- oder Netzwerkabhaengigkeit. Sie wird mit dem
Framework gebaut und im Worker bereitgestellt, **nicht** in Besucherdateien
kopiert. Der Besuchercode wählt mit `navigate` das Ziel (`goal`, sichtbare Frucht
oder Plattform) sowie `caution` und `allowBoingo`. Die Zielnavigation bewertet
standardmäßig die Bewegungsangebote. Optional übernimmt `intent.choose` diese
Auswahl synchron im Worker anhand unveränderlicher, beschreibender Angebote.
Der Callback gibt eine aktuelle Angebots-ID oder bewusstes Warten zurück;
der Motor behält Anlauf, Flug und Landung. So kann Besuchercode Routen- und
Manöverregeln ändern, ohne eigene Physiksteuerung zu schreiben. Die Zielnavigation
hält Ausführungszustand und übernimmt vorbereitende
Manöver sowie begrenzte Wiederherstellung. Sie hat keine vollständige Levelkarte
oder garantierte Route. Angebote schätzen Flugbahnen anhand sichtbarer Geometrie;
maßgeblich bleiben die tatsächlichen Kontakte und Impulse aus der RaceScene.

Der Bewegungsmotor führt jeweils einen konkreten Auftrag aus und meldet dessen
beobachteten Erfolg oder Fehler. Besucher können ihn weiterhin unmittelbar mit
`run` steuern und über `options` eigene Manöver auswählen. Der Worker erlaubt pro
Entscheidung höchstens einen Ausführungsaufruf (`navigate` oder `run`). Gibt der Bot
eigene abweichende Actions zurück oder nutzt keinen Ausführungsaufruf, setzt er
die Helfersteuerung zurück. Der unveränderte Low-Level-Action-Vertrag bleibt auch
für Bots ohne Framework-Version erhalten. Die gemeinsame Navigation verändert
weder Level, Sichtfeld, Physik, Lebensbudget noch Scoring und gibt keine
Erfolgsgarantie. Referenzstrategien liegen in `examples/navigation/`.
Details: [02-bot-api.md](02-bot-api.md).

## Beobachtung und Ausfuehrung

Snapshots stammen aus derselben abgeschlossenen Physikphase. Bewegte Hazards
melden Instanzpositionen, Velocity wird einmal pro Beobachtung fortgeschrieben,
nicht bei Kollisionscallbacks. Respawn/Controllerwechsel setzen die Historie
zurueck. Verbleibende Block-Collider und freigelegte Fruechte bleiben sichtbar.
Die optionale Navigation-Observation beschreibt effektive Body-Geometrie,
solide/One-Way-Kollision, Epoche, Frame, Physikraster und externe Impulse.
`lastImpulse` bewahrt den letzten echten Impuls mit Sequenznummer auch nach
der Landung auf; ein Epoch-Wechsel setzt ihn zurück.

Vor dem ersten Tick wartet die Laufzeit auf `module-ready`: Modul und Tools
muessen geladen sein, bevor das Tick-Budget gilt.
Arcade verwendet Fixedstep mit 60 Hz; Botentscheidungen laufen etwa alle 33 ms.
Es gibt maximal eine ausstehende Workeranfrage. State-Tick, Worker-Request,
Epoche und tatsaechlicher Anwendungsframe sind unterschiedliche Groessen.
Spaete/veraltete Antworten werden nicht einer neuen Szene oder Revision
zugeschrieben. Lokaler Roundtrip-Watchdog: 100 ms. Der erste Timeout oder Laufzeitfehler
stoppt den Bot, terminiert den Worker und löscht gehaltene Actions. Guard und Worker sind keine umfassende Fremdcode-Sicherheitsgarantie.

## Ausprobieren und Feedback

Die bestehende Vorschau `/code` laeuft im lokalen Vite-Client. Speichern von
`current-bot.js` loest einen vollstaendigen Reload aus; Szene und Worker starten
mit dem neuen Code. Kein weiterer Dienst oder separater Testablauf ist noetig.
Besucher und Agent klaeren Name und Strategie, sehen den Lauf an und besprechen
eine passende Verbesserung. Ablauf: [04-devkcode-profil.md](04-devkcode-profil.md).

Die vorhandenen Traces unter `client/src/bot/runs/` beschreiben einzelne
Versuche vom Start/Respawn bis Tod, Ziel, Zeitlimit oder Abbruch, nicht automatisch
den Gesamtlauf. Vor der Zuordnung zum aktuellen Code `run.botRevision` pruefen.
Zuerst `run`, `summary` und `findings` lesen, dann relevante `events`/`windows`.
Ereignisse sind Fakten, Diagnosen Hinweise; gekuerzte Ausschnitte erklaeren nicht
den gesamten Lauf. Vorhandene v1-Traces bleiben lesbar. Weder Unit-Tests noch
ein einzelner Vorschau-Lauf belegen allgemeine Zuverlaessigkeit oder Standlast.

## Betriebsarten

- `npm run dev`: lokaler Vite-Client fuer die Besucherstation, kein Hub.
- `/code`: Botbau-Vorschau; `/dev` bezeichnet die bisherige Stationsansicht.
- `npm run present`: Hub-Server mit WebSocket-Gateway und Vite-/Static-Hosting
  fuer `/admin` und `/present`. Keine Spielsimulation auf dem Server.
- `npm run reset-bot`: ausschliesslich expliziter Betreiber-Reset zwischen
  Sessions. Kopiert die Vorlage und entfernt Session-Traces.

Ein Framework-Update ersetzt vorhandene `current-bot.js` nicht automatisch.
Die Vorlage ist daher nicht automatisch der aktuell laufende Bot.
Vorschau, Upload und Turnier verwenden denselben Workerpfad und Release.
Waehrend einer Turnierserie wird dieser Release nicht gewechselt. Ein Bot hat
keinen eigenen Build, Wrapper oder beigelegten Core.

## Hub und Turnier

Der zentrale Node-Hub ist Relay und Speicher fuer Admin/Presentation, keine
Bot-Sandbox und kein Physikserver. Er haelt Bot-Registry und Turnierzustand im
Speicher; neue Clients erhalten Snapshots. Nach Serverneustart werden die
Bot-Dateien erneut hochgeladen. Besucherstationen senden ihre Arbeitsdatei
nicht automatisch zum Hub; manueller Transfer bleibt Betreiberaufgabe.

Die Validierung bleibt dreigeteilt:

1. `/admin`: statischer Guard und Modulvalidierung im Browser-Worker vor Upload.
2. Server: erneuter textueller Guard fuer eingehende `bot-add`-Nachrichten,
   ohne Bot-Code auszufuehren.
3. `/present`: erneute Modulvalidierung im eigenen Worker vor dem Lauf.

`TournamentService` und `SingleEliminationStrategy` verwalten Gruppen und
Weiterkommen. Stage-Level werden vor Turnierstart gewaehlt; fehlende weitere
Stages verwenden das zuletzt konfigurierte Level. Jede `RaceScene` besitzt
eigene Fruechte, Hazards und Physik, sodass ein Bot keinem anderen Objekte
wegnehmen kann. Details: [09-bot-artefakt-und-turnier.md](09-bot-artefakt-und-turnier.md).
