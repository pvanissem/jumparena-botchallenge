# Bugfix: Überspringen aus der Admin-Ansicht steuern

Status: Durch „ja“ zur Umsetzung freigegeben.

## Aktuelles Verhalten (Bug)

„Überspringen“ befindet sich in der ausführenden `/present`-Ansicht.
Der Betreiber kann das laufende Match nicht aus `/admin` beenden.

## Erwartetes Verhalten

- WHEN ein Match läuft SHALL DAS SYSTEM „Überspringen“ in der
  Show-Steuerung von `/admin` anbieten.
- WHEN der Betreiber dort klickt SHALL DAS SYSTEM den Abbruchauftrag
  über den Server an die ausführende Present-Instanz übermitteln.
- WHEN die ausführende Instanz den Auftrag für ihren aktuellen
  Match-Versuch erhält SHALL DAS SYSTEM das Match mit der vorhandenen
  vorzeitigen DNF-Wertung beenden und regulär fortfahren.
- WHEN `/present` angezeigt wird SHALL DAS SYSTEM dort keinen
  Überspringen-Button darstellen.
- WHEN ein Auftrag nicht zum aktuellen Match-Versuch gehört SHALL DAS
  SYSTEM ihn ignorieren. Ohne ausführende Instanz ist die Aktion deaktiviert.

## Was bleibt unverändert (Regressions-Schutz)

Ergebnisberechnung, DNF-Regeln, einmaliger Ergebnisabschluss,
automatischer Show-Ablauf, Zusatzduell und „Alle hinzufügen“.

## Root Cause (nach Analyse)

Der Button wurde direkt in `MatchView` mit `MatchRunner.skip()` verbunden.
Es fehlt der Steuerpfad vom Admin zum Executor. Die ursprüngliche US-1
enthielt bereits die falsche Platzierung; diese Korrektur ersetzt sie.

## Fix-Ansatz

Button in `ShowControlPanel` integrieren und aus `MatchView` samt
zugehörigem Present-CSS entfernen. Einen typisierten, an Match-ID und
Attempt-ID gebundenen Skip-Auftrag ergänzen. Der Server prüft Admin-Rolle
und aktuellen Versuch und leitet nur an dessen Executor weiter.
Die Present-Seite empfängt den Auftrag über den WebSocket-Subscriber und
ruft den vorhandenen Runner-Abschluss auf, ohne die Engine neu zu starten.

Testgetrieben absichern: Admin-Klick und deaktivierte Aktion, kein Button
in Present, Nachrichtenvalidierung, Rollen-/Attempt-Prüfung, Weiterleitung
und Abschluss des aktuellen Versuchs. Anschließend betroffene Tests,
Build und Codeprüfung.

## Umsetzung und Verifikation

- [x] Admin-Button und an Match/Attempt gebundenen Server-Steuerpfad
  testgetrieben implementiert; Admin-Rolle und bereiten Executor geprüft.
- [x] Present-Button und dessen CSS entfernt; Subscriber ruft für den
  aktuellen Versuch den vorhandenen Runner-Abschluss auf.
- [x] 318 Tests in 38 Dateien erfolgreich, einschließlich bisheriger
  DNF-Wertung, einmaligem Abschluss und automatischer Show-Fortsetzung.
- [x] Vollständiger Workspace-Build erfolgreich; Biome für alle 13
  betroffenen Code-/Testdateien und `git diff --check` ohne Befund.
- [x] Requirements, Design und fachliche Dokumentation korrigiert.

Kein manueller Zwei-Browser-Sichttest ausgeführt. Vite meldet weiterhin
die Größenwarnung für das Hauptbundle.
