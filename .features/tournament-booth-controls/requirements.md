# Requirements: Turnier-Steuerung am Messestand

Status: Freigegeben durch „Bau!“ am 29.09.2026.

## Kontext

Erweiterung von `.features/tournament-show-flow/` und
`.features/tournament-runner/`, Bezug zu `docs/09-bot-artefakt-und-turnier.md`.
Für den laufenden Messebetrieb werden ein vorzeitiger Match-Abschluss und
ein Zusatzduell statt eines Erstrunden-Freiloses im Zweiermodus benötigt.
Diese Requirements ersetzen für diesen Umfang die bisherige Freilosregel
und den Ausschluss des manuellen Abschlusses laufender Matches.

## User Stories

### US-1: Laufendes Match überspringen

Als Standbetreiber möchte ich ein festgefahrenes Match aus `/admin` beenden,
damit das Turnier weiterläuft.

Akzeptanzkriterien:
- WHEN ein Match läuft SHALL DAS SYSTEM in der Admin-Show-Steuerung
  einen Button „Überspringen“ anbieten (Korrektur gemäß `bugfix.md`).
- WHEN der Betreiber den Button in `/admin` betätigt SHALL DAS SYSTEM den
  Auftrag für den aktuellen Match-Versuch an die ausführende Present-Instanz
  weiterleiten; `/present` zeigt keinen Überspringen-Button.
- WHEN der Betreiber „Überspringen“ betätigt SHALL DAS SYSTEM das gesamte
  Match sofort beenden, bereits erreichte Ergebnisse erhalten und offene
  Läufe mit ihrem letzten bekannten Stand als DNF werten.
- WHEN für einen Teilnehmer noch kein Laufzustand vorliegt SHALL DAS SYSTEM
  ihn beim Überspringen als DNF ohne gesammelte Punkte und ohne Tode werten.
- WHEN ein Match übersprungen wird SHALL DAS SYSTEM die bestehende
  Scoring- und Rangfolgelogik verwenden und die aktiven Szenen, Worker und
  Match-Timer beenden.
- WHEN das Ergebnis akzeptiert wurde SHALL DAS SYSTEM über Ergebnisanzeige
  und Turnierbaum automatisch zum nächsten Match beziehungsweise Champion
  fortschreiten.
- WHEN mehrfach geklickt wird oder gleichzeitig ein reguläres Match-Ende
  eintrifft SHALL DAS SYSTEM genau ein Ergebnis pro Match-Versuch melden.

### US-2: Zusatzduell im Zweiermodus

Als Standbetreiber möchte ich, dass ein einzelner Teilnehmer der ersten
Runde gegen den besten Verlierer spielt, damit er sich sportlich für die
nächste Runde qualifiziert.

Akzeptanzkriterien:
- WHEN bei ungerader Teilnehmerzahl in Runde 1 eines Turniers mit
  Gruppengröße 2 ein einzelner Bot übrig bleibt SHALL DAS SYSTEM dessen
  Match offen halten, statt ihn per Freilos weiterzuschicken.
- WHEN alle regulären Matches dieser ersten Runde abgeschlossen sind SHALL
  DAS SYSTEM den Verlierer mit dem höchsten Ergebnis-Score als Gegner
  auswählen; Gleichstände entscheidet die kürzere Ergebniszeit und danach
  die stabile Reihenfolge im Bracket.
- WHEN der Gegner bestimmt wurde SHALL DAS SYSTEM das Zusatzduell als
  letztes Match derselben ersten Runde auf deren Level austragen.
- WHEN das Zusatzduell beendet ist SHALL DAS SYSTEM dessen Sieger zusammen
  mit den Siegern der regulären Erstrunden-Matches weiterkommen lassen.
- WHEN das Zusatzduell noch offen ist SHALL DAS SYSTEM die erste Runde
  nicht abschließen und keine Folgerunde erzeugen.
- WHEN ein Turnier mit Gruppengröße 4 gespielt wird oder in einer späteren
  Runde eine Einzelgruppe entsteht SHALL DAS SYSTEM die bisherigen
  Gruppierungs- und Freilosregeln verwenden.

### US-3: Alle vorhandenen Bots als Teilnehmer hinzufügen

Ergänzung: Nutzer bestätigt mit „1“ ausdrücklich die Auswahl aller bereits
hochgeladenen Bots als Turnierteilnehmer über „Alle hinzufügen“.

Als Standbetreiber möchte ich alle vorhandenen Bots mit einem Klick als
Turnierteilnehmer auswählen, damit ich nicht jedes Kontrollkästchen einzeln
anklicken muss.

Akzeptanzkriterien:
- WHEN die Teilnehmerauswahl in `/admin` angezeigt wird SHALL DAS SYSTEM
  einen Button „Alle hinzufügen“ anbieten.
- WHEN der Betreiber „Alle hinzufügen“ klickt SHALL DAS SYSTEM alle aktuell
  in der Sammelstelle vorhandenen Bots als Teilnehmer auswählen.
- WHEN nachträglich Bots hochgeladen wurden SHALL DAS SYSTEM sie beim
  nächsten Klick auf „Alle hinzufügen“ ebenfalls auswählen.
- WHEN alle Bots ausgewählt wurden SHALL DAS SYSTEM weiterhin das einzelne
  Abwählen und das separate Aufstellen des Turniers ermöglichen.

## Nicht-Ziele

- Zusätzliche Warteanzeige oder weitergehender Umbau des Turnierbaums.
- Einzelne Bots manuell stoppen oder Sieger manuell auswählen.
- Änderung der Scoring-Formel, Bot-API oder Level-Zuordnung.
- Nachträgliche Umstellung bereits aufgestellter Turniere.

## Verifikation

Gezielte Tests gemäß dem TDD-Pflichtprozess des Projekts für vorzeitige
Wertung, einmaligen Ergebnisabschluss sowie Gegnerauswahl und
Rundenfortschreibung; anschließend passende Build- und Codeprüfungen.

## Offene Fragen

Keine fachlichen Fragen.
