# Bugfix: Irreführende Besucherreferenz

## Freigabe und Umfang
Der Nutzer hat am 16.09.2026 mit „k“ der kleinen Korrektur von API-Hinweisen und geprüftem Beispiel zugestimmt. Kein Framework-Umbau, kein Autoplaner, leeres Template bleibt erhalten.

## Aktuelles Verhalten
visitor-builder sperrt nach danger-ahead sein Laufziel wie einen gescheiterten Sprung. Neue Sprünge berücksichtigen keine nahen Gefahren. Der API-Einstieg zeigt einen Laufauftrag ohne Behandlung terminaler Fehler.

## Erwartetes Verhalten
WHEN ein Laufauftrag wegen danger-ahead endet SHALL das Beispiel warten und mit neuer ID erneut versuchen, sobald die nahe Gefahr verschwunden ist.
WHEN eine aktive oder warnende Gefahr im nahen Bereich eines neuen Sprungversuchs liegt SHALL das Beispiel warten, unabhängig von der momentanen Geschwindigkeit.

## Root Cause
Erfolg und sämtliche Fehler werden in derselben attempted-Menge gespeichert. Die allgemeine Plattformwahl wird als Besucherreferenz empfohlen, obwohl sie keine sichere Flugbahn prüft.

## Fix-Ansatz
Zwei Verhaltenstests zuerst. Begrenzte Warteprüfung vor neuen Sprüngen und Wiederaufnahme bei vorübergehendem Laufhindernis. Dokumentation erklärt sofortigen Absprung, nötigen expliziten Anlauf und Grenzen der Beispiele. Keine Sicherheitsgarantie für bewegliche Gegner.

## Regressions-Schutz
Bestehende Plattform-/Boingoauswahl, Framework und Spiel bleiben unverändert. Beispiele sind experimentell; die Korrektur behauptet keinen vollständigen Levelnachweis.
