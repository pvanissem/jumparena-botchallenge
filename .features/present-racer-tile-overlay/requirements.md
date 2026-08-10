# Requirements: present-racer-tile-overlay

## Kontext

Bezug: `docs/09-bot-artefakt-und-turnier.md` (Turniermodus, Multi-Racer-Architektur,
max. 4 Bots gleichzeitig), `docs/05-scoring-und-heats.md` (Leben, Zeitlimit, DNF,
Scoring), `docs/03-architektur.md` (Rolle von `/present`).

Heute gibt es zwei sehr unterschiedliche Feedback-Qualitäten am Ende eines Laufs:

- **`/dev`** zeigt nach Laufende das React-Overlay `FinishOverlay.tsx`: eine
  Karte im Pixel-Look mit Titel ("★ ZIEL ERREICHT ★" / "✖ NICHT INS ZIEL ✖"),
  Endpunktzahl und Score-Aufschlüsselung (Früchte, Zeit-Multiplikator,
  Flat-Bonus, DNF-Strafe, Tode, Zeit).
- **`/present`** zeigt pro ausgeschiedenem Racer lediglich ein rotes
  Phaser-Text-Label "AUS" mitten in dessen Kamera-Kachel
  (`RaceScene.markRacerAsOut()`), ohne Punkte, ohne Grund, ohne Zeit. Wer ein
  Match gewonnen hat, ist in der Grid-Ansicht selbst gar nicht erkennbar – das
  steht erst danach in der separaten Liste `MatchResultView`.

Für den Messestand ist gerade `/present` die Ansicht, die das Publikum sieht.
Dort fehlt also genau das aussagekräftige Feedback, das `/dev` (für einen
einzelnen Entwickler) längst hat.

Ziel dieses Features: In `/present` bekommt **jede Racer-Kachel im Match-Grid
ihr eigenes Ergebnis-Fenster**, sobald der jeweilige Bot seinen Lauf beendet hat
– und nach Abschluss des gesamten Matches ist der Sieger direkt im Grid an einer
**goldenen Umrandung** seines Fensters erkennbar.

## User Stories

### US-1: Ergebnis-Fenster pro Racer-Kachel

Als Zuschauer am Messestand möchte ich für jeden Bot, dessen Lauf beendet ist,
direkt in seiner Kachel ein Ergebnis-Fenster mit Punkten und Details sehen,
damit ich nachvollziehen kann, wie gut dieser Bot war, statt nur "AUS" zu lesen.

Akzeptanzkriterien:

- WHEN ein Racer in `/present` einen Endzustand erreicht (Ziel erreicht, alle
  Leben verbraucht oder Zeitlimit überschritten) SHALL DAS SYSTEM in der
  Kamera-Kachel genau dieses Racers ein Ergebnis-Fenster einblenden.
- WHEN das Ergebnis-Fenster eines Racers eingeblendet wird SHALL DAS SYSTEM
  darin den Bot-Namen, die erreichte Endpunktzahl und die Score-Aufschlüsselung
  (Früchte, bei Zielerreichung Zeit-Multiplikator und Flat-Bonus, bei DNF die
  DNF-Strafe, Tode-Strafe sofern Tode > 0, verstrichene Zeit) anzeigen.
- WHEN ein Racer das Ziel erreicht hat SHALL DAS SYSTEM das Fenster visuell als
  Erfolg kennzeichnen (analog zur `is-win`-Darstellung in `/dev`).
- WHEN ein Racer nicht ins Ziel gekommen ist SHALL DAS SYSTEM das Fenster
  visuell als Misserfolg kennzeichnen (analog zur `is-fail`-Darstellung in
  `/dev`) und den Grund benennen (Leben verbraucht bzw. Zeitlimit
  überschritten).
- WHEN ein Racer wegen Laufzeitfehlern/Timeouts dauerhaft pausiert wurde
  (`pausedReasonKind !== null`) SHALL DAS SYSTEM ebenfalls ein Ergebnis-Fenster
  für diesen Racer anzeigen und darin kenntlich machen, dass der Bot
  pausiert/deaktiviert wurde.
- WHEN ein Racer sein Ergebnis-Fenster erhalten hat SHALL DAS SYSTEM das bisher
  genutzte reine "AUS"-Textlabel für diesen Racer nicht mehr zusätzlich
  anzeigen.
- WHEN ein Racer sein Ergebnis-Fenster erhalten hat SHALL DAS SYSTEM die bereits
  bestehende visuelle Abdunklung des ausgeschiedenen Sprites beibehalten
  (Regressions-Schutz gegen "Bot spielt scheinbar weiter").

### US-2: Andere Racer laufen ungestört weiter

Als Zuschauer möchte ich, dass das Ergebnis-Fenster eines fertigen Bots die
noch laufenden Bots nicht verdeckt oder stört, damit ich das restliche Rennen
weiter verfolgen kann.

Akzeptanzkriterien:

- WHEN ein Racer sein Ergebnis-Fenster erhält, während andere Racer desselben
  Matches noch laufen SHALL DAS SYSTEM das Fenster ausschließlich innerhalb der
  Kachel-Fläche dieses Racers darstellen und die übrigen Kacheln unverändert
  weiter rendern.
