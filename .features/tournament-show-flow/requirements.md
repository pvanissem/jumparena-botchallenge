# Requirements: Tournament Show Flow

## Kontext

Bezug: `docs/09-bot-artefakt-und-turnier.md` (Turniermodus und
Multi-Racer-Architektur), `.features/tournament-runner/` (bestehende
Turnierausführung), `.features/tournament-stage-levels/` (Level je Runde),
`.features/present-racer-tile-overlay/` (Racer-Feedback in `/present`).

Der bestehende Turniermodus ist funktional, wirkt in `/admin` und `/present`
aber wie eine technische Verwaltungsoberfläche statt wie ein Spiel und ein
Live-Event. Matches müssen einzeln in `/admin` gestartet werden. Der aktuelle
`BracketView` ist eine verschachtelte Liste ohne visuelle Verbindungen. Die
Phasen zwischen Matches haben keine gemeinsame Dramaturgie, und wichtige
Live-Daten sind auf dem Präsentationsbildschirm nicht stark genug gewichtet.

Dieses Feature macht aus dem bestehenden Turnier einen automatisch
fortschreitenden, serverseitig orchestrierten Show-Ablauf. `/admin` wird zum
Control Room; `/present` wird zur responsiven Event-Bühne im Stil **„Pixel
Arena Broadcast“**. Die eigentliche Phaser-Simulation bleibt ausschließlich
in `/present`.

## User Stories

### US-1: Turnier nach einmaligem Start automatisch durchführen

Als Standbetreiber möchte ich das Turnier einmal starten und danach
automatisch ablaufen lassen, damit ich moderieren und das Publikum betreuen
kann, statt jedes Match manuell anzustoßen.

Akzeptanzkriterien:

- WHEN der Betreiber ein aufgestelltes Turnier in `/admin` startet SHALL DAS
  SYSTEM den automatischen Show-Ablauf mit dem ersten spielbaren Match
  beginnen.
- WHEN ein Match ansteht SHALL DAS SYSTEM nacheinander die Phasen
  `matchup-intro`, `countdown`, `match-running`, `match-result` und
  `bracket-update` durchlaufen.
- WHEN die Phase `matchup-intro` beginnt SHALL DAS SYSTEM sie standardmäßig
  **5 Sekunden** anzeigen.
- WHEN der Countdown beginnt SHALL DAS SYSTEM sichtbar von **3** bis **1**
  zählen und anschließend das Match starten.
- WHEN ein Match beendet wurde SHALL DAS SYSTEM die Ergebnisphase
  standardmäßig **6 Sekunden** anzeigen.
- WHEN die Ergebnisphase beendet ist SHALL DAS SYSTEM den aktualisierten
  Turnierzwischenstand mit Bracket standardmäßig **10 Sekunden** anzeigen.
- WHEN die Bracket-Phase endet UND weitere spielbare Matches existieren SHALL
  DAS SYSTEM automatisch das nächste ausstehende Match in stabiler
  Bracket-Reihenfolge auswählen und dessen Intro starten.
- WHEN der Sieger eines Matches feststeht SHALL DAS SYSTEM ihn entsprechend
  der bestehenden Single-Elimination-Regeln automatisch in die nächste Runde
  übernehmen.
- WHEN nach einem Match genau ein Turniersieger feststeht SHALL DAS SYSTEM den
  automatischen Match-Loop beenden und den Champion-Screen anzeigen.
- WHEN ein zeitgesteuerter Phasenwechsel berechnet wird SHALL DAS SYSTEM eine
  serverseitige absolute Deadline verwenden, damit `/admin` und `/present`
  dieselbe Restzeit und Phase anzeigen.

### US-2: Den Show-Ablauf in `/admin` sicher steuern

Als Standbetreiber möchte ich den automatischen Ablauf überblicken und bei
Bedarf eingreifen können, damit technische oder organisatorische Situationen
am Stand nicht außer Kontrolle geraten.

