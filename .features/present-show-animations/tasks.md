# Tasks: Present-Show-Animationen

Requirements, Design und Direktstart sind freigegeben.

- [x] 1. Countdown-/Match-Identität und Champion-Dekoration testen (rot),
      stabile Keys und PresentCelebration implementieren (grün) (US-1, US-2).
- [x] 2. Present-spezifische Einflüge, Countdown, Sieger, Konfetti sowie
      Roster-/Bracket-Staffelung und Reduced Motion umsetzen (US-1 bis US-3).
- [x] 3. Regressionstests, Build und Codeprüfung durchführen; visuellen
      Prüfstatus und Akzeptanzabgleich dokumentieren.

## Akzeptanzabgleich und Verifikation

- US-1: Karten mit wechselnder Einflugrichtung, Staffelung und Lichtstreifen;
  jede Countdown-Ziffer erhält ihren eigenen einmaligen Zoom-/Ring-Auftritt.
  DOM-Identität bei Updates und Austausch bei neuer Begegnung sind getestet.
- US-2: Siegerüberschrift und Ergebniszeilen erscheinen gestaffelt;
  PresentCelebration zeigt 24 deterministische, dekorative Pixelpartikel
  für maximal 2,85 Sekunden sowie den einmaligen Kronen-/Strahlen-Auftritt.
  Ergebnis-Keys und Champion-spezifische Einbindung sind getestet.
- US-3: Roster-Staffelung ist bei 320 ms gedeckelt; Bracket-Runden werden
  ohne Positionsänderung eingeblendet. Neue Regeln sind Present-spezifisch;
  Live-Engine und Show-Timing bleiben unverändert. Reduced-Motion-Regeln
  deaktivieren die neuen Animationen und blenden bewegte Dekoration aus.
- 147 Tests in 34 Dateien erfolgreich, darunter Admin, Present, Match-Engine,
  Countdown, Ergebnis, Champion, Roster und Turnierbaum.
- Client-TypeScript-/Vite-Build erfolgreich. Bestehende Vite-Bundlegrößenwarnung.
- Biome-Prüfung der sieben betroffenen Code-/Test-/CSS-Dateien und
  `git diff --check` ohne Befund.

## Ausstehende manuelle Sichtprüfung

Kein Browser-Automationswerkzeug verfügbar; keine visuelle oder
Hardware-Performance-Prüfung durchgeführt.

- [ ] Intro und Countdown mit 2, 3 und 4 Bots am Messebildschirm ansehen.
- [ ] Ergebnis und Champion einschließlich langer Namen ansehen.
- [ ] Kleines Fenster und reduzierte Bewegung prüfen.