- WHEN das Match-Grid seine Größe ändert (Fenster-Resize, siehe
  `ResizeObserver` in `MatchView`) SHALL DAS SYSTEM die Ergebnis-Fenster
  deckungsgleich zu den Phaser-Kamera-Ausschnitten halten, also exakt dieselben
  Viewport-Rechtecke verwenden, mit denen die Kameras arbeiten.

  > Hinweis (Bestandsverhalten): Die Kamera-Viewports werden in
  > `RaceScene.create()` **einmalig** gesetzt und bei einem Resize heute nicht
  > neu berechnet. Ein Resize während eines laufenden Matches verschiebt daher
  > bereits jetzt das Kachel-Raster gegenüber der Canvas. Dieses Feature
  > verbessert das nicht und verschlechtert es nicht – es stellt lediglich
  > sicher, dass Fenster und Kachel **gemeinsam** dieselbe Geometrie nutzen und
  > nicht auseinanderlaufen. Ein echtes Reflow der Kameras wäre ein eigenes
  > Feature.
- WHEN ein Match mit 2 Teilnehmern bzw. mit 3–4 Teilnehmern läuft SHALL DAS
  SYSTEM die Ergebnis-Fenster in allen von `computeGridViewports` unterstützten
  Layouts korrekt innerhalb der jeweiligen Kachel platzieren.

### US-3: Sieger nach Match-Ende golden hervorheben

Als Zuschauer möchte ich nach Ende einer Runde sofort im Grid sehen, wer
gewonnen hat, damit der Ausgang des Matches ohne Blick auf eine separate Liste
klar ist.

Akzeptanzkriterien:

- WHEN alle Racer eines Matches ihren Lauf beendet haben SHALL DAS SYSTEM
  ermitteln, welcher Racer Rang 1 belegt (nach der bestehenden Sortierung aus
  `rankMatchResults`: Score absteigend, bei Gleichstand kürzere Zeit).
- WHEN der Racer mit Rang 1 feststeht SHALL DAS SYSTEM dessen Ergebnis-Fenster
  mit einer goldenen Umrandung hervorheben.
- WHEN der Racer mit Rang 1 feststeht SHALL DAS SYSTEM in dessen
  Ergebnis-Fenster zusätzlich kenntlich machen, dass es sich um den Sieger des
  Matches handelt.
- WHEN ein Racer nicht Rang 1 belegt SHALL DAS SYSTEM dessen Ergebnis-Fenster
  ohne goldene Umrandung darstellen.
- WHEN noch nicht alle Racer des Matches fertig sind SHALL DAS SYSTEM noch
  keine goldene Umrandung vergeben (der Sieger steht erst nach Match-Ende
  fest).

### US-4: Konsistenz zwischen Kachel-Fenster und Match-Ergebnis

Als Betreiber am Stand möchte ich, dass die in den Kachel-Fenstern gezeigten
Punkte exakt denen entsprechen, die anschließend im Match-Ergebnis und im
Bracket landen, damit es keine widersprüchlichen Zahlen auf der Leinwand gibt.

Akzeptanzkriterien:

- WHEN ein Ergebnis-Fenster eine Endpunktzahl anzeigt SHALL DAS SYSTEM dafür
  dieselbe Score-Berechnung verwenden, die auch in das an den Server gemeldete
  `MatchResult` einfließt (`computeScore` aus `client/src/game/scoring.ts`).
- WHEN das Match abgeschlossen ist SHALL DAS SYSTEM den in den Kachel-Fenstern
  als Sieger markierten Bot identisch zu dem Bot bestimmen, der im gemeldeten
  `MatchResult` den Rang 1 hat.

## Nicht-Ziele

- Kein Umbau oder Ersetzen der bestehenden Komponente `MatchResultView`
  (aggregierte Ergebnisliste nach Match-Ende) – die bleibt unverändert
  erhalten.
- Keine **Verhaltens**änderung in `/dev`. Das dortige `FinishOverlay` darf
  jedoch refaktoriert werden, um die Score-Aufschlüsselung mit dem neuen
  Kachel-Fenster zu teilen (siehe `design.md`, Abschnitt "DRY"); die
  Darstellung in `/dev` bleibt dabei identisch.
- Keine Änderung an der Scoring-Formel, an den Turnierregeln, an der
  Rangfolge-Logik oder am Bracket-Aufbau.
- Kein "Neu starten"-Button in den Kachel-Fenstern (anders als in `/dev`; im
  Turnier wird ein Match nicht vom Zuschauer neu gestartet).
- Keine Animationen/Effekte über die goldene Umrandung hinaus (z. B. Konfetti,
  Sound-Fanfare) – kann später ein eigenes Feature werden.
- Kein Reflow der Phaser-Kamera-Viewports bei Fenster-Resize (bestehende
  Einschränkung, siehe Hinweis bei US-2).
- Keine Änderung an der maximalen Teilnehmerzahl pro Match (siehe dafür das
  separate Feature `.features/admin-match-group-size/`).

## Entschiedene Fragen

- **Fenstergröße/Detailtiefe:** Die Karte liegt mittig in der Kachel (nicht
  formatfüllend), sodass der abgedunkelte Bot sichtbar bleibt. Die
  Score-Aufschlüsselung wird **immer vollständig** angezeigt, im 4er-Grid
  lediglich kompakter gesetzt. *(entschieden)*
- **Technische Umsetzung:** React-Overlay über der Phaser-Canvas, positioniert
  anhand der Viewport-Rechtecke – nicht Phaser-GameObjects. Grund:
  Wiederverwendung des vorhandenen `pixel-overlay__*`-Stylings. *(entschieden)*
- **Dauer der Siegerehrung:** 10 Sekunden, bevor `/present` zur Ergebnisliste
  weiterschaltet (siehe `design.md`, `WINNER_SHOWCASE_MS`). *(entschieden)*
