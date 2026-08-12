# Requirements: Bot-Run-Feedback

## Kontext

Bezug: `docs/02-bot-api.md` (Bot-State und Actions),
`docs/04-devkcode-profil.md` (kurze Bot-Erstellung am Messestand),
`docs/09-bot-artefakt-und-turnier.md` (`/dev`-Testmodus),
`.features/dev-station-mode/` und `client/src/bot/AGENTS.md`.

Die bisher erzeugten Bots sterben häufig und entsprechen oft nicht dem Wunsch
des Besuchers. Der Bot-Agent kann einen Test heute nicht selbst nachvollziehen,
sondern ist auf die Beobachtung und Beschreibung des Besuchers angewiesen.

In `/dev` besitzt der Racer unbegrenzte Leben. Für dieses Feature bezeichnet
„Run“ deshalb bewusst **nicht** den gesamten 90-Sekunden-Test, sondern genau
einen Versuch zwischen Start beziehungsweise Respawn und dem nächsten Tod,
Ziel, Zeitlimit oder manuellen Abbruch. Jeder abgeschlossene Run wird sofort per
POST als eigene, zeitgestempelte JSON-Datei unter `client/src/bot/runs/` abgelegt.
Nach einem Tod beginnt beim Respawn ein neuer Run und damit eine neue Datei.

Das JSON enthält eine kompakte Zusammenfassung, tatsächliche Arena-Ereignisse,
abgeleitete Hinweise und kleine Tick-Fenster. Es ist kein vollständiger Dump
aller Bot-States.

## User Stories

### US-1: Einen Versuch als eigenständigen Run erfassen

Als Bot-Entwickler möchte ich für jeden einzelnen Versuch eine eigene
Trace-Datei erhalten, damit Tode und ihre Vorgeschichte unmittelbar
analysierbar sind.

Akzeptanzkriterien:

- WHEN in `/dev` bei aktivierter Telemetrie die Bot-Steuerung beginnt oder der
  Bot respawnt SHALL DAS SYSTEM eine neue Trace-Aufzeichnung mit Level-ID und
  Startzeitpunkt beginnen.
- WHEN der Bot stirbt SHALL DAS SYSTEM den aktuellen Run mit dem Ergebnis
  `death` und der tatsächlichen Todesursache abschließen, genau einmal per POST
  übertragen und beim Respawn eine neue Aufzeichnung beginnen.
- WHEN der Bot das Ziel erreicht SHALL DAS SYSTEM den aktuellen Run mit dem
  Ergebnis `finished` abschließen und genau einmal übertragen.
- WHEN das 90-Sekunden-Zeitlimit erreicht wird SHALL DAS SYSTEM den aktuellen
  Run mit dem Ergebnis `time-limit` abschließen und genau einmal übertragen.
- WHEN „Neu“, ein Levelwechsel oder der Wechsel zu „Selbst spielen“ einen
  bereits aussagekräftigen Run beendet SHALL DAS SYSTEM ihn mit dem Ergebnis
  `aborted` abschließen und genau einmal übertragen.
- WHEN der BotRunner technisch pausiert wird SHALL DAS SYSTEM den aktuellen Run
  mit dem Ergebnis `bot-paused` und dem technischen Grund abschließen und genau
  einmal übertragen.
- WHEN ein Run abgeschlossen wird SHALL DAS SYSTEM mindestens Dauer,
  Start-/Endposition, maximalen Level-Fortschritt, eingesammelte Früchte,
  Fruchtpunkte und Ergebnis zusammenfassen.
- WHEN ein leerer Run noch keinen Bot-Tick und kein technisches Ereignis enthält
  SHALL DAS SYSTEM beim Abbruch keine Datei erzeugen.

### US-2: Telemetrie ausschließlich in `/dev`

Als Betreiber möchte ich Telemetrie gezielt nur beim Bot-Test in `/dev`
verwenden, damit alle anderen Arena-Pfade unverändert bleiben.

Akzeptanzkriterien:

- WHEN `DevPage` im Bot-Modus läuft SHALL DAS SYSTEM Telemetrie explizit für
  diese Arena aktivieren.
- WHEN `/dev` im Modus „Selbst spielen“ läuft SHALL DAS SYSTEM keinen Recorder
  erzeugen und keinen Trace übertragen.
- WHEN eine Arena ohne explizite Telemetrie-Aktivierung läuft, insbesondere in
  `/present`, SHALL DAS SYSTEM keinen Recorder erzeugen, keine Bot-Ticks für
  Telemetrie kopieren, keinen Diagnose-Observer registrieren und keinen
  Trace-Request senden.

