# Requirements: Selber spielen mit Gamepad (`play-mode`)

## Kontext

Bezug: `docs/01-konzept.md` (Ablauf am Stand), `docs/05-scoring-und-heats.md`
(Scoring-Formel, Leben, Zeitlimit), `docs/06-level-design.md` (Level-Elemente),
`.features/level-one-arena/` (Arena, `RacerController`-Abstraktion),
`.features/tournament-lives/` (`startingLives`), `.features/tournament-runner/`
(mehrere `RaceScene`-Instanzen mit eigenem Viewport in einer Phaser-Instanz).

Am Messestand hängen zwei USB-Gamepads (SNES-Layout) am Rechner. Neben dem
Bot-Wettbewerb soll es einen **Modus zum Selberspielen** geben, erreichbar unter
`/play`: zwei Spielbereiche nebeneinander, je ein Gamepad pro Bereich, mit
Arcade-typischem Drumherum (Namenseingabe, Leben, Score, Highscore-Liste).

Das ist ein reiner Publikumsmodus – er hat nichts mit Bots, dem Turnier oder dem
Server zu tun und läuft vollständig clientseitig.

Vorhandene, wiederverwendbare Bausteine:

- `client/src/game/control/RacerController.ts` – Steuerungs-Abstraktion (DIP);
  `KeyboardController` liefert bereits ein mehrachsiges Eingabesignal
  (`{dir, jump, sprint}`) für den menschlichen Spielpfad in `RaceScene`.
- `client/src/match/gridViewports.ts` + `RaceSceneInitData.viewport` – mehrere
  Spielbereiche nebeneinander im selben Canvas.
- `client/src/match/MatchBootScene.ts` + `assetsPreloaded` – Assets einmal laden.
- `client/src/game/scoring.ts` (`computeScore`) und
  `client/src/game/rules/racerState.ts` (`startingLives`, `RUN_TIME_LIMIT_MS`).

Neu zu bauen sind: Gamepad-Eingabe inkl. Kalibrierung, eine Kampagnen-Logik über
mehrere Level, Namenseingabe und Highscore-Persistenz. Persistenz gibt es im
Projekt bisher nirgends (Server ist bewusst zustandslos/in-memory).

**Grundprinzip des Modus: Die beiden Stationen sind vollständig unabhängig.**
Sie teilen sich nur Bildschirm und Highscore-Liste – nicht Level, Leben, Score,
Zeitpunkt oder Spielzustand. Eine Person kann allein spielen, jemand anderes
kann jederzeit auf der anderen Seite ein neues Spiel starten, während nebenan
noch gespielt wird.

## Begriffe

- **Station**: eine Bildschirmhälfte mit genau einem zugeordneten Gamepad und
  eigenem, unabhängigem Spielzustand (links / rechts).
- **Run**: ein Spieldurchlauf einer Station – von der Namenseingabe bis „Game
  Over", über bis zu sechs Level hinweg.
- **Mapping**: Zuordnung der acht logischen Eingaben (LINKS, RECHTS, HOCH,
  RUNTER, SPRUNG, SPRINT, BESTÄTIGEN, ZURÜCK) zu konkreten Buttons/Achsen eines
  physischen Gamepads.

## User Stories

### US-1: Controller beim ersten Öffnen kalibrieren

Als Standbetreuer möchte ich die angeschlossenen Gamepads einmalig kalibrieren,
damit der Modus unabhängig davon funktioniert, welche Buttons/Achsen der jeweils
angesteckte USB-Adapter meldet.

Akzeptanzkriterien:

- WHEN `/play` geöffnet wird und für mindestens ein verbundenes Gamepad kein
  gespeichertes Mapping vorliegt SHALL DAS SYSTEM vor dem Spielbetrieb einen
  Kalibrierungs-Assistenten anzeigen.
- WHEN `/play` geöffnet wird und für alle verbundenen Gamepads ein gespeichertes
  Mapping vorliegt SHALL DAS SYSTEM den Assistenten überspringen und direkt den
  Startbildschirm zeigen.
