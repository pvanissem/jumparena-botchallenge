# Requirements: Turnier & Match-Ausführung (`tournament-runner`)

## Kontext

Bezug: `docs/09-bot-artefakt-und-turnier.md` (Abschnitt "Turniermodus"),
`docs/05-scoring-und-heats.md` (Scoring-Formel, gilt pro Match),
`.features/bot-collection-point/` (liefert die Bot-Registry als Teilnehmerpool).

Nachdem Bot-Artefakte über `/admin` gesammelt sind, fehlt der eigentliche
Wettbewerb: Aus den gesammelten Bots muss ein Turnier konfiguriert, gestartet
und auf `/present` sichtbar ausgespielt werden. `/admin` ist dabei die
Steuerzentrale (Fernbedienung), `/present` der große Screen am Stand.

Die Simulation läuft **ausschließlich in `/present`** (clientseitig, Phaser +
Worker-Sandbox pro Bot). Der Hub-Server bleibt Relay und Zustandsspeicher; er
führt weiterhin keine Spiellogik aus.

Heute simuliert `RaceScene` genau **einen** Racer. Für Matches mit mehreren
Bots gleichzeitig wird eine eigene Szene gebaut; `/dev` und `RaceScene` bleiben
unangetastet (Entscheidung aus dem Brainstorming: geringeres Risiko kurz vor
dem Event, klar getrennte Anwendungsfälle).

## User Stories

### US-1: Turnier in `/admin` konfigurieren

Als Standbetreuer möchte ich aus den gesammelten Bots ein Turnier
zusammenstellen, damit ich den Wettbewerb an den aktuellen Stand am
Messestand anpassen kann.

Akzeptanzkriterien:
- WHEN der Nutzer in `/admin` ein Turnier konfiguriert SHALL DAS SYSTEM ihm
  erlauben, aus der Bot-Registry eine Teilmenge der Bots als Teilnehmer
  auszuwählen (Default: alle).
- WHEN der Nutzer ein Turnier konfiguriert SHALL DAS SYSTEM ihm erlauben, das
  Level auszuwählen, in dem die Matches stattfinden (aus `LEVEL_REGISTRY`).
- WHEN der Nutzer ein Turnier konfiguriert SHALL DAS SYSTEM ihm erlauben, den
  Turniermodus zu wählen; für dieses Feature ist ausschließlich
  "Single-Elimination" verfügbar.
- WHEN der Nutzer das Turnier startet UND weniger als zwei Teilnehmer
  ausgewählt sind SHALL DAS SYSTEM den Start ablehnen und einen Hinweis
  anzeigen.
- WHEN ein Turnier gestartet wird SHALL DAS SYSTEM einen Turnierbaum (Bracket)
  aus den Teilnehmern erzeugen und ihn an `/admin` und `/present` verteilen.

### US-2: Bracket-Erzeugung (Single-Elimination, max. 4 Bots pro Match)

Als Standbetreuer möchte ich, dass die Teilnehmer nachvollziehbar auf Matches
verteilt werden, damit das Turnier fair und erklärbar bleibt.

Akzeptanzkriterien:
- WHEN ein Bracket erzeugt wird SHALL DAS SYSTEM die Teilnehmer der ersten
  Runde in Gruppen von **höchstens 4 Bots** aufteilen.
- WHEN die Teilnehmerzahl nicht glatt durch 4 teilbar ist SHALL DAS SYSTEM
  kleinere Gruppen zulassen (kein Auffüllen mit Platzhalter-Bots).
- WHEN eine Gruppe nur einen einzigen Bot enthält SHALL DAS SYSTEM diesen Bot
  ohne Match direkt in die nächste Runde übernehmen (Freilos).
- WHEN ein Match beendet ist SHALL DAS SYSTEM ausschließlich den
  Erstplatzierten in die nächste Runde übernehmen.
- WHEN eine Runde abgeschlossen ist UND nur noch ein Bot übrig ist SHALL DAS
  SYSTEM das Turnier als beendet markieren und diesen Bot als Champion
  ausweisen.
