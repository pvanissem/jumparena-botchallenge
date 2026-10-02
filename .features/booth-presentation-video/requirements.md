# Requirements: Präsentationsvideo für den Messestand

## Status

Freigegeben durch den Nutzer am 28.09.2026: „Das passt, bau das mal.“
Wiedergabe bestätigt: über einen Rechner per HDMI am C-Touch.
Der vorgeschlagene 60-Sekunden-Loop in 16:9 / Full HD bildet die Grundlage.

## Kontext

Bezug: `docs/01-konzept.md` (Zielgruppe, Idee und Besucherworkflow),
`docs/09-bot-artefakt-und-turnier.md` (Turnier) sowie
`.features/tournament-show-flow/requirements.md` (Pixel Arena Broadcast).

Ein kurzes Präsentationsvideo soll auf dem großen C-Touch-Display am Stand
in Dauerschleife laufen. Es soll vorbeigehende Besucher neugierig machen und
verständlich zeigen, wie sie mit devkcode einen eigenen Bot erstellen und
am Spiel teilnehmen können. Die Ansprache richtet sich auch an Menschen
ohne Programmierkenntnisse.

## User Stories

### US-1: Die Idee in wenigen Sekunden verstehen

Als vorbeigehender Besucher möchte ich unmittelbar erkennen, was ich am
Stand ausprobieren kann, damit ich Lust zum Mitmachen bekomme.

Akzeptanzkriterien:

- WHEN das Video beginnt SHALL DAS SYSTEM „Coin Quest Arena“ und die
  Kernbotschaft „Deine Strategie. Dein Bot. Dein Rennen.“ sichtbar zeigen.
- WHEN das Video das Angebot erklärt SHALL DAS SYSTEM deutlich machen,
  dass Besucher ihre Strategie in eigenen Worten beschreiben und devkcode
  daraus Bot-Code erstellt.
- WHEN Teilnahmevoraussetzungen genannt werden SHALL DAS SYSTEM vermitteln,
  dass keine eigenen Programmierkenntnisse erforderlich sind.
- WHEN ein Besucher mitten in den Loop einsteigt SHALL DAS SYSTEM durch
  eigenständig verständliche Szenentexte und einen wiederkehrenden Spielnamen
  Orientierung bieten.

### US-2: Den Weg von der Idee bis zum Turnier sehen

Als Besucher möchte ich den Ablauf am Stand verstehen, damit ich weiß,
was mich an einer Station erwartet.

Akzeptanzkriterien:

- WHEN der Ablauf gezeigt wird SHALL DAS SYSTEM die Schritte Strategie
  beschreiben, Bot mit devkcode erstellen, ausprobieren und verbessern sowie
  im Turnier antreten in dieser Reihenfolge vermitteln.
- WHEN eine Beispielstrategie gezeigt wird SHALL DAS SYSTEM einen kurzen,
  alltagssprachlichen Auftrag verwenden, etwa „Sammle viele Früchte und
  geh möglichst wenig Risiko ein.“
- WHEN das Spiel dargestellt wird SHALL DAS SYSTEM visuell an die vorhandenen
  Spielfiguren, Level und Sammelobjekte anknüpfen.
- WHEN Wettkampf gezeigt wird SHALL DAS SYSTEM den aktuellen Turniergedanken
  mit bis zu vier Bots pro Match vermitteln; Spielausschnitte und Texte
  dürfen keinen abweichenden Spielmodus suggerieren.
- WHEN animierte Erklärbilder statt echter Spielaufnahmen eingesetzt werden
  SHALL DAS SYSTEM diese als Illustration erkennbar gestalten und keine
  erfundenen Ergebnisse als echte Besucher- oder Live-Ergebnisse ausgeben.

### US-3: Auf einem großen Display ohne Ton funktionieren

Als Standbetreiber möchte ich einen gut lesbaren, lautlos verständlichen
Clip, damit er neben Gesprächen am Stand laufen kann.

Akzeptanzkriterien:

- WHEN das Video ohne Ton abgespielt wird SHALL DAS SYSTEM sämtliche
  wesentlichen Aussagen durch Bild und eingeblendeten Text vermitteln.
