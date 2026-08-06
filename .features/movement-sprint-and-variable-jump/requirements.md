# Requirements: Movement-Sprint-And-Variable-Jump

## Kontext

Betrifft die Racer-Physik in `client/src/game/scenes/RaceScene.ts` sowie den Bot-Contract in
`@arena/bot-contract` (`docs/02-bot-api.md`). Aktuell bewegt sich der Racer mit fester
Geschwindigkeit (`MOVE_SPEED=200`) und springt mit fester Sprungkraft
(`JUMP_VELOCITY=-560`), unabhängig davon, wie lange die Sprung-Taste/Action gehalten wird.

Dieses Feature führt zwei Bewegungsmechaniken ein:
1. **Sprint (Momentum-Aufbau):** Ein zusätzlicher Button (Tastatur: Shift; Bot: neue
   Action-Werte) erlaubt schnelleres Laufen, das sich über eine kurze Zeit aufbaut
   ("Momentum"), und dadurch höhere/weitere Sprünge ermöglicht.
2. **Variable Sprunghöhe:** Wird die Sprung-Taste/Action gehalten, wird die maximale
   Sprunghöhe erreicht; wird sie losgelassen, geht der Racer sofort in den Fall-Zustand über
   (mehr Kontrolle beim Springen), nach einer garantierten Mindest-Halte-Zeit.

Beide Mechaniken sind sowohl im manuellen Tastatur-Testmodus als auch für Bot-gesteuerte
Läufe verfügbar (siehe Entscheidung im Chat-Verlauf) – Sprint erfordert daher eine Erweiterung
des `Action`-Contracts (`@arena/bot-contract`).

**Begleitender Fix:** Aktuell setzt ein Bot-`"jump"`-Tick die horizontale Geschwindigkeit auf
0 zurück (nur `"left"`/`"right"` setzen sie). Das wird geändert, damit ein Bot beim Springen
seine zuletzt gesetzte Richtung/Geschwindigkeit (inkl. Sprint-Tempo) beibehält – sonst wäre
der Sprung-Boost für Bots wirkungslos.

## User Stories

### US-1: Bot-Contract um Sprint-Actions erweitern

Als Entwicklerteam möchte ich, dass Bots ebenfalls sprinten können, damit Sprint keine
tastatur-exklusive Mechanik ist.

Akzeptanzkriterien:
- WHEN der `Action`-Typ verwendet wird SHALL DAS SYSTEM zusätzlich zu `"left"`, `"right"`,
  `"jump"`, `"idle"` die zwei neuen Werte `"sprint-left"` und `"sprint-right"` als gültige
  Actions unterstützen (`ACTIONS`-Array, Laufzeit-Validierung in `BotRunner`).
- WHEN ein Bot einen ungültigen/anderen String als einen dieser 6 zurückgibt SHALL DAS SYSTEM
  dies weiterhin wie bisher als `"idle"` werten (keine Verschärfung der Fehlertoleranz-Regel
  aus `docs/02`).
- WHEN `docs/02-bot-api.md`/`docs/09-bot-artefakt-und-turnier.md` den `Action`-Typ oder die
  Anzahl gültiger Action-Strings erwähnen SHALL DAS SYSTEM diese Stellen auf die neuen 6 Werte
  aktualisieren, inkl. einer kurzen Erklärung der Sprint-/Variable-Sprunghöhe-Mechanik.

### US-2: Sprint mit Momentum-Aufbau (Tastatur)

Als Standbetreuer möchte ich im manuellen Testmodus durch Halten von Shift + Richtungstaste
schneller laufen können, wobei sich die Geschwindigkeit über eine kurze Zeit aufbaut.

Akzeptanzkriterien:
- WHEN Shift UND eine Richtungstaste gemeinsam gehalten werden SHALL DAS SYSTEM die
  horizontale Geschwindigkeit kontinuierlich von der Basisgeschwindigkeit in Richtung einer
  höheren Sprint-Geschwindigkeit ansteigen lassen (Rampe über eine feste Zeitspanne).
- WHEN Shift oder die Richtungstaste losgelassen wird, oder die Richtung gewechselt wird,
  SHALL DAS SYSTEM sofort auf die Basisgeschwindigkeit zurückfallen (kein Ausrollen).
- WHEN nur eine Richtungstaste ohne Shift gehalten wird SHALL DAS SYSTEM sich wie bisher
  verhalten (feste Basisgeschwindigkeit, kein Aufbau).

### US-3: Sprint für Bots

Als Standbetreuer möchte ich, dass ein Bot dieselbe Sprint-Mechanik über die Actions
`"sprint-left"`/`"sprint-right"` nutzen kann.

Akzeptanzkriterien:
- WHEN ein Bot über mehrere aufeinanderfolgende Ticks hinweg `"sprint-left"` oder
  `"sprint-right"` (jeweils dieselbe Richtung) zurückgibt SHALL DAS SYSTEM dieselbe
  Momentum-Rampe wie im Tastatur-Modus anwenden.
- WHEN ein Bot die Richtung wechselt, zu `"left"`/`"right"` (ohne Sprint) wechselt, oder
  `"idle"` zurückgibt SHALL DAS SYSTEM den Momentum-Aufbau sofort zurücksetzen (analog US-2).
- WHEN ein Bot `"jump"` zurückgibt SHALL DAS SYSTEM die zuletzt aktive horizontale
  Geschwindigkeit (inkl. eines laufenden Sprint-Aufbaus) für die Dauer dieses Ticks
  unverändert beibehalten (siehe "Begleitender Fix" oben) und den Momentum-Aufbau währenddessen
  weder zurücksetzen noch fortschreiten lassen.

### US-4: Sprung-Boost durch Sprint-Geschwindigkeit

