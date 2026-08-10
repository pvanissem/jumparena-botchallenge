# Requirements: Einstellbare Leben & Ausscheiden bei 0 Leben (`tournament-lives`)

## Kontext

Bezug: `.features/tournament-runner/` (Turnier- und Match-Ausführung),
`docs/05-scoring-und-heats.md` (Leben pro Lauf, DNF-Wertung),
`client/src/game/rules/racerState.ts` (`LIVES_PER_RUN`, aktuell fix `3`).

Zwei zusammenhängende Punkte am Leben-Konzept:

1. **Leben sind aktuell nicht konfigurierbar.** `LIVES_PER_RUN = 3` ist fest
   verdrahtet. `/dev` übergibt bewusst `Infinity` (Ausprobieren ohne
   vorzeitiges DNF), der Turniermodus nutzt immer den Default. Am Messestand
   soll der Standbetreuer die Leben je Turnier anpassen können (kurze Matches
   bei viel Andrang, mehr Leben für ein entspanntes Publikum).

2. **Ein Bot ohne Leben läuft sichtbar weiter.** `applyPitFall` und
   `applyHazardContact` setzen bei 0 Leben zwar korrekt `didNotFinish: true`,
   und `RaceScene.update()` steigt danach früh aus – der Racer wird aber nicht
   aktiv gestoppt: Der Arcade-Body behält seine letzte Geschwindigkeit, die
   Gravitation wirkt weiter, und der Bot-Worker läuft ungebremst weiter.
   Für das Publikum sieht es so aus, als würde der ausgeschiedene Bot einfach
   weiterspielen bzw. endlos aus dem Level fallen.

Punkt 2 ist streng genommen ein Bug an bereits spezifiziertem Verhalten,
Punkt 1 ein neues Feature. Sie werden hier gemeinsam spezifiziert, weil sie
dieselbe Mechanik betreffen und sonst zwei Specs entstünden, die sich beide
auf `startingLives`/`livesRemaining` beziehen.

## User Stories

### US-1: Leben pro Lauf in `/admin` einstellen

Als Standbetreuer möchte ich beim Aufstellen eines Turniers die Anzahl der
Leben pro Match festlegen, damit ich die Match-Dauer an die Situation am Stand
anpassen kann.

Akzeptanzkriterien:
- WHEN der Nutzer in `/admin` ein Turnier konfiguriert SHALL DAS SYSTEM ein
  Eingabefeld für die Leben pro Lauf anbieten, vorbelegt mit dem bisherigen
  Standardwert (`LIVES_PER_RUN`).
- WHEN der Nutzer einen Wert kleiner als 1 oder größer als 99 eingibt SHALL DAS
  SYSTEM den Start ablehnen und einen Hinweis anzeigen.
- WHEN der Nutzer einen nicht-ganzzahligen Wert eingibt SHALL DAS SYSTEM den
  Start ablehnen und einen Hinweis anzeigen.
- WHEN ein Turnier gestartet wird SHALL DAS SYSTEM die gewählte Lebenszahl Teil
  des Turnierzustands machen, sodass `/admin` und `/present` denselben Wert
  sehen.
- WHEN der Server eine Turnier-Konfiguration mit ungültiger Lebenszahl empfängt
  SHALL DAS SYSTEM sie ablehnen und den Turnierzustand unverändert lassen.
- WHEN `/present` ein Match startet SHALL DAS SYSTEM jedem Racer die im Turnier
  konfigurierte Lebenszahl als Startwert geben.

### US-2: Ausgeschiedene Bots stoppen sofort

Als Publikum möchte ich sofort erkennen, dass ein Bot ausgeschieden ist, damit
das Match nachvollziehbar bleibt.

Akzeptanzkriterien:
- WHEN ein Racer sein letztes Leben verliert SHALL DAS SYSTEM seine Bewegung
  sofort stoppen (keine Rest-Geschwindigkeit, kein weiteres Fallen).
- WHEN ein Racer ausgeschieden ist SHALL DAS SYSTEM seinen Bot nicht weiter
  ticken lassen (keine weiteren `decide`-Aufrufe, Worker wird freigegeben).
- WHEN ein Racer ausgeschieden ist SHALL DAS SYSTEM dies in seiner Ansicht
  sichtbar machen (visuelle Kennzeichnung des ausgeschiedenen Racers).
- WHEN ein Racer ausgeschieden ist SHALL DAS SYSTEM das Match für die übrigen
  Racer unverändert fortsetzen.
- WHEN ein Racer das Zeitlimit erreicht SHALL DAS SYSTEM ihn ebenso stoppen
  (gleiche Behandlung wie „keine Leben mehr").
- WHEN ein Racer ausgeschieden ist SHALL DAS SYSTEM ihn weiterhin regulär
  werten (DNF-Score nach bestehender Formel, kein Ausschluss aus dem Ranking).

### US-3 (NFR): Bestehendes Verhalten bleibt unangetastet

Als Entwicklerteam möchten wir, dass `/dev` und die bestehende Scoring-/
Regel-Logik unverändert funktionieren.

Akzeptanzkriterien:
- WHEN `/dev` einen Testlauf startet SHALL DAS SYSTEM weiterhin `Infinity`
  Leben verwenden, sodass ein Testlauf nicht durch DNF abbricht.
- WHEN kein `livesPerRun` angegeben ist SHALL DAS SYSTEM auf den bisherigen
  Standardwert `LIVES_PER_RUN` zurückfallen (Rückwärtskompatibilität der
  Nachrichten-Contracts).
- WHEN dieses Feature umgesetzt wird SHALL DAS SYSTEM die Scoring-Formel und
  die Bot-API unverändert lassen.
- WHEN dieses Feature umgesetzt wird SHALL DAS SYSTEM strikt testgetrieben
  entwickelt werden (siehe `AGENTS.md`).

## Nicht-Ziele

- Keine Änderung der Leben-Anzahl **während** eines laufenden Turniers
  (der Wert wird beim Aufstellen festgelegt).
- Keine unterschiedlichen Leben pro Bot oder pro Runde.
- Keine Änderung des Zeitlimits (`RUN_TIME_LIMIT_MS`) – das bleibt fix.
- Keine Änderung der Scoring-Formel (insbesondere kein neuer Malus für
  „ausgeschieden").
- Keine Konfigurierbarkeit der Leben in `/dev`.

## Offene Fragen

- ~~Soll ein ausgeschiedener Racer sichtbar bleiben oder ausgeblendet werden?~~
  **Entschieden:** Der Racer bleibt sichtbar und wird abgedunkelt mit einer
  Markierung versehen, damit das Grid-Layout stabil bleibt und das Publikum den
  Endstand sieht.
- ~~Obergrenze der Leben?~~ **Entschieden:** Bereich **1–99**.
- **Soll `/present` bei ausgeschiedenen Racern die Kamera weiter dem Sprite
  folgen lassen?** Annahme: Die Kamera bleibt an der letzten Position stehen
  (der Racer bewegt sich ohnehin nicht mehr).
