# Tasks: Turnier-Steuerung am Messestand

Direktstart durch „Bau!“ am 29.09.2026 freigegeben.

- [x] 1. Freigegebene Requirements und besprochenes Design dokumentieren.
- [x] 2. Tests für Runner-Abbruch und Button schreiben (rot), vorzeitigen
      Match-Abschluss implementieren (grün), Cleanup prüfen (US-1).
- [x] 3. Tests für Zusatzduell, Startschutz und Show-Fortsetzung schreiben
      (rot), Strategie und Service anpassen (grün), refaktorieren (US-2).
- [x] 4. Betroffene Tests, Build und Codeprüfungen ausführen; fachliche
      Dokumentation aktualisieren und Akzeptanzkriterien abgleichen.

- [x] 5. Sammelauswahl mit nachträglich eingetroffenen Bots und individuellem
      Abwählen testen (rot), Button implementieren (grün), Komponententests,
      Codeprüfung und Client-Build ausführen (US-3; Direktstart freigegeben).

## Ergebnis und Akzeptanzabgleich

- US-1 (korrigiert gemäß `bugfix.md`): Button in der Admin-Show-Steuerung,
  Weiterleitung an die ausführende MatchView; aktuelle Wertung inklusive
  DNF-Defaults; einmaliger Abschluss und Szenen-/Worker-/Timer-Cleanup.
- US-2: Einzelgruppe wartet; Gegnerauswahl nach Score/Zeit/stabiler
  Reihenfolge; Zusatzduell bleibt in Runde 1; danach reguläres Vorrücken.
- 249 Tests in 44 betroffenen Testdateien erfolgreich. Nach abschließender
  Testbereinigung nochmals 83 Tests in den fünf direkt geänderten
  Testdateien erfolgreich.
- Vollständiger Workspace-Build erfolgreich; nach der abschließenden
  CSS-Anpassung Client-Build erneut erfolgreich. Vite meldet die bestehende
  Größenwarnung für das Hauptbundle.
- Biome-Prüfung der zehn geänderten Code-/CSS-Dateien ohne Fehler; eine
  bereits vorhandene Non-null-Assertion-Warnung in TournamentService.test.ts.
- `git diff --check` erfolgreich.
- Kein manueller Browser-/Phaser-Sichttest ausgeführt.
- US-3: „Alle hinzufügen“ wählt sämtliche aktuellen Bots einschließlich
  späterer Uploads aus; individuelle Abwahl bleibt möglich. Leere Liste,
  entfernte Bots und separat ausgelöstes Aufstellen sind abgedeckt.
  12 Komponenten-/Admin-Tests, Biome-Prüfung und Client-Build erfolgreich.