- WHEN Text eingeblendet wird SHALL DAS SYSTEM pro Szene höchstens eine
  Hauptaussage und eine kurze ergänzende Zeile zeigen; ein illustrativer
  Strategieauftrag darf zusätzlich Teil des Bildmotivs sein.
- WHEN das Video gestaltet wird SHALL DAS SYSTEM kontrastreiche, große
  Schrift, sichere Randabstände und die Pixel-Ästhetik des Spiels verwenden.
- WHEN die Vorschau am C-Touch geprüft wird SHALL DAS SYSTEM die Haupttexte
  aus etwa drei bis fünf Metern Entfernung lesbar darstellen.
- WHEN Animationen oder Übergänge laufen SHALL DAS SYSTEM ausreichend
  ruhige Lesephasen bieten und auf Stroboskop- oder schnelle Blitzeffekte
  verzichten.

### US-4: Einfach abspielen und zum Mitmachen einladen

Als Standbetreiber möchte ich eine eigenständige Videodatei in Dauerschleife
abspielen können, damit die Standpräsentation wenig Betreuung benötigt.

Akzeptanzkriterien:

- WHEN das Video ausgeliefert wird SHALL DAS SYSTEM eine lokal abspielbare
  MP4-Datei in 16:9, 1920 × 1080 und 30 fps bereitstellen.
- WHEN ein kompletter Durchlauf endet SHALL DAS SYSTEM nach ungefähr
  60 Sekunden einen zur Eröffnung passenden Abschluss erreichen, sodass
  die Wiederholung ohne inhaltlichen Bruch möglich ist.
- WHEN der Abschluss gezeigt wird SHALL DAS SYSTEM mit „Welche Strategie
  gewinnt? Bau deinen Bot – hier am Stand.“ zur Teilnahme einladen.
- WHEN die Videodatei übergeben wird SHALL DAS SYSTEM eine kurze Anleitung
  für Vollbild und Dauerschleife auf dem vereinbarten Zuspielgerät mitliefern.
- WHEN das Video lokal abgespielt wird SHALL DAS SYSTEM ohne laufenden
  Spielserver oder Internetverbindung auskommen.

## Freigegebener inhaltlicher Ablauf

| Zeit | Aussage | Bildidee |
|---|---|---|
| 0–7 s | Deine Strategie. Dein Bot. Dein Rennen. | Spieltitel und animierte Spielfiguren |
| 7–18 s | Beschreib deine Idee. | Kurzer Strategieauftrag in einer stilisierten Eingabe |
| 18–28 s | devkcode macht daraus deinen Bot. | Aus dem Auftrag wird ein benannter Spielcharakter; „Keine Programmierkenntnisse nötig“ |
| 28–40 s | Ausprobieren. Verbessern. Loslegen. | Spielsituation mit Sammelobjekten und Hindernissen |
| 40–51 s | Dein Bot tritt im Turnier an. | Mehrere Bots in getrennten Spielansichten |
| 51–60 s | Welche Strategie gewinnt? | „Bau deinen Bot – hier am Stand.“ und Rückführung zum Titel |

## Nicht-Ziele

- Änderungen an Spielmechanik, Bot-Erstellung oder Turnierablauf.
- Automatischer Wechsel zwischen Video und laufendem Turnier.
- Interaktive Touch-Bedienung innerhalb des Videos.
- Verpflichtender Sprechertext oder eine zum Verständnis nötige Tonspur.

## Geklärte Fragen

- Wiedergabe: lokal auf einem Rechner, Bildausgabe per HDMI am C-Touch.
- Ausgabe: 16:9, Full HD, 30 fps.
- Dauer und Gestaltung: ungefähr 60 Sekunden, spielerisch mit vorhandenen
  Spielmotiven gemäß freigegebenem Ablauf.

## Offene Fragen

Keine fachlichen Blocker. Die Umsetzung der animierten Szenen wird im
Design festgelegt. Die Lesbarkeit am echten Display wird vor Ort geprüft.
