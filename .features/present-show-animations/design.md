# Design: Present-Show-Animationen

Status: Durch „ja“ freigegeben; Direktstart bestätigt.
Bezug: freigegebene `requirements.md`, US-1 bis US-3.

## Architektur und Stil

Die vorhandenen React-Ansichten und die CSS-Datei
`client/src/styles/present-broadcast.css` bilden die Grundlage.
Die Inszenierung verwendet Neon-Cyan, Pink und Gold aus den bestehenden
Theme-Variablen, kantige Formen und kurze, kontrollierte Overshoots.
Bewegung entsteht überwiegend durch `transform` und `opacity`.

Neue Animationsregeln sind auf `.event-chrome` beziehungsweise eigene
`present-celebration`-Klassen begrenzt. Gemeinsame Ergebnis- und
Champion-Komponenten behalten in `/admin` ihr bisheriges Erscheinungsbild.
Keine neuen Bibliotheken, Servernachrichten, Audio-Cues oder Spiel-Timer.

## US-1: Einflug und Countdown

### Matchup

- Teilnehmerkarten fliegen abwechselnd aus linker und rechter Richtung ein,
  kombiniert mit kleiner Rotation und einem kurzen Überschwingen.
- Dauer etwa 650 ms, Staffelung 100 ms je Karte; auch die vierte Karte
  steht nach weniger als einer Sekunde ruhig und vollständig lesbar.
- Ein einmaliger Lichtstreifen über den Kartenrahmen verstärkt den Auftritt.
  Dekorative Pseudoelemente liegen hinter dem Text und fangen keine Eingaben ab.
- `PresentStage` vergibt für `MatchupStage` einen stabilen React-Key anhand
  der Match-ID. Änderungen am selben Match und der Übergang vom Intro zum
  Countdown ersetzen die Karten nicht. Erst eine neue Begegnung startet
  deren Einflug erneut.

### Countdown

- Die vorhandene Countdown-Anzeige bleibt an `useShowCountdown` und damit
  an die serverseitige Deadline gebunden.
- Nur die Ziffer bekommt einen React-Key anhand ihres Werts. Jede neue Zahl
  löst etwa 450 ms Zoom-Impuls mit kurzem Overshoot aus.
- Ein dekorativer Ring expandiert und verblasst innerhalb etwa 700 ms.
  Die Ziffer bleibt nach dem Impuls sichtbar; ein angehaltener Countdown
  pulsiert nicht dauerhaft.
- Die Zentrierung mittels `translate(-50%, -50%)` bleibt in sämtlichen
  Keyframes erhalten. Die Anzeige verschiebt keine Teilnehmerkarten.
- Das bestehende Timer-Label und die zugängliche Countdown-Zahl bleiben
  erhalten. Es entsteht keine zusätzliche „Go“-Phase und keine Verzögerung
  des tatsächlichen Matchstarts.

## US-2: Ergebnis und Champion

### Match-Ergebnis

- Die Überschrift erscheint mit einem etwa 550 ms langen Scale-/Slide-Auftritt.
- Ergebniszeilen folgen mit kurzen, versetzten Einblendungen. Alle Zeilen
  sind innerhalb einer Sekunde sichtbar und ruhen danach.
- Die Siegerzeile erhält einen einmaligen Lichtstreifen; Score, Namen und
  Platzierung bleiben echte, unveränderte Textinhalte.
- Ergebnisansichten erhalten in `PresentStage` einen Key aus der Match-ID,
  damit aufeinanderfolgende Ergebnisse jeweils ihren eigenen Auftritt haben,
  normale State-Updates jedoch keinen Neustart auslösen.

### Champion-Finale

Eine kleine Present-spezifische Komponente `PresentCelebration` umschließt
die vorhandene `ChampionView` ausschließlich im Champion-Zweig von
`PresentStage`:

```tsx
<PresentCelebration key={tournament.championBotId}>
  <ChampionView state={tournament} />
</PresentCelebration>
```

- Eine begrenzte, deterministische Menge von 24 Pixel-Konfetti-Elementen
  bildet einen einmaligen Ausbruch mit maximal etwa 3 Sekunden Gesamtdauer.
  Position, Verzögerung und Drehrichtung werden aus dem Elementindex
  abgeleitet; kein `Math.random()` während des Renderns, kein Intervall.
- Die Partikel liegen in einer eigenen Dekorationsebene mit
  `aria-hidden="true"` und `pointer-events: none` hinter den Inhalten.
  Nach der Animation sind sie unsichtbar; beim Verlassen der Phase wird
  die gesamte Ebene mit der Komponente entfernt.