- WHEN noch kein Gamepad erkannt wurde SHALL DAS SYSTEM einen Hinweis anzeigen,
  dass am Gamepad eine beliebige Taste gedrückt werden muss (Browser geben
  Gamepads erst nach der ersten Eingabe frei).
- WHEN der Assistent startet SHALL DAS SYSTEM zuerst der linken und danach der
  rechten Station je ein Gamepad zuordnen, indem die jeweils aufgeforderte
  Person eine beliebige Taste drückt.
- WHEN für die zweite Station kein Gamepad zugeordnet wird SHALL DAS SYSTEM den
  Assistenten dennoch abschließen können (Betrieb mit nur einer Station).
- WHEN ein Kalibrierungsschritt aktiv ist SHALL DAS SYSTEM die erwartete
  logische Eingabe benennen (LINKS, RECHTS, HOCH, RUNTER, SPRUNG, SPRINT,
  BESTÄTIGEN, ZURÜCK) und auf die nächste Eingabe des zugehörigen Gamepads
  warten.
- WHEN sich während eines Kalibrierungsschritts ein Button signifikant gegenüber
  seinem Ausgangswert ändert SHALL DAS SYSTEM diesen Button als Belegung der
  aktuellen logischen Eingabe übernehmen.
- WHEN sich während eines Kalibrierungsschritts eine Achse signifikant gegenüber
  ihrem Ausgangswert ändert SHALL DAS SYSTEM diese Achse samt Richtung als
  Belegung der aktuellen logischen Eingabe übernehmen (D-Pads melden sich je
  nach Adapter als Buttons **oder** als Achsen).
- WHEN eine Eingabe erfasst wurde SHALL DAS SYSTEM erst zum nächsten Schritt
  weitergehen, nachdem die Taste wieder losgelassen wurde.
- WHEN eine Eingabe erfasst wird, die in diesem Mapping bereits belegt ist SHALL
  DAS SYSTEM sie ablehnen, einen Hinweis anzeigen und im selben Schritt bleiben.
- WHEN alle Schritte eines Gamepads erfasst sind SHALL DAS SYSTEM einen
  Testbildschirm mit Live-Anzeige aller acht Eingaben anzeigen und Bestätigen
  oder Wiederholen anbieten.
- WHEN ein Mapping bestätigt wurde SHALL DAS SYSTEM es dauerhaft speichern, so
  dass es nach Neuladen der Seite ohne erneute Kalibrierung verfügbar ist.
- WHEN ein Mapping gespeichert wird SHALL DAS SYSTEM es der Hardware-Kennung des
  Gamepads zuordnen, so dass ein baugleiches zweites Gamepad dasselbe Mapping
  ohne erneute Kalibrierung verwendet.
- WHEN der Nutzer im laufenden Betrieb die Kalibrierung erneut aufruft SHALL DAS
  SYSTEM den Assistenten erneut anbieten und das bisherige Mapping erst nach
  Bestätigung ersetzen.
- WHEN ein Gamepad das Standard-Mapping des Browsers meldet SHALL DAS SYSTEM
  eine sinnvolle Vorbelegung anbieten, so dass der Assistent übersprungen werden
  kann.

### US-2: Spiel starten und Namen eingeben

Als Besucher möchte ich mein Spiel per Gamepad starten und meinen Namen
eintragen, damit ich in der Highscore-Liste wiederzufinden bin.

Akzeptanzkriterien:

- WHEN eine Station keinen laufenden Run hat SHALL DAS SYSTEM auf ihrer Hälfte
  eine Startaufforderung anzeigen („Taste drücken").
- WHEN der Spieler einer wartenden Station BESTÄTIGEN drückt SHALL DAS SYSTEM
  für diese Station die Namenseingabe öffnen.
- WHEN die Namenseingabe geöffnet wird SHALL DAS SYSTEM acht Zeichenplätze mit
  einem Cursor auf dem ersten Platz anzeigen.
- WHEN der Spieler HOCH oder RUNTER drückt SHALL DAS SYSTEM das Zeichen an der
  Cursorposition im Zeichenvorrat vor- bzw. zurückschalten (umlaufend).
- WHEN der Spieler LINKS oder RECHTS drückt SHALL DAS SYSTEM den Cursor um einen
  Platz bewegen, ohne den Namen zu verändern.
- WHEN der Spieler BESTÄTIGEN drückt SHALL DAS SYSTEM den Namen übernehmen und
  den Run starten.
- WHEN der eingegebene Name nur aus Leerzeichen besteht SHALL DAS SYSTEM
  stattdessen einen neutralen Standardnamen verwenden.
- WHEN der Spieler ZURÜCK drückt SHALL DAS SYSTEM zur Startaufforderung
  zurückkehren, ohne einen Run zu starten.
- WHEN eine Eingabetaste gehalten wird SHALL DAS SYSTEM sie nur einmal pro
  Tastendruck werten (kein ungewolltes Durchrattern der Zeichen).

### US-3: Level per Gamepad spielen

Als Besucher möchte ich die Spielfigur direkt mit dem Gamepad steuern, damit ich
das Spiel ohne Programmierung selbst ausprobieren kann.

Akzeptanzkriterien:

- WHEN ein Run läuft SHALL DAS SYSTEM die Spielfigur der Station ausschließlich
  über das ihr zugeordnete Gamepad steuern.
- WHEN der Spieler LINKS oder RECHTS hält SHALL DAS SYSTEM die Figur in die
  entsprechende Richtung bewegen.
- WHEN der Spieler SPRINT zusammen mit einer Richtung hält SHALL DAS SYSTEM
  dieselbe Sprint-Mechanik anwenden wie bei der Tastatursteuerung
  (Sprint-Rampe).
- WHEN der Spieler SPRUNG drückt und hält SHALL DAS SYSTEM dieselbe Mechanik für
  variable Sprunghöhe anwenden wie bei der Tastatursteuerung.
- WHEN der Spieler gleichzeitig Richtung, Sprint und Sprung betätigt SHALL DAS
  SYSTEM alle Eingaben im selben Frame anwenden (Multi-Input).
- WHEN ein Run läuft SHALL DAS SYSTEM dieselben Spielregeln anwenden wie in den
  bestehenden Modi (Hazards, Checkpoints, Münzen/Früchte, Sturz ins Leere,
  Zielerreichung, Zeitlimit).
- WHEN ein Gamepad während eines laufenden Runs die Verbindung verliert SHALL
  DAS SYSTEM den Run dieser Station anhalten und einen Hinweis anzeigen, ohne
  die andere Station zu beeinträchtigen.

### US-4: Kampagne über alle Level mit gemeinsamen Leben und Score

Als Besucher möchte ich mit einem festen Vorrat an Leben durch alle Level
spielen und dabei Punkte sammeln, damit ein Spieldurchlauf ein zusammenhängendes
Erlebnis mit klarem Endergebnis ist.

Akzeptanzkriterien:

- WHEN ein Run startet SHALL DAS SYSTEM dem Spieler fünf Leben für den gesamten
  Run geben.
- WHEN ein Run startet SHALL DAS SYSTEM mit dem ersten Level beginnen und die
  Level in der Reihenfolge der Level-Registry durchlaufen (die sechs regulären
  Level; das Bot-Toolkit-Testlevel gehört nicht dazu).
- WHEN ein Level beginnt SHALL DAS SYSTEM die verbleibenden Leben aus dem
  vorherigen Level übernehmen (keine Auffrischung zwischen Leveln).
- WHEN der Spieler in einem Level ein Leben verliert SHALL DAS SYSTEM ihn wie
  gewohnt am letzten Checkpoint dieses Levels neu starten, solange noch Leben
  übrig sind.
- WHEN der Spieler das Ziel eines Levels erreicht SHALL DAS SYSTEM die Punkte
  dieses Levels nach der bestehenden Scoring-Formel berechnen und auf den
  Gesamtscore des Runs addieren.
- WHEN der Spieler das Ziel eines Levels erreicht und noch weitere Level folgen
  SHALL DAS SYSTEM zum nächsten Level wechseln.
- WHEN das Zeitlimit eines Levels abläuft SHALL DAS SYSTEM dieses Level als
  nicht geschafft werten (bestehender DNF-Malus), die verbleibenden Leben
  unverändert lassen und zum nächsten Level wechseln.
- WHEN der Spieler sein letztes Leben verliert SHALL DAS SYSTEM den Run sofort
  beenden und das Endergebnis anzeigen.
- WHEN der Spieler das letzte Level abschließt SHALL DAS SYSTEM den Run beenden
  und das Endergebnis anzeigen.
- WHEN ein Level endet SHALL DAS SYSTEM vor dem nächsten Level eine
  Zwischenanzeige mit dem Ergebnis dieses Levels zeigen (Punkte, verbleibende
  Leben).
- WHEN ein Run beendet ist SHALL DAS SYSTEM als Gesamtscore die Summe aller
  Level-Punkte ausweisen.

### US-5: Zwei unabhängige Stationen nebeneinander

Als zwei Besucher möchten wir gleichzeitig und unabhängig voneinander spielen,
damit niemand auf den anderen warten muss.

Akzeptanzkriterien:

- WHEN `/play` geöffnet ist SHALL DAS SYSTEM zwei gleich große Spielbereiche
  nebeneinander anzeigen.
- WHEN eine Station einen Run startet, beendet oder das Level wechselt SHALL DAS
  SYSTEM den Zustand der anderen Station (Level, Leben, Score, Position, Zeit)
  unverändert lassen.
- WHEN beide Stationen gleichzeitig spielen SHALL DAS SYSTEM beiden
  unterschiedliche Level erlauben.
- WHEN eine Station keinen Run hat SHALL DAS SYSTEM auf ihr jederzeit einen
  neuen Run starten können, auch während die andere Station mitten im Spiel ist.
- WHEN nur ein Gamepad zugeordnet ist SHALL DAS SYSTEM die andere Station im
  Wartezustand anzeigen, ohne den Spielbetrieb zu behindern.
- WHEN beide Stationen gleichzeitig spielen SHALL DAS SYSTEM die
  Hintergrundmusik nur einmal wiedergeben, während Soundeffekte weiterhin für
  beide Stationen hörbar sind.
- WHEN der Spieler einer Station ZURÜCK zum Abbrechen betätigt SHALL DAS SYSTEM
  nur deren Run beenden und diese Station in den Wartezustand versetzen.

### US-6: Highscore-Liste

Als Besucher möchte ich mein Ergebnis in einer Bestenliste wiederfinden, damit
der Wettbewerb am Stand greifbar wird.

Akzeptanzkriterien:

- WHEN `/play` geöffnet ist SHALL DAS SYSTEM eine Highscore-Liste mit den zehn
  besten Ergebnissen anzeigen, absteigend nach Gesamtscore sortiert.
- WHEN ein Run beendet ist SHALL DAS SYSTEM Name, Gesamtscore und Anzahl
  geschaffter Level in die Highscore-Liste aufnehmen.
- WHEN ein Ergebnis in die Top 10 kommt SHALL DAS SYSTEM dem Spieler seine
  Platzierung anzeigen.
- WHEN ein Ergebnis nicht in die Top 10 kommt SHALL DAS SYSTEM den Gesamtscore
  trotzdem anzeigen und die Liste unverändert lassen.
- WHEN ein neuer Eintrag in die Liste aufgenommen wurde SHALL DAS SYSTEM ihn in
  der Anzeige hervorheben.
- WHEN zwei Einträge denselben Score haben SHALL DAS SYSTEM den älteren Eintrag
  weiter oben einsortieren.
- WHEN die Seite neu geladen wird SHALL DAS SYSTEM die zuvor gespeicherte
  Highscore-Liste weiterhin anzeigen.
- WHEN noch kein Ergebnis gespeichert ist SHALL DAS SYSTEM eine leere Liste mit
  entsprechendem Hinweis anzeigen.

### US-7: Spielerische Aufmachung am Stand

Als Standbetreuer möchte ich, dass `/play` auch für Zuschauer attraktiv aussieht
und ohne Erklärung bedienbar ist, damit der Modus am Messestand funktioniert.

Akzeptanzkriterien:

- WHEN ein Run läuft SHALL DAS SYSTEM je Station dauerhaft Spielername,
  verbleibende Leben, aktuelles Level (Nummer und Gesamtzahl), Punkte des
  laufenden Levels und Gesamtscore anzeigen.
- WHEN ein Run läuft SHALL DAS SYSTEM je Station die verbleibende Zeit des
  aktuellen Levels anzeigen.
- WHEN ein Level beginnt SHALL DAS SYSTEM eine kurze Einblendung mit Levelname
  und -nummer anzeigen, bevor die Steuerung freigegeben wird.
- WHEN eine Station im Wartezustand ist SHALL DAS SYSTEM dort eine gut sichtbare
  Aufforderung zum Mitspielen anzeigen.
- WHEN ein Run beendet ist SHALL DAS SYSTEM ein Endergebnis mit Name,
  Gesamtscore, geschafften Leveln und ggf. Platzierung anzeigen sowie erklären,
  wie ein neues Spiel gestartet wird.
- WHEN während des Spiels die Steuerungsbelegung unklar ist SHALL DAS SYSTEM
  eine kompakte Tastenlegende der Station sichtbar halten.

### US-8 (NFR): Bestehende Modi bleiben unangetastet

Als Entwicklerteam möchten wir, dass `/dev`, `/present` und `/admin` durch
diesen Modus nicht beeinflusst werden.

Akzeptanzkriterien:

- WHEN dieses Feature umgesetzt wird SHALL DAS SYSTEM die Bot-API
  (`@arena/bot-contract`), die Scoring-Formel und die Spielregeln inhaltlich
  unverändert lassen.
- WHEN dieses Feature umgesetzt wird SHALL DAS SYSTEM den Tastatur- und den
  Bot-Steuerpfad der `RaceScene` in ihrem bisherigen Verhalten belassen.
- WHEN dieses Feature umgesetzt wird SHALL DAS SYSTEM ohne laufenden Server
  nutzbar sein (keine WebSocket- oder HTTP-Abhängigkeit von `/play`).
- WHEN dieses Feature umgesetzt wird SHALL DAS SYSTEM strikt testgetrieben
  entwickelt werden (siehe `AGENTS.md`), wobei Eingabe-, Kalibrierungs-,
  Kampagnen-, Namenseingabe- und Highscore-Logik als reine, ohne Browser-
  Gamepad-Hardware testbare Module vorliegen.

## Nicht-Ziele

- Keine serverseitige Speicherung oder Synchronisation der Highscores (bewusst
  nur lokal im Browser des Standrechners).
- Keine Bots, keine Turnierlogik und keine Änderungen an `/present` / `/admin`.
- Kein Mehrspieler-Wettkampf im engeren Sinne: keine gemeinsamen Level, kein
  direktes Gegeneinander, keine geteilten Leben oder Scores zwischen den
  Stationen.
- Mehr als zwei Stationen sind nicht vorgesehen.
- Keine Gamepad-Unterstützung in `/dev` oder `/present`.
- Keine neuen Level und keine Level-Auswahl durch den Spieler (feste
  Reihenfolge).
- Keine Änderung des Zeitlimits (`RUN_TIME_LIMIT_MS = 90 s`).
- Keine Bearbeitung/Löschung einzelner Highscore-Einträge über die Oberfläche.
- Keine Analogstick-Feinsteuerung (SNES-Pads sind digital; Achsen werden nur als
  Richtungsschalter ausgewertet).

## Offene Fragen

- **Zeichenvorrat der Namenseingabe**: Annahme `A–Z`, `0–9` und Leerzeichen.
  Umlaute/Sonderzeichen bleiben außen vor.
- **Umgang mit anstößigen Namen**: aktuell keine Filterung vorgesehen; bei
  Bedarf löscht der Standbetreuer die Liste (Annahme: eine Zurücksetz-Funktion
  wird im Design vorgesehen, aber nicht prominent platziert).
- **Verhalten bei einem dritten angeschlossenen Gamepad**: Annahme: es wird
  ignoriert, solange beide Stationen belegt sind.
- **Dauer der Level-Einblendung/Countdown** vor Spielbeginn: Annahme ca. 3 s,
  im Design konkretisiert.