### US-3: Tatsächliche Ursachen und Bot-Entscheidungen sichtbar machen

Als Bot-Entwickler möchte ich relevante Arena-Ereignisse zusammen mit den
unmittelbar vorangegangenen Wahrnehmungen und Actions sehen, damit Ursache und
Wirkung nachvollziehbar sind.

Akzeptanzkriterien:

- WHEN der Bot einen Bot-Tick ausführt SHALL DAS SYSTEM den an `decide(state)`
  übergebenen State und die normalisierten Actions für einen begrenzten
  Diagnosepuffer korrelieren.
- WHEN der Bot in einen Abgrund fällt SHALL DAS SYSTEM `pit-fall` mit Zeit,
  Tick und Todesposition als beobachteten Fakt erfassen.
- WHEN der Bot durch einen Hazard stirbt SHALL DAS SYSTEM `hazard-hit` mit
  Hazard-Typ, Hazard-ID, Zeit, Tick und Todesposition als beobachteten Fakt
  erfassen.
- WHEN der Bot einen stompbaren Hazard zerstört, eine Frucht sammelt, einen
  Block auslöst oder einen Checkpoint erreicht SHALL DAS SYSTEM das jeweilige
  Arena-Ereignis erfassen.
- WHEN `decide()` einen Laufzeitfehler verursacht, sein Zeitbudget überschreitet
  oder der BotRunner pausiert wird SHALL DAS SYSTEM den technischen Vorfall mit
  Tick, Fehlerart und verfügbarer Fehlermeldung erfassen.
- WHEN ein diagnosewürdiges Ereignis eintritt SHALL DAS SYSTEM ein kleines
  Tick-Fenster davor und, sofern vorhanden, unmittelbar danach übernehmen;
  jeder Tick enthält nur diagnosewichtige State-Felder und Actions.
- WHEN das System eine Ursache aus der Arena kennt SHALL DAS SYSTEM sie als
  beobachteten Fakt kennzeichnen und nicht durch eine Heuristik ersetzen.

### US-4: Typische Fehlverhalten kompakt erkennen

Als Bot-Agent möchte ich auffällige Muster als begründete Hinweise im Trace
erhalten, damit ich nicht alle Ticks selbst durchsuchen muss.

Akzeptanzkriterien:

- WHEN der Bot über ein relevantes Zeitfenster trotz horizontaler Actions kaum
  Fortschritt erzielt SHALL DAS SYSTEM einen Hinweis `stuck` mit Beleg-Ticks
  erzeugen.
- WHEN der Bot in kurzer Folge häufig die horizontale Richtung wechselt und
  kaum Fortschritt erzielt SHALL DAS SYSTEM einen Hinweis `oscillating` mit
  Beleg-Ticks erzeugen.
- WHEN eine Lücke rechtzeitig sichtbar war und der Run anschließend durch
  `pit-fall` endet, ohne dass ein rechtzeitiger wirksamer Sprung erkennbar ist,
  SHALL DAS SYSTEM einen Hinweis `missed-gap` erzeugen.
- WHEN ein Sprung vor einem Tod kürzer als die minimale Haltedauer gehalten und
  sichtbar abgeschnitten wurde SHALL DAS SYSTEM einen Hinweis
  `jump-cut-short` erzeugen.
- WHEN ein aktiver oder warnender Hazard sichtbar war und der Run kurz darauf
  durch Kontakt mit diesem Hazard endet SHALL DAS SYSTEM einen Hinweis
  `hazard-not-avoided` erzeugen.
- WHEN das System einen Hinweis erzeugt SHALL DAS SYSTEM ihn als abgeleitete
  Diagnose kennzeichnen und seine Fakten beziehungsweise Ticks referenzieren.
- WHEN die Evidenz nicht ausreicht SHALL DAS SYSTEM keine Diagnose erfinden.

### US-5: Eine Datei pro Run bereitstellen

Als Bot-Agent möchte ich die neuesten Runs über ihre Dateinamen finden und
direkt lesen können.

Akzeptanzkriterien:

- WHEN ein Run übertragen wird SHALL DAS SYSTEM ein versioniertes JSON-Dokument
  mit mindestens `run`, `summary`, `events`, `findings` und `windows` erzeugen.