Akzeptanzkriterien:

- WHEN ein Turnier läuft SHALL DAS SYSTEM in `/admin` die aktuelle Show-Phase,
  das aktuelle beziehungsweise nächste Match und die verbleibende Phasenzeit
  anzeigen.
- WHEN der Betreiber den Show-Ablauf pausiert SHALL DAS SYSTEM zeitgesteuerte
  Phasenwechsel anhalten und den pausierten Zustand an alle verbundenen
  Clients verteilen.
- WHEN der Betreiber einen pausierten Show-Ablauf fortsetzt SHALL DAS SYSTEM
  ihn mit der zum Pausenzeitpunkt verbleibenden Phasenzeit fortführen.
- WHEN der Betreiber während `matchup-intro`, `countdown`, `match-result` oder
  `bracket-update` „Sofort weiter“ auslöst SHALL DAS SYSTEM unmittelbar in die
  nächste gültige Show-Phase wechseln.
- WHEN ein Match aktiv simuliert wird SHALL DAS SYSTEM „Sofort weiter“ nicht
  als künstliches Match-Ergebnis interpretieren.
- WHEN der Betreiber das Turnier abbricht oder zurücksetzt SHALL DAS SYSTEM
  aktive Show-Timer beenden, den bestehenden Turnierzustand gemäß der
  Reset-Regeln verwerfen und die Bot-Registry unverändert lassen.

### US-3: Verbindungsabbrüche und Reloads showtauglich behandeln

Als Standbetreiber möchte ich, dass ein Browser-Reload oder ein kurzzeitiger
Verbindungsabbruch den Turnierablauf nicht unbemerkt verfälscht.

Akzeptanzkriterien:

- WHEN sich `/admin` oder `/present` während eines laufenden Turniers neu
  verbindet SHALL DAS SYSTEM den vollständigen Turnier- und Show-Zustand als
  Snapshot übermitteln.
- WHEN ein Client einen Show-Snapshot erhält SHALL DAS SYSTEM anhand der
  serverseitigen Deadline die korrekte aktuelle Restzeit ableiten.
- WHEN kein ausführungsbereites `/present` verbunden ist und ein Match starten
  müsste SHALL DAS SYSTEM vor dem Matchstart warten statt das Match blind als
  laufend zu markieren.
- WHEN der Show-Ablauf wegen eines fehlenden `/present` wartet SHALL DAS SYSTEM
  den Grund in `/admin` verständlich anzeigen.
- WHEN wieder ein ausführungsbereites `/present` verfügbar ist SHALL DAS
  SYSTEM den automatischen Ablauf kontrolliert fortsetzen.
- WHEN während eines laufenden Matches kein gültiges Ergebnis eintrifft SHALL
  DAS SYSTEM weder einen Gewinner erfinden noch automatisch zum nächsten Match
  fortschreiten.

### US-4: Einen echten visuellen Turnierbaum verwenden

Als Betreiber und Zuschauer möchte ich Runden, Begegnungen und Siegerpfade als
echten Turnierbaum sehen, damit der Turnierverlauf auf einen Blick verständlich
ist.

Akzeptanzkriterien:

- WHEN ein Turnier aufgestellt ist SHALL DAS SYSTEM in `/admin` und
  `/present` Runden und Matches als visuell verbundene Bracket-Knoten statt als
  einfache Textliste darstellen.
- WHEN ein Match abgeschlossen ist SHALL DAS SYSTEM den Sieger im
  Match-Knoten hervorheben und ausgeschiedene Teilnehmer visuell zurücknehmen.
- WHEN ein Teilnehmer in die nächste Runde aufrückt SHALL DAS SYSTEM seinen
  Pfad zwischen den betroffenen Match-Knoten hervorheben.
- WHEN ein Match als Nächstes ansteht oder gerade läuft SHALL DAS SYSTEM dessen
  Knoten eindeutig gegenüber anderen ausstehenden Matches markieren.
