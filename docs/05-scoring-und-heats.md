# 05 – Scoring & Heat-System

> **Hinweis (aktualisiert):** Das hier beschriebene Heat-System (Gruppen à 16
> Bots) ist durch den **Turniermodus** (Single-Elimination, max. 4 Bots
> gleichzeitig pro Match) abgelöst worden – siehe
> `docs/09-bot-artefakt-und-turnier.md`, Abschnitt "Turniermodus", und
> `docs/07-offene-punkte.md`. Die **Scoring-Formel** und die Abschnitte
> "Leben/Fehlversuche" sowie "Zielerreichung/Zeitlimit" gelten inhaltlich
> weiterhin (angewendet pro Match statt pro Heat) – nur der Abschnitt
> "Heat-System" selbst (Gruppengröße 16, mehrere Heats mit Leaderboard über
> Heats hinweg) ist überholt.

## Heat-System

- Bei erwarteten 50–100 Teilnehmer-Bots werden diese in **Heats à 16 Bots** aufgeteilt
  (Gruppengröße konfigurierbar, 16 als Ausgangswert wegen Grid-/Rendering-Performance).
- Jeder Heat läuft im selben Level, unter denselben Bedingungen (kein Zufalls-Faktor im Level
  selbst, damit die Ergebnisse zwischen Heats vergleichbar bleiben).
- Nach jedem Heat werden die Ergebnisse ins **globale Leaderboard** übernommen.
- Bots aus späteren Heats treten nicht gegen frühere Heats an (kein Bot-vs-Bot nötig, da keine
  Kollision/Interaktion) – die Vergleichbarkeit ergibt sich rein aus dem identischen Level.

## Scoring-Formel

```
Score = (coinsCollected × POINTS_PER_COIN)
      + max(0, TIME_BUDGET_MS - timeElapsedMs) × TIME_BONUS_FACTOR
      - deaths × DEATH_PENALTY
      - (didNotFinish ? DNF_PENALTY : 0)
```

### Vorschläge für Konstanten (final abzustimmen)

| Konstante | Vorschlagswert | Begründung |
|---|---|---|
| `POINTS_PER_COIN` | 10 | Klar sichtbarer Anreiz fürs Sammeln |
| `TIME_BUDGET_MS` | z.B. 60.000 (60s) | Referenzzeit, ab der kein Zeitbonus mehr möglich ist |
| `TIME_BONUS_FACTOR` | 0.01 (1 Punkt pro 100ms gespart) | Geschwindigkeit lohnt sich, aber Coins bleiben Hauptfaktor |
| `DEATH_PENALTY` | 15 | Deutlich spürbarer Abzug pro Fehlversuch/Tod |
| `DNF_PENALTY` | 50 | Wer das Ziel gar nicht erreicht, landet klar hinter allen, die ankommen |

> Diese Werte sollten vor dem Event mit ein paar Testbots durchgespielt/kalibriert werden,
> damit weder "nur schnell rennen" noch "nur Coins sammeln" die dominante Strategie ist –
> beides soll sich lohnen können.

## Leben/Fehlversuche

- Ein Bot hat standardmäßig **3 Leben** pro Lauf.
- Die Anzahl ist seit `.features/tournament-lives/` **pro Turnier in `/admin`
  einstellbar** (ganzzahlig, **1–99**, Default 3). Der Wert ist Teil des
  Turnierzustands (`TournamentState.livesPerRun`) und gilt für alle Matches des
  Turniers; `/dev` läuft weiterhin bewusst mit unendlich vielen Leben.
- Bei Kontakt mit einem Hazard (Gegner, Grube, Falle) verliert der Bot ein Leben und wird an
  einen definierten Checkpoint (letzter sicherer Punkt oder Level-Start) zurückgesetzt.
- Nach Verbrauch aller Leben: Bot gilt als "ausgeschieden" (`didNotFinish =
  true`). Er wird **sofort gestoppt** (keine Bewegung, keine weiteren
  Bot-Ticks) und in seiner Ansicht abgedunkelt mit "AUS" markiert; die
  Simulation läuft für die anderen Bots weiter.

## Zielerreichung / Zeitlimit pro Heat

- Jeder Heat hat ein **Zeitlimit** (z.B. 90 Sekunden), danach wird der Lauf für alle noch
  aktiven Bots beendet (mit `didNotFinish = true`, aber gesammelte Coins zählen trotzdem).
- Bots, die das Ziel erreichen, werden mit ihrem `timeElapsedMs` bis zum Zielkontakt gewertet.

## Leaderboard

- Einfache Tabelle: Platz | Bot-/Teilnehmername | Coins | Zeit | Tode | Score.
- Nach jedem Heat aktualisiert, laufend sichtbar auf einem zweiten Screen am Stand.
- Am Ende der Konferenz: Export als CSV/JSON möglich (z.B. für eine Siegerehrung).

## Offene Punkte

- Sollen die Top-Bots aus früheren Heats am Ende nochmal gegeneinander in einem "Finale"
  antreten (mehr Show-Effekt am Konferenzende)?
- Wie werden Gleichstände aufgelöst (z.B. Zeit als Tie-Breaker)?