- WHEN der lokale Vite-Server einen gültigen Run empfängt SHALL DAS SYSTEM genau
  eine neue Datei mit einem UTC-Zeitstempel inklusive Millisekunden als Namen
  unter `client/src/bot/runs/` schreiben.
- WHEN mehrere Runs abgeschlossen werden SHALL DAS SYSTEM für jeden Run eine
  neue Datei anlegen und keine ältere Datei aktualisieren oder überschreiben.
- WHEN Run-Dateien lexikografisch nach Dateiname sortiert werden SHALL DAS
  SYSTEM dadurch zugleich ihre zeitliche Reihenfolge abbilden.
- WHEN das JSON erzeugt wird SHALL DAS SYSTEM vollständige Leveldefinitionen,
  redundante vollständige States und nicht JSON-fähige Werte vermeiden.
- WHEN überlappende Diagnosefenster entstehen SHALL DAS SYSTEM sie vereinigen,
  statt Tick-Daten unnötig zu duplizieren.
- WHEN das Projekt versioniert wird SHALL DAS SYSTEM `client/src/bot/runs/` nicht
  in Git aufnehmen.
- WHEN der Trace nicht geschrieben werden kann SHALL DAS SYSTEM den laufenden
  Test nicht beeinflussen und den Fehler in `/dev` sichtbar melden.

### US-6: Kurzer Feedback-Loop und sauberer Reset

Als Messebesucher möchte ich eine kurze, verständliche Rückmeldung und genau
eine gezielte Verbesserung erhalten.

Akzeptanzkriterien:

- WHEN der Besucher einen Test besprechen möchte SHALL DER BOT-AGENT die
  neuesten Dateien unter `client/src/bot/runs/` anhand der Dateinamen ermitteln
  und die für die Frage nötigen letzten Runs lesen.
- WHEN der Agent Run-Dateien liest SHALL DER BOT-AGENT das dokumentierte Schema
  sowie die Trennung zwischen Fakten und abgeleiteten Findings beachten.
- WHEN eine plausible Hauptursache erkennbar ist SHALL DER BOT-AGENT höchstens
  zwei Beobachtungen in Alltagssprache erklären und genau eine zur gewünschten
  Strategie passende Änderung vorschlagen.
- WHEN der Besucher zustimmt SHALL DER BOT-AGENT `current-bot.js` entsprechend
  anpassen; ohne Zustimmung SHALL er keine Verhaltensänderung vornehmen.
- WHEN die Änderung erfolgt ist SHALL DER BOT-AGENT höchstens einen kurzen
  Kontrolllauf empfehlen.
- WHEN `npm run reset-bot` ausgeführt wird SHALL DAS SYSTEM die Bot-Datei wie
  bisher auf die Standardvorlage zurücksetzen und zusätzlich alle bisherigen
  JSON-Trace-Dateien unter `client/src/bot/runs/` löschen.

### US-7: Spielverhalten und Laufzeit bewahren

Als Standbetreuer möchte ich die Telemetrie ohne spürbare Beeinflussung des
Spiels verwenden.

Akzeptanzkriterien:

- WHEN Telemetrie aktiv ist SHALL DAS SYSTEM Spielphysik, Bot-Tickfrequenz,
  Action-Auswertung, Wertung und Zeitlimit nicht verändern.
- WHEN ein Bot-Tick aufgezeichnet wird SHALL DAS SYSTEM `decide(state)` nicht
  zusätzlich aufrufen.
- WHEN ein Run aktiv ist SHALL DAS SYSTEM Daten im Browser puffern und keine
  tickweisen oder periodischen Trace-Requests senden.
- WHEN ein Run endet SHALL DAS SYSTEM genau einen kompakten POST senden.
- WHEN ein Trace ausgewertet wird SHALL DER BOT-AGENT keine autonome Serie von
  Optimierungs- und Testläufen starten.

## Nicht-Ziele

- Kein Replay- oder Video-Recorder.
- Kein ungefilterter Dump aller vollständigen `BotState`-Objekte.
- Keine automatische Bot-Änderung ohne Zustimmung.
- Keine autonome, mehrstufige Optimierung.
- Keine Telemetrie in `/present`.
- Kein Ausbau der Navigations-Utilities oder Standardstrategie in diesem
  Feature.
- Keine automatische Bereinigung außer beim ausdrücklich ausgeführten
  `npm run reset-bot`.

## Offene Fragen

Keine fachlichen Fragen. Schwellenwerte und Fenstergrößen werden im Design
festgelegt und mit synthetischen Runs getestet.