- WHEN ein Bracket-Knoten angezeigt wird SHALL DAS SYSTEM Matchstatus,
  Teilnehmernamen und den feststehenden Gewinner erkennen lassen.
- WHEN eine Runde angezeigt wird SHALL DAS SYSTEM Rundennummer, Rundenzustand
  und das gemäß `stageLevelIds` geltende Level anzeigen.
- WHEN `/admin` den Turnierbaum anzeigt SHALL DAS SYSTEM die vollständige
  steuerbare Übersicht mit Zugriff auf relevante Match- und Statusdetails
  bereitstellen.
- WHEN `/present` den Turnierbaum anzeigt SHALL DAS SYSTEM automatisch den
  aktuell relevanten Pfad fokussieren und für Betrachtung aus mehreren Metern
  Entfernung priorisieren.
- WHEN der Turnierbaum mehr Inhalt besitzt als gleichzeitig lesbar dargestellt
  werden kann SHALL DAS SYSTEM in `/present` fokussieren beziehungsweise
  verdichten und in `/admin` eine navigierbare Gesamtansicht anbieten.

### US-5: Jedes Match als Begegnung inszenieren

Als Zuschauer möchte ich vor dem Start sehen, welche Bots gegeneinander
antreten, damit ich die Kontrahenten kenne und dem Match emotional folgen kann.

Akzeptanzkriterien:

- WHEN die Matchup-Intro-Phase läuft SHALL DAS SYSTEM in `/present` alle zwei
  bis vier Matchteilnehmer mit Botname, Autor und Botfarbe anzeigen.
- WHEN die Matchup-Intro-Phase läuft SHALL DAS SYSTEM zusätzlich Runde,
  Matchnummer und Levelname anzeigen.
- WHEN der Countdown läuft SHALL DAS SYSTEM die Teilnehmer sichtbar lassen und
  die Countdown-Zahl als dominantes Bühnenelement darstellen.
- WHEN das Layout zwei, drei oder vier Teilnehmer enthält SHALL DAS SYSTEM die
  Teilnehmer gleichwertig und ohne abgeschnittene Pflichtinformationen
  darstellen.

### US-6: Live-Punkte und Rennstatus auf `/present` zeigen

Als Zuschauer möchte ich während eines Matches den aktuellen Wettkampfstand
sehen, damit Fortschritt, Führungswechsel und mögliche Aufholjagden verständlich
werden.

Akzeptanzkriterien:

- WHEN ein Match läuft SHALL DAS SYSTEM auf `/present` für jeden Teilnehmer
  mindestens aktuellen Rang, Botname, Live-Score, Fortschritt, verbleibende
  Leben, Restzeit und Laufstatus anzeigen.
- WHEN sich die Live-Rangfolge ändert SHALL DAS SYSTEM die neue Reihenfolge
  zeitnah darstellen und den Führenden klar, aber nicht dauerhaft ablenkend
  hervorheben.
- WHEN ein Teilnehmer das Ziel erreicht, ausscheidet oder deaktiviert wird
  SHALL DAS SYSTEM diesen Status sowohl in seiner Racer-Kachel als auch in der
  Live-Anzeige erkennbar machen.
- WHEN Live-Daten dargestellt werden SHALL DAS SYSTEM dieselbe bestehende
  Scoring-Logik wie `/dev` und die Match-Auswertung verwenden, statt eine
  abweichende Anzeigeformel einzuführen.
- WHEN Live-Daten übertragen werden SHALL DAS SYSTEM die bestehende gedrosselte
  Übertragung nutzen und keine Updates pro Render-Frame senden.

### US-7: Zwischen jedem Match Orientierung und Spannung schaffen

Als Zuschauer möchte ich zwischen Matches Ergebnis, Turnierstand und nächste
Begegnung sehen, damit keine Leerlaufzeit entsteht und ich weiß, wie es
weitergeht.