- WHEN ein Bracket erzeugt wird SHALL DAS SYSTEM die Zuordnung der Teilnehmer
  zu Gruppen zufällig vornehmen (keine Bevorzugung nach Upload-Reihenfolge).

### US-3: Match auf `/present` starten und ausspielen

Als Standbetreuer möchte ich ein Match per Klick in `/admin` starten, damit
auf dem großen Screen die Simulation läuft und das Publikum zuschauen kann.

Akzeptanzkriterien:
- WHEN der Nutzer in `/admin` das nächste Match startet SHALL DAS SYSTEM
  `/present` anweisen, dieses Match mit den zugehörigen Bots und dem
  konfigurierten Level zu simulieren.
- WHEN `/present` ein Match startet SHALL DAS SYSTEM für jeden teilnehmenden
  Bot einen eigenen Racer im **selben** Level darstellen, jeweils mit eigenem
  Sprite und eigener Kameraansicht (Grid-Layout je nach Teilnehmerzahl).
- WHEN mehrere Bots gleichzeitig laufen SHALL DAS SYSTEM **keine** Kollision
  zwischen den Bots berechnen (Bots beeinflussen sich gegenseitig nicht).
- WHEN ein Bot fehlerhaften Code enthält oder nicht rechtzeitig antwortet
  SHALL DAS SYSTEM diesen Bot pausieren, das Match für die übrigen Bots aber
  fortsetzen.
- WHEN alle Bots eines Matches das Ziel erreicht haben, ausgeschieden sind
  oder das Zeitlimit abgelaufen ist SHALL DAS SYSTEM das Match beenden.

### US-4: Wertung eines Matches

Als Standbetreuer möchte ich eine nachvollziehbare Platzierung pro Match,
damit klar ist, wer weiterkommt.

Akzeptanzkriterien:
- WHEN ein Match beendet ist SHALL DAS SYSTEM für jeden Teilnehmer den Score
  nach der bestehenden Scoring-Formel (`client/src/game/scoring.ts`)
  berechnen.
- WHEN die Platzierung ermittelt wird SHALL DAS SYSTEM absteigend nach Score
  sortieren und bei Gleichstand die kürzere Zeit als Tie-Breaker verwenden.
- WHEN ein Match beendet ist SHALL DAS SYSTEM das Ergebnis (Platzierung,
  Score, Früchte, Zeit, Tode pro Bot) an den Server melden, sodass `/admin`
  und `/present` dasselbe Ergebnis sehen.
- WHEN ein Match-Ergebnis vorliegt SHALL DAS SYSTEM den Turnierbaum
  entsprechend fortschreiben (Sieger rückt auf).

### US-5: Live-Zwischenstände während des Matches

Als Standbetreuer möchte ich während eines laufenden Matches den
Zwischenstand sehen, damit ich den Verlauf moderieren kann.

Akzeptanzkriterien:
- WHEN ein Match läuft SHALL DAS SYSTEM in regelmäßigen Abständen den
  Zwischenstand jedes Bots (Früchte-Punkte, Position/Fortschritt, verbleibende
  Leben, verstrichene Zeit, Status) an `/admin` übermitteln.
- WHEN Zwischenstände übermittelt werden SHALL DAS SYSTEM die Übertragungsrate
  so begrenzen, dass die Verbindung und die Simulation nicht spürbar belastet
  werden (nicht pro Frame).
- WHEN `/admin` Zwischenstände empfängt SHALL DAS SYSTEM sie als laufend
  aktualisierte Rangliste des aktuellen Matches anzeigen.

### US-6: Turnierverlauf sichtbar machen

Als Standbetreuer und als Publikum möchte ich sehen, wie das Turnier steht,
damit der Wettbewerb nachvollziehbar und spannend ist.

Akzeptanzkriterien:
- WHEN ein Turnier läuft SHALL DAS SYSTEM auf `/present` den Turnierbaum mit
  Runden, Matches und bereits feststehenden Siegern anzeigen.
- WHEN ein Match beendet ist SHALL DAS SYSTEM auf `/present` das Endergebnis
  des Matches anzeigen, bevor das nächste Match gestartet wird.
