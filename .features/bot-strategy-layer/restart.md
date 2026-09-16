# Neustart: Eine Besucherkorrektur muss sichtbar wirken

Aktuelle Konkretisierung unter der Vorgabe „lokal, Messestand, YAGNI/KISS“:
[Neuentwurf](neuentwurf.md). Er ist ein Vorschlag, noch kein implementierter Umbau.

## Auftrag und Status

Der Nutzer hat den bisherigen Ansatz verworfen und am 2026-09-16 bestätigt:
Kern des Messestands ist gemeinsames Beobachten, eine Änderung in Alltagssprache
und eine sichtbare, verständliche Verbesserung. Das ist die freigegebene
Zielrichtung. Dieses Dokument konkretisiert den nächsten Nachweis; es ist
keine Freigabe für einen weiteren Framework-Umbau. Historische Erfolgsberichte
und grüne Unit-Tests sind keine Abnahme des Besucher-Erlebnisses.

Der Arbeitsstand einschließlich ignorierter `current-bot.js` wurde gesichert:
`/private/tmp/coin-quest-before-rethink-20260916-100825/`.
Keine Änderungen an Bot, Framework, Physik, Level oder Git-Branch in diesem Schritt.

## Ein einziger Besucher-Moment

„Mein Bot steht vor dem Abgrund. Nutze den Boingo, um auf die obere Plattform
zu kommen.“ Der Agent verändert die Bot-Datei. Beim erneuten Versuch ist genau
diese Entscheidung sichtbar. Scheitert sie, kann er benennen, welcher Schritt
scheitert und was die nächste Änderung bewirken soll.

Konkreter Untersuchungsfall im bestehenden Level 1: Boingo bei x=5932,
Bodenkante x=6032, erste obere Plattform x=6192..6384 auf y=200.
Die Koordinaten dienen nur zur Lokalisierung des Falls, nicht als Botstrategie.
Die beiden weiteren Sprünge der Kette gehören noch nicht zum ersten Nachweis.
Die tatsächliche Erreichbarkeit wird in Phaser geprüft, nicht aus Kommentaren
oder aus dem Navigations-Predictor abgeleitet.

## Anforderungen an den Nachweis

- WHEN ein Versuch beginnt SHALL der Vergleich dieselbe Ausgangssituation
  verwenden; vorherige zufällig erfolgreiche Levelabschnitte sind keine Voraussetzung.
- WHEN der Besucher die Boingo-Nutzung verlangt SHALL diese Entscheidung
  ausschließlich durch die Bot-Datei geändert werden können.
- WHEN der Bot das Manöver ausführt SHALL beobachtbar sein, ob er den Boingo
  erreicht, den Impuls erhält und auf der gewählten Plattform landet.
- WHEN ein Schritt scheitert SHALL der Agent den beobachteten Fehler von einer
  Vermutung unterscheiden und eine dazu passende einzelne Korrektur benennen.
- WHEN die Korrektur als erfolgreich bezeichnet wird SHALL eine stabile Landung
  im echten Spiel vorliegen; eine akzeptierte Prognose allein genügt nicht.
- WHEN der Versuch wiederholt wird SHALL der Erfolg mehrfach unter gleichen
  Ausgangsbedingungen nachvollziehbar sein; ein einzelner Glückstreffer genügt nicht.

## Verantwortlichkeiten, bevor wir neue Funktionen erfinden

Besuchercode: Welches Ziel? Welcher Boingo? Wann versuchen, warten oder abbrechen?
Bewegungshilfe: Einen ausdrücklich erteilten Auftrag ausführen und seinen
Ausgang melden. Kein stiller Wechsel zu einer anderen Strategie.
Spiel: Physik und Kontakte sind die maßgebliche Beobachtung.
Agent: Beobachtung erklären, genau eine Entscheidung ändern, erneut beobachten.

Ob die vorhandenen Helpers diese Grenze erfüllen, ist zu prüfen. Noch keine
neue API, kein neuer Universalplaner, keine weitere Sammlung von Ausweichregeln.

## Kleinster nächste Versuch

1. Die gewählte Passage manuell in Phaser prüfen: Kontakt, Flug und Landung.
2. Denselben Ablauf mit einem kleinen, lesbaren Bot nachvollziehen. Zunächst
   keine Fruchtbewertung, globale Routensuche oder automatische Ersatzstrategie.
3. Eine Besucherkorrektur demonstrieren: Vorher fehlt die Boingo-Nutzung,
   nachher wird der konkrete Boingo bewusst verwendet und die Plattform erreicht.
4. Erst dann entscheiden, welcher tatsächlich benötigte Bewegungsbaustein
   gemeinsam bereitgestellt werden soll. Danach erst weitere Situationen.

Noch zu klären ist der kürzeste wiederholbare Einstieg in die Passage innerhalb
der vorhandenen Vorschau. Kein neues Level, keine neue Testseite oder Test-CLI.
Falls dafür eine Änderung am Vorschauablauf nötig ist, diese getrennt und konkret
entwerfen; nicht nebenbei neue Infrastruktur einführen.

## Was ausdrücklich kein Erfolgskriterium ist

Eine höhere Punktzahl irgendwo im Level, mehr Kandidaten im Planer, eine größere
Testsuite oder eine weitere API-Methode. Der erste Erfolg ist eine vom Besucher
verstandene und durch seine Anweisung verursachte Verbesserung an dieser Stelle.