Akzeptanzkriterien:

- WHEN ein Match endet SHALL DAS SYSTEM auf `/present` zuerst einen
  Sieger-Reveal mit Rangfolge und kompakter Score-Aufschlüsselung anzeigen.
- WHEN anschließend die Bracket-Phase läuft SHALL DAS SYSTEM den neuen
  Siegerpfad visuell hervorheben und den aktualisierten Turnierstand zeigen.
- WHEN die Bracket-Phase läuft SHALL DAS SYSTEM mindestens aktuelle Runde,
  absolvierte Matches, noch im Turnier befindliche Bots und das nächste Match
  anzeigen.
- WHEN das nächste Match bereits feststeht SHALL DAS SYSTEM dessen Teilnehmer
  in der Bracket-Phase ankündigen.
- WHEN `/admin` zwischen Matches angezeigt wird SHALL DAS SYSTEM neben dem
  vollständigen Bracket den letzten Zwischenstand und die nächste Begegnung
  sichtbar halten.

### US-8: `/present` als responsive Pixel-Arena-Broadcast gestalten

Als Zuschauer möchte ich eine zusammenhängende Spiel- und Event-Inszenierung
sehen, damit sich Coin Quest Arena wie ein Wettbewerb und nicht wie eine
Verwaltungsanwendung anfühlt.

Akzeptanzkriterien:

- WHEN `/present` eine Turnierphase anzeigt SHALL DAS SYSTEM die freigegebene
  Stilrichtung „Pixel Arena Broadcast“ mit hoher Kontrastwirkung, klarer
  Pixel-Ästhetik und konsistenter visueller Hierarchie verwenden.
- WHEN `/present` angezeigt wird SHALL DAS SYSTEM eine phasenübergreifende
  Event-Chrome mit mindestens Turniername, Runde, Match und relevantem
  Live-Status bereitstellen.
- WHEN noch kein Turnier läuft SHALL DAS SYSTEM die vorhandenen Bots als
  publikumswirksamen Roster-/Attract-Screen statt als rohe Verwaltungsliste
  präsentieren.
- WHEN der Champion feststeht SHALL DAS SYSTEM einen bildschirmfüllenden
  Champion-Moment mit Botname und Autor sowie einer angemessenen
  Siegesinszenierung anzeigen.
- WHEN Intro, Countdown, Sieger oder Champion gezeigt werden SHALL DAS SYSTEM
  kurze, global regelbare Audio-Cues verwenden und dabei die bestehenden
  Mute-/Lautstärkeeinstellungen respektieren.
- WHEN Animationen eingesetzt werden SHALL DAS SYSTEM sie zur Orientierung
  oder Dramaturgie nutzen und dauerhaft hektische beziehungsweise die
  Spielansicht verdeckende Bewegung vermeiden.
- WHEN das Betriebssystem reduzierte Bewegung anfordert SHALL DAS SYSTEM
  nicht notwendige Animationen reduzieren oder deaktivieren.
- WHEN `/present` auf unterschiedlichen Viewportgrößen angezeigt wird SHALL
  DAS SYSTEM Pflichtinformationen ohne Überlagerung oder Abschneiden
  darstellen; die Komposition ist für 16:9-Großbild optimiert und passt sich
  responsiv an kleinere Ansichten an.

### US-9: `/admin` als responsiven Control Room überarbeiten

Als Standbetreiber möchte ich Turnierstand und Steuerung in einer klaren
Arbeitsoberfläche sehen, damit ich auch unter Eventdruck sicher handeln kann.

Akzeptanzkriterien:

- WHEN ein Turnier läuft SHALL DAS SYSTEM in `/admin` Show-Steuerung,
  vollständiges Bracket und Live- beziehungsweise letzten Zwischenstand in
  klar getrennten Bereichen darstellen.
- WHEN eine primäre Show-Aktion verfügbar ist SHALL DAS SYSTEM sie visuell von
  seltenen oder destruktiven Aktionen unterscheiden.