- Ein Strahlenkranz im Hintergrund dreht sich beim Auftritt einmal kurz
  und bleibt dann als ruhige, dezente Dekoration stehen.
- Die Krone landet mit kurzem Overshoot; der Gewinnername erhält einen
  nachfolgenden Zoom-Auftritt. Die bisherige endlose Kronenbewegung wird
  nur im Present-Kontext durch diesen einmaligen Auftritt ersetzt.
- Namen können umbrechen; Dekoration wird am äußeren Rahmen beschnitten,
  während die Inhalte ihren regulären Platz im Layout behalten.

## US-3: Warteliste, Bracket und Betrieb

- Roster-Karten erhalten kurze Einblendungen mit begrenzter Staffelung.
  Bei großen Listen wird die Verzögerung gedeckelt, damit die letzten
  Teilnehmer nicht lange unsichtbar bleiben. Bot-IDs bleiben stabile Keys;
  neue Uploads animieren nur ihre neu eingefügten Karten.
- Die maximal drei sichtbaren Present-Bracket-Runden erscheinen gestaffelt.
  Vorhandene Verbindungslinien und Layoutmessungen bleiben erhalten;
  die Animation verschiebt keine vermessenen Match-Knoten.
- Die Live-Ansicht, Kameras und `MatchView` erhalten keine neue
  Eingangsanimation und keinen übergreifenden, wechselnden Wrapper-Key.
  Die Phaser-Engine darf wegen einer Animation nicht neu gemountet werden.
- Keine Animation blockiert den Phasenwechsel. Schnelles „Sofort weiter“
  entfernt die vorherigen Effekte mit dem zugehörigen DOM.
- Für kleine Viewports werden Einflugdistanz und dekorative Größen reduziert;
  bestehende Grids für zwei, drei und vier Teilnehmer bleiben bestehen.

## Reduzierte Bewegung

Am Ende der Present-Styles steht ein expliziter
`@media (prefers-reduced-motion: reduce)`-Block für alle neuen animierten
Elemente und Pseudoelemente:

- Animationen und dekorative Übergänge deaktivieren.
- Konfetti, Countdown-Ring und Lichtstreifen ausblenden.
- Inhalte direkt sichtbar darstellen; die nötige statische
  Countdown-Zentrierung bewahren.
- Statischer, schwacher Strahlenhintergrund ist möglich, ohne Rotation.

## Teststrategie und Umsetzung

Tests vor den jeweiligen Änderungen an React-Verhalten:

1. `MatchupStage.test.tsx`: Bei unveränderter Countdown-Zahl bleibt der
   Timer-DOM-Knoten erhalten; bei neuer Zahl wird nur dieser ersetzt.
   Die Teilnehmerkarten bleiben beim Countdown-Wechsel erhalten.
2. `PresentPage.test.tsx`: Dieselbe Begegnung behält ihre Intro-Knoten
   bei State-Updates; neue Begegnungen erhalten einen neuen Auftritt.
   Die bestehenden Tests gegen Neustarts der Match-Engine bleiben grün.
3. `PresentCelebration.test.tsx`: Dekoration ist begrenzt, verborgen für
   Screenreader und bei erneutem Rendern stabil; Inhalt und Gewinnername
   bleiben erhalten. Beim Unmount werden alle Partikel entfernt.
4. Vorhandene Tests für Champion, Ergebnisse, Roster, Countdown und
   Bracket als Regressionstests ausführen.
5. TypeScript-/Client-Build, gezielte Biome-Prüfung und `git diff --check`.

CSS-Bewegung und Lesbarkeit benötigen zusätzlich eine Browser-Sichtprüfung:
Intro/Countdown für 2–4 Bots, Ergebnis, Champion, kleines Fenster und
reduzierte Bewegung. React-/JSDOM-Tests bestätigen keine visuelle Qualität.
Falls kein Browserzugriff verfügbar ist, bleibt diese Prüfung ausdrücklich
als manuell ausstehend dokumentiert.

## Betroffene Dateien

- `client/src/styles/present-broadcast.css`
- `client/src/components/tournament/MatchupStage.tsx` und Tests
- `client/src/components/tournament/PresentCelebration.tsx` und Tests (neu)
- `client/src/components/RosterAttractView.tsx` (Staffelungsindex, falls nötig)
- `client/src/pages/PresentPage.tsx` und Tests

Nach Freigabe dieses Designs wird `tasks.md` erstellt und gemäß dem
bereits gewünschten Direktstart testgetrieben umgesetzt.
