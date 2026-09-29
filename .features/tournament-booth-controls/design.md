# Design: Turnier-Steuerung am Messestand

Der im Gespräch beschriebene technische Ansatz wurde mit „Bau!“ am
29.09.2026 zur direkten Umsetzung freigegeben.

## Match-Abschluss (US-1)

Korrektur gemäß freigegebenem `bugfix.md`: `ShowControlPanel` bietet in
`/admin` „Überspringen“ an. `AdminPage` sendet `match-skip` mit Match-ID und
Attempt-ID. `createMatchSkipHandler` prüft Admin-Rolle, laufende Phase und
aktuellen Versuch und leitet an den bereiten Executor weiter. `MatchView`
empfängt über den WebSocket-Subscriber nur Aufträge für seinen Versuch und
ruft `MatchRunner.skip()` auf. In `/present` gibt es keinen Button.
Der Runner merkt sich die Teilnehmer
bereits vor dem Laden der Assets. Er erstellt aus den letzten bekannten
Racer-Zuständen ein Ergebnis über `rankMatchResults`; fehlende Zustände
erhalten den vorhandenen DNF-Default. Nicht beendete Läufe gelten als DNF,
Zieleinläufe und Fehlerstatus bleiben erhalten. Danach beendet `stop()`
Szenen, Worker und Timer. Ein Abschluss-Guard verhindert doppelte Ergebnisse
und spätere Statuscallbacks. Ein später eintreffendes Asset-Ready-Ereignis
startet nach einem Abbruch keine Szenen.

Das Ergebnis wird über den bestehenden `onFinished`-/`match-result`-Pfad
mit Match-ID und Attempt-ID gesendet. Der Server prüft weiterhin den
Executor und Versuch und wechselt regulär in die Ergebnisphase.
Die Wertungsformel bleibt auf der Clientseite.

## Zusatzduell (US-2)

`SingleEliminationStrategy.createRounds` lässt die letzte Einzelgruppe
bei Gruppengröße 2 und mindestens drei Teilnehmern als `pending` mit
`result: null` stehen. Der bestehende `selectNextPendingMatch` überspringt
Gruppen mit nur einem Teilnehmer. Auch `TournamentService.startMatch`
lehnt einen Start ohne Gegner ab.

Nach jedem regulären Ergebnis prüft `advance` in Runde 1 des Zweiermodus,
ob eine offene Einzelgruppe existiert und alle anderen Matches beendet
sind. Dann werden deren Verlierer nach Score absteigend, Zeit aufsteigend
und stabiler Bracket-Reihenfolge verglichen. Der beste wird der
Einzelgruppe als zweiter Teilnehmer hinzugefügt. Erst nach diesem Duell
wird die Runde wie bisher fortgeschrieben. Die Änderung erfolgt ohne
Mutation des übergebenen Zustands. Da das Duell in Runde 1 bleibt, gelten
automatisch das richtige Level und der bestehende Show-Ablauf.

Gruppengröße 4, gerade Teilnehmerzahlen und spätere Freilose verwenden
die bisherige Logik. Bereits konfigurierte Turniere werden nicht migriert.
Es gibt keine zusätzliche Warteanzeige.

## Ergänzung: Alle Teilnehmer hinzufügen (US-3)

Status: Design-Ergänzung und direkte Umsetzung durch „ja“ freigegeben.

In `TournamentSetup.tsx` erhält das Teilnehmer-Fieldset einen Button
„Alle hinzufügen“ im vorhandenen `pixel-btn`-Stil. Sein Click-Handler setzt
`selectedIds` auf ein neues Set der aktuellen `bots`-IDs. Damit werden
auch erst nach dem Mount eingetroffene Bots erfasst und keine inzwischen
entfernten IDs übernommen. Bei leerer Bot-Liste ist der Button deaktiviert.
Der Button hat `type="button"`; er stellt das Turnier nicht selbst auf.

Gezielter React-Test: zunächst leere Liste, dann eintreffende Bots;
Sammelauswahl, nachträglicher Upload, erneute Sammelauswahl und individuelles
Abwählen. Beim Aufstellen müssen genau die gewählten aktuellen IDs an
`onStart` übergeben werden. Umsetzung nach Freigabe testgetrieben.

## Verifikation

Rot-Grün-Refactor für den Runner-Abbruch einschließlich Assets noch nicht
bereit, fehlender Statusdaten, erhaltener Ergebnisse, doppeltem Abschluss
und Cleanup. React-Test für den bedienbaren Button. Strategie-Tests für
3/5/7 Teilnehmer, Score-/Zeit-/stabile Gleichstände, unveränderte
Eingabezustände und Fortschreibung bis zum Champion. Service-/Show-Test
für das automatische Zusatzduell vor Runde 2. Bestehende Turnier- und
Match-Tests, TypeScript/Build und gezielte Biome-Prüfung abschließend.