- WHEN eine Aktion das Turnier abbricht oder zurücksetzt SHALL DAS SYSTEM sie
  als destruktiv kennzeichnen und vor unbeabsichtigter Auslösung schützen.
- WHEN `/admin` auf einem kleineren Desktop-Viewport angezeigt wird SHALL DAS
  SYSTEM die Bereiche sinnvoll stapeln und alle Steueraktionen erreichbar
  halten.
- WHEN Verbindungs- oder Ausführungsprobleme auftreten SHALL DAS SYSTEM den
  betroffenen Zustand und eine mögliche Betreiberaktion in verständlicher
  Sprache anzeigen.

### US-10 (NFR): Bestehende Spiellogik bewahren und testbar erweitern

Als Entwicklerteam möchten wir den Show-Overhaul ohne parallele Turnierlogik
oder Regressionen in der Bot-Testumgebung umsetzen.

Akzeptanzkriterien:

- WHEN der Show-Ablauf implementiert wird SHALL DAS SYSTEM den Server nur für
  Orchestrierung, Zustand und Synchronisation verwenden; die Phaser-Simulation
  und Bot-Ausführung bleiben in `/present`.
- WHEN das Bracket fortgeschrieben wird SHALL DAS SYSTEM die bestehende
  `TournamentStrategy` und die vorhandenen Wertungsregeln wiederverwenden.
- WHEN gemeinsame Turnierdaten in `/admin` und `/present` dargestellt werden
  SHALL DAS SYSTEM gemeinsame, variantenfähige React-Komponenten und reine
  Selektoren verwenden, statt die Logik zu duplizieren.
- WHEN Show-Zustand oder Phasenwechsel implementiert werden SHALL DAS SYSTEM
  sie als browser- und Phaser-unabhängige Logik unit-testbar kapseln.
- WHEN dieses Feature umgesetzt wird SHALL DAS SYSTEM strikt testgetrieben
  nach Rot-Grün-Refactor entwickelt werden.
- WHEN dieses Feature umgesetzt wird SHALL DAS SYSTEM `/dev` funktional und
  visuell unverändert lassen.

## Nicht-Ziele

- Keine Änderung an `/dev`; Bracket, Matchup-Intro und Turnierablauf gehören
  ausschließlich zu `/admin` und `/present`.
- Keine Änderung an Scoring-Formel, Bot-API, Gruppengrößen, Stage-Level-Regeln,
  Freilosen oder Single-Elimination-Logik.
- Kein neuer Turniermodus.
- Keine Bot-zu-Bot-Kollision und keine serverseitige Spielsimulation.
- Kein Replay-System, keine Zuschauerabstimmung und kein Sprecher-/Streaming-
  System.
- Kein globales Leaderboard über ausgeschiedene Bots; der Zwischenstand
  beschreibt den Single-Elimination-Turnierstand.
- Keine frei konfigurierbaren Phasendauern in diesem Feature; die festgelegten
  Standardzeiten sind Bestandteil des Show-Designs.
- Kein künstliches Überspringen eines laufenden Matches mit automatisch
  erfundenem Sieger.

## Entschiedene UX-Parameter

- Stilrichtung: **Pixel Arena Broadcast**.
- Bracket: **adaptiver echter Turnierbaum** mit Verbindungslinien und
  Siegerpfaden; vollständiger in `/admin`, fokussierter in `/present`.
- Ablauf: einmaliger Start, danach vollständig automatisch mit optionaler
  Pause und „Sofort weiter“ für zeitgesteuerte Phasen.
- Timing: Intro 5 Sekunden, Countdown 3 Sekunden, Ergebnis 6 Sekunden,
  Bracket-Zwischenstand 10 Sekunden.
- Zielbildschirm: 16:9-Großbild als Primärkomposition, insgesamt responsive.

## Offene Fragen

Keine fachlichen Blocker für die Design-Phase.