- WHEN das Turnier beendet ist SHALL DAS SYSTEM auf `/present` einen
  Champion-Screen mit dem Sieger (Name und Autor) anzeigen.
- WHEN ein neuer Client (`/admin` oder `/present`) verbindet, während ein
  Turnier läuft, SHALL DAS SYSTEM ihm den aktuellen Turnierzustand
  übermitteln, sodass er denselben Stand zeigt.

### US-7: Turnier zurücksetzen

Als Standbetreuer möchte ich ein Turnier abbrechen/zurücksetzen können, damit
ich bei Problemen oder für einen neuen Durchgang neu starten kann.

Akzeptanzkriterien:
- WHEN der Nutzer in `/admin` das Turnier zurücksetzt SHALL DAS SYSTEM den
  Turnierzustand verwerfen und `/present` in den Ausgangszustand versetzen.
- WHEN ein Turnier zurückgesetzt wird SHALL DAS SYSTEM die Bot-Registry
  **nicht** verändern (die gesammelten Bots bleiben erhalten).

### US-8 (NFR): Erweiterbarkeit, Architektur, Testbarkeit

Als Entwicklerteam möchten wir, dass weitere Turniermodi später ohne Umbau
ergänzt werden können und die bestehende `/dev`-Funktionalität unberührt
bleibt.

Akzeptanzkriterien:
- WHEN die Bracket-Erzeugung und das Fortschreiben implementiert werden SHALL
  DAS SYSTEM sie hinter einer austauschbaren Turnier-Strategie kapseln, sodass
  ein weiterer Modus (z.B. Round-Robin) durch Hinzufügen einer neuen
  Implementierung ergänzt werden kann, ohne bestehende Modi zu ändern
  (Open/Closed).
- WHEN die Turnierlogik implementiert wird SHALL DAS SYSTEM sie als reine,
  Phaser-unabhängige Funktionen/Module umsetzen, die ohne Browser-Umgebung
  testbar sind.
- WHEN die Multi-Bot-Simulation umgesetzt wird SHALL DAS SYSTEM die
  bestehenden Regel-/Physik-Module (`rules/`, `movement/`, `state/`,
  `sandbox/`) wiederverwenden statt sie zu duplizieren (DRY).
- WHEN die Multi-Bot-Simulation umgesetzt wird SHALL DAS SYSTEM `RaceScene`
  und die `/dev`-Ansicht funktional unverändert lassen (Regressionsschutz).
- WHEN dieses Feature umgesetzt wird SHALL DAS SYSTEM strikt testgetrieben
  (Rot-Grün-Refactor, siehe `AGENTS.md`) entwickelt werden.

## Nicht-Ziele

- Keine weiteren Turniermodi außer Single-Elimination (nur die Erweiterbarkeit
  wird sichergestellt).
- Keine Bot-zu-Bot-Interaktion/Kollision.
- Keine Persistenz des Turnierzustands über einen Server-Neustart hinaus
  (anders als die Bot-Registry – ein Turnier ist kurzlebig und kann neu
  gestartet werden).
- Keine Änderung der Scoring-Formel oder der Bot-API.
- Keine Änderungen an `/dev`.
- Kein automatischer Start der nächsten Runde (der Standbetreuer startet jedes
  Match bewusst, um moderieren zu können).
- Keine Zuschauer-Abstimmung, keine Wiederholungen/Replays.

## Offene Fragen

- Sollen Matches einer Runde nacheinander laufen (moderierbar) oder mehrere
  gleichzeitig? Annahme für dieses Feature: **nacheinander**, `/admin` startet
  jedes Match einzeln (deckt sich mit "kein automatischer Start" oben).
- Wie viele Bots passen performant gleichzeitig in eine Szene? Obergrenze 4
  laut `docs/09`; eine Performance-Messung mit 4 echten Bots erfolgt im
  manuellen Verifikationsschritt.
- Soll der Champion-Screen zusätzlich ein Gesamt-Leaderboard über alle Matches
  zeigen? Für dieses Feature nicht vorgesehen (siehe Nicht-Ziele), kann später
  ergänzt werden.