Als Standbetreuer möchte ich, dass ein Sprung während des Sprintens höher UND weiter geht,
damit Sprint einen spielerischen Mehrwert hat (z.B. für Level-2-Kaizo-Passagen).

Akzeptanzkriterien:
- WHEN ein Sprung ausgelöst wird SHALL DAS SYSTEM die vertikale Sprung-Geschwindigkeit
  stufenlos zwischen der Basis-Sprungkraft (bei Basisgeschwindigkeit) und einer höheren
  maximalen Sprungkraft (bei voller Sprint-Geschwindigkeit) skalieren, abhängig von der zum
  Absprungzeitpunkt aktuellen horizontalen Geschwindigkeit.
- WHEN die horizontale Geschwindigkeit beim Absprung höher ist als die Basisgeschwindigkeit
  SHALL DAS SYSTEM dadurch automatisch auch eine größere Sprungweite ermöglichen (höhere
  horizontale Geschwindigkeit bleibt beim Sprung erhalten).

### US-5: Variable Sprunghöhe mit Mindest-Halte-Zeit

Als Standbetreuer möchte ich beim Springen mehr Kontrolle haben: Halte ich die Sprung-Taste,
erreiche ich die maximale Höhe; lasse ich früh los, wird der Sprung abgeschnitten.

Akzeptanzkriterien:
- WHEN die Sprung-Taste/Action während des Aufstiegs durchgehend gehalten wird SHALL DAS
  SYSTEM die volle, aus US-4 berechnete Sprunghöhe erreichen lassen.
- WHEN die Sprung-Taste/Action losgelassen wird, NACHDEM eine feste Mindest-Halte-Zeit
  (`MIN_JUMP_HOLD_MS`) seit Sprungbeginn verstrichen ist, UND sich der Racer noch im Aufstieg
  befindet, SHALL DAS SYSTEM die vertikale Geschwindigkeit sofort kappen, sodass der Racer
  unmittelbar in den Fall-Zustand (fallende Animation/Physik) übergeht.
- WHEN die Sprung-Taste/Action VOR Ablauf der Mindest-Halte-Zeit losgelassen wird SHALL DAS
  SYSTEM den Sprung dennoch mindestens bis zum Ablauf dieser Mindest-Halte-Zeit mit voller
  Kraft weiterlaufen lassen (Schutz für Bots mit 150ms-Tick-Rate, die "jump" oft nur für einen
  einzelnen Tick zurückgeben – siehe Chat-Verlauf), danach greift der sofortige Cutoff wie
  oben beschrieben.
- WHEN diese Mechanik für einen Bot ausgewertet wird SHALL DAS SYSTEM "Taste gehalten" als
  "der Bot hat im letzten Tick `\"jump\"` zurückgegeben" interpretieren (nutzt den bereits
  bestehenden Persistenz-Mechanismus der zuletzt aufgelösten Bot-Action zwischen Ticks).
- WHEN diese Mechanik für die Tastatursteuerung ausgewertet wird SHALL DAS SYSTEM den
  tatsächlichen, pro Frame gelesenen Tastendruck-Zustand der Sprung-Taste verwenden.

### US-6 (NFR): Testbare, saubere Architektur

Als Entwicklerteam möchten wir, dass die neue Bewegungslogik (Sprint-Rampe,
Sprung-Geschwindigkeits-Skalierung, Sprung-Cutoff-Entscheidung) als reine, unit-getestete
Funktionen umgesetzt wird, getrennt von der dünnen `RaceScene`-Phaser-Schicht (analog zu
`hazards/behaviors.ts`/`rules/raceRules.ts`).

Akzeptanzkriterien:
- WHEN die Rampen-/Skalierungs-/Cutoff-Berechnungen implementiert werden SHALL DAS SYSTEM
  diese als pure Funktionen ohne Phaser-Import bereitstellen, vor der Implementierung mit
  fehlschlagenden Tests abgesichert (Rot-Grün-Refactor).
- WHEN `RaceScene` diese Funktionen nutzt SHALL DAS SYSTEM dort keine eigene
  Physik-/Skalierungslogik duplizieren (DRY), sondern ausschließlich die pure Funktionen
  aufrufen und deren Ergebnis auf den Arcade-Physics-Body anwenden.

## Nicht-Ziele

- Kein Ausrollen/Trägheits-Abbau beim Loslassen von Sprint (sofortiges Zurücksetzen auf
  Basisgeschwindigkeit, siehe US-2).
- Keine Änderung an bestehenden Hazards/Scoring/Checkpoints – reine Bewegungsmechanik.
- Keine sichtbare Anzeige/HUD für den aktuellen Sprint-Zustand (kein Akzeptanzkriterium
  verlangt das; kann später ergänzt werden).
- Keine Anpassung des `nearbyTiles`-Sichtfelds oder anderer `BotState`-Felder – Sprint/Jump
  bleiben reine Action-Contract-Erweiterung, kein neues State-Feld nötig, damit ein Bot
  "weiß", ob er gerade sprintet (YAGNI, kann später ergänzt werden, falls gewünscht).

## Offene Fragen

- Exakte Tuning-Werte (Sprint-Geschwindigkeit, Rampen-Dauer, Sprung-Boost-Faktor,
  Mindest-Halte-Zeit) werden im Design als sinnvolle Startwerte festgelegt und bleiben, wie
  andere Bewegungswerte, ein späteres Kalibrierungs-Thema (siehe `docs/07`).

## Begleitende Doku-Updates

- `docs/02-bot-api.md`: `Action`-Typ (6 statt 4 Werte), Regel 4, kurze Erklärung von
  Sprint/variabler Sprunghöhe für devkcode-generierte Bots.
- `docs/09-bot-artefakt-und-turnier.md`: Kommentarzeile mit den gültigen Action-Strings.
