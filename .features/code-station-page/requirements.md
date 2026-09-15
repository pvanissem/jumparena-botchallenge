# Requirements: code-station-page

## Kontext

Bezug: `docs/01-konzept.md` (Ablauf am Stand), `docs/03-architektur.md` (Client-Routen),
`docs/06-level-design.md` (Level-Registry), `.features/dev-station-mode/`.

Heute gibt es die Route `/dev` (`client/src/pages/DevPage.tsx`) als Entwickler-/Debug-Ansicht:
Modus-Umschalter (Selbst/Bot), **Level-Auswahl**, Neu-Start, Audio, Score-HUD,
Bot-Diagnose/Trace-Status, Arena, Hazard-Legende. Die Phaser-Arcade-Physik läuft dort mit
`debug: true`, d.h. Hitboxen/Velocity-Vektoren werden eingezeichnet.

Für den Messestand brauchen die Besucher eine aufgeräumte Variante dieser Seite:
keine Level-Auswahl (immer Level 1) und keine Physik-Debug-Overlays. `/dev` bleibt
unverändert als Entwickler-Ansicht bestehen.

## User Stories

### US-1: Eigene Messestand-Route `/code`

Als Messestand-Besucher möchte ich unter `/code` eine Arena-Seite öffnen, damit ich meinen
Bot testen kann, ohne Entwickler-Werkzeuge zu sehen.

Akzeptanzkriterien:
- WHEN der Client die Route `/code` rendert SHALL DAS SYSTEM die Messestand-Arena-Seite
  anzeigen (Modus-Umschalter Selbst/Bot, Neu-Start, Audio-Controls, Score-HUD,
  Bot-Diagnose- und Trace-Status, Arena, Hazard-Legende).
- WHEN ein Nutzer `/dev` aufruft SHALL DAS SYSTEM weiterhin die unveränderte
  Entwickler-Seite inklusive Level-Auswahl und Physik-Debug-Overlay anzeigen.
- WHEN der Server (Dev- oder Static-Server) eine Anfrage auf `/code` erhält SHALL DAS
  SYSTEM den SPA-Einstiegspunkt (`index.html`) mit Status 200 ausliefern.

### US-2: Keine Level-Auswahl, immer Level 1

Als Messestand-Betreiber möchte ich, dass auf `/code` immer Level 1 läuft, damit alle
Besucher dieselbe Ausgangslage haben und sich nicht "verklicken" können.

Akzeptanzkriterien:
- WHEN die Seite `/code` gerendert wird SHALL DAS SYSTEM kein Level-Auswahl-Element
  anzeigen.
- WHEN die Arena auf `/code` gestartet oder neu gestartet wird SHALL DAS SYSTEM immer
  `DEFAULT_LEVEL_ID` (Level 1) verwenden.

### US-3: Kein Phaser-Physik-Debug-Overlay

Als Messestand-Besucher möchte ich die Arena ohne eingezeichnete Debug-Hitboxen sehen,
damit das Spiel wie ein fertiges Spiel wirkt.

Akzeptanzkriterien:
- WHEN die Arena auf `/code` erzeugt wird SHALL DAS SYSTEM die Arcade-Physik mit
  `debug: false` konfigurieren.
- WHEN die Arena auf `/dev` erzeugt wird SHALL DAS SYSTEM weiterhin `debug: true`
  verwenden.

## Nicht-Ziele

- Keine Änderung am Bot-Artefakt-Format, an der Sandbox oder am Scoring.
- Keine Änderung an `/present` oder `/admin`.
- Kein eigenes visuelles Redesign der Messestand-Seite über das Entfernen der
  Level-Auswahl hinaus.

## Geklärte Fragen (Entscheidungen)

- `/` leitet künftig auf `/code` um (statt auf `/dev`) – Messestand ist der Regelfall.
  Ergänzendes Akzeptanzkriterium zu US-1:
  - WHEN ein Nutzer `/` aufruft SHALL DAS SYSTEM auf `/code` umleiten.
- `/code` verwendet weiterhin unendlich viele Leben wie `/dev` (Testlauf, keine
  Turnier-Wertung).
- Umsetzung DRY über eine gemeinsame Komponente mit Varianten-Prop, kein Datei-Duplikat.
