# 01 – Konzept

Aktueller Besucherworkflow: eine Bot-Datei, gemeinsame Framework-Navigation und
Single-Elimination mit maximal vier Bots pro Match. Details in
[02-bot-api.md](02-bot-api.md), [04-devkcode-profil.md](04-devkcode-profil.md) und
[09-bot-artefakt-und-turnier.md](09-bot-artefakt-und-turnier.md).

## Idee

Beim Messestand auf der DEVK-internen Konferenz bauen Besucher – ganz ohne eigene
Programmierkenntnisse – mit Hilfe der `devkcode`-CLI und einem eigens dafür konfigurierten
Agent-Profil einen autonomen Bot. Dieser Bot tritt anschließend in einer Phaser.js-basierten
Arena gegen die Bots anderer Besucher an. Ziel: möglichst viele Collectibles einsammeln und
so schnell wie möglich das Levelziel erreichen.

Der Clou: Die Besucher konzentrieren sich rein auf die **fachliche Anforderung/Strategie**
("sammle alle Münzen, weiche Gegnern aus, geh den kürzesten Weg") – `devkcode` übersetzt das
in lauffähigen Bot-Code. Damit wird die CLI selbst zur Attraktion des Standes.

## Ablauf am Stand

1. **Vibe Coding (15–20 Min):** Besucher setzt sich an eine Station, startet `devkcode` mit
   dem Bot-Profil, beschreibt in natürlicher Sprache seine Strategie, iteriert ggf. kurz.
2. **Bauen und ausprobieren:** Botname und Strategie klaeren, dann genau
   `client/src/bot/current-bot.js` bearbeiten. `decide(state, tools)` waehlt
   Ziele und Routen, das Framework uebernimmt die Motorik. Speichern laedt
   `/code` automatisch neu. Gemeinsam den Lauf ansehen, vorhandene Traces unter
   `client/src/bot/runs/` lesen, kurz erklaeren und eine Verbesserung vorschlagen.
   Eine vorhandene Arbeitsdatei bleibt erhalten; die neue Vorlage ist nicht
   automatisch der aktuell laufende Bot. Reset nur auf expliziten Betreiberwunsch.
3. **Einpflegen:** Vor dem nächsten Rennen werden alle neuen Bot-Dateien in die
   Phaser-Anwendung importiert (Ordner-Scan/Upload).
   Abgegeben werden dieselben unveraenderten Bytes der Arbeitsdatei, ohne Export-
   oder Buildschritt und ohne beigelegte Navigationsbibliothek.
4. **Turnier:** Zwei oder vier Bots treten pro Match im gleichen Level mit
   getrennten Welten an, sichtbar im Grid. Der Erstplatzierte kommt weiter.
5. **Auswertung:** Matchpunkte (Fruechte, Zeitbonus und Todes-/DNF-Abzuege)
   bestimmen das Weiterkommen im Turnier und den abschliessenden Champion.

## Kernentscheidungen (Ergebnis des Brainstormings)

| Thema | Entscheidung | Begründung |
|---|---|---|
| Bot-Erzeugung | Eine JS-Datei mit Metadaten und `decide(state, tools)` | Individuelle Strategie ohne neu geschriebene Sprungphysik |
| Navigation | Versionierte Tools im Framework, `choose(context, options)` im Bot | Ziele, Risiko, Fruchtwert und Endspurt bleiben programmierbar |
| Ausführungsort | Simulation im Browser, Hub fuer Turnier/Registry | Keine Server-Physik, lokale Vorschau bleibt unabhaengig |
| Sandbox | Bot-Code laeuft im Worker mit Timeout | Blockierenden Worker beenden, kein umfassendes Sicherheitsversprechen |
| Bot-Interaktion | Keine Kollision zwischen Bots | Vereinfacht Simulation, vermeidet Frust durch "Blockieren" |
| Darstellung | Grid aus Mini-Ansichten, ein Fenster | Guter Kompromiss aus Übersicht und Performance |
| Parallelität | Maximal vier Bots pro Turniermatch | Getrennte Welten und nachvollziehbarer Vergleich |
| Level-Stil | Mario-artiges 2D-Tilemap-Level | Bekannt, verständlich, gut visualisierbar |
| Collectibles | Sichtbare Münzen + versteckte Münzen in Blöcken (Mario-Style) | Mehr Strategie-Tiefe für die Bots |
| Tick-Rate | Bot-Intervall ~33 ms, Arcade-Physikraster 60 Hz | Botentscheidung, Physik und Workerantwort werden getrennt korreliert |
| Scoring | Collectibles + Zeitbonus − Tod/Fehlversuch-Abzug | Belohnt sowohl Vollständigkeit als auch Geschwindigkeit |

## Zielgruppe & Ton

Sprinter, Sammler und Vorsichtiger liegen als vollstaendige Referenzbots unter
`examples/strategies/`. `/code` verwendet unveraendert das urspruengliche Level 1.
Beobachtete Laeufe und Traces erklaeren das
Verhalten; Unit-/Runtime-Tests belegen weder Zielerreichung noch Standperformance.
Nicht ausgefuehrte Browser- oder Lastpruefungen bleiben ausdruecklich offen.

- Nicht-technische bis leicht-technische Konferenzbesucher (Vertrieb, Fachbereiche, Management).
- Spaßfaktor und Show-Effekt am Stand stehen im Vordergrund, nicht Code-Qualität.
- Sekundärziel: Vertrauen/Verständnis für AI-gestützte Entwicklung mit `devkcode` aufbauen.
