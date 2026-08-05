# 01 – Konzept

> **Hinweis (aktualisiert):** Der in diesem Dokument beschriebene 16-Bot-
> Heat-Modus (Schritt 4 "Rennen (Heat)" sowie die entsprechende Zeile in den
> "Kernentscheidungen") ist durch den **Turniermodus** (Single-Elimination,
> max. 4 Bots gleichzeitig pro Match) abgelöst worden – siehe
> `docs/09-bot-artefakt-und-turnier.md`, Abschnitt "Turniermodus", und
> `docs/07-offene-punkte.md`. Die übrigen Abschnitte dieses Dokuments (Idee,
> Ablauf am Stand, Zielgruppe) bleiben unverändert gültig.

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
2. **Export:** devkcode erzeugt eine Bot-Datei (`.js`, Funktion `decide(state)`), die der
   Besucher behält bzw. die ins Renn-System eingepflegt wird.
3. **Einpflegen:** Vor dem nächsten Rennen werden alle neuen Bot-Dateien in die
   Phaser-Anwendung importiert (Ordner-Scan/Upload).
4. **Rennen (Heat):** 16 Bots treten gleichzeitig im gleichen Level an, sichtbar in einem
   Grid aus Mini-Ansichten auf einem großen Screen am Stand.
5. **Auswertung:** Punkte pro Bot (Collectibles + Zeitbonus − Fehlversuch-Abzüge) werden auf
   einem laufenden Leaderboard aggregiert (über mehrere Heats hinweg).

## Kernentscheidungen (Ergebnis des Brainstormings)

| Thema | Entscheidung | Begründung |
|---|---|---|
| Bot-Erzeugung | devkcode-Profil generiert eine JS-Funktion `decide(state)` | Nutzer braucht keine Programmierkenntnisse, fühlt sich aber wie "echtes Coden" an |
| Ausführungsort | Vollständig clientseitig (Browser) | Keine Server-Infrastruktur am Stand nötig, einfacher Aufbau |
| Sandbox | Bot-Code läuft in einem Web Worker mit striktem Timeout pro Tick | Sicherheit, kein Absturz/Endlosschleifen-Risiko im Hauptthread |
| Bot-Interaktion | Keine Kollision zwischen Bots | Vereinfacht Simulation, vermeidet Frust durch "Blockieren" |
| Darstellung | Grid aus Mini-Ansichten, ein Fenster | Guter Kompromiss aus Übersicht und Performance |
| Parallelität | Heats à 16 Bots (bei 50–100 Anmeldungen mehrere Runden) | Performance-Grenze für gleichzeitiges Rendering/Simulation |
| Level-Stil | Mario-artiges 2D-Tilemap-Level | Bekannt, verständlich, gut visualisierbar |
| Collectibles | Sichtbare Münzen + versteckte Münzen in Blöcken (Mario-Style) | Mehr Strategie-Tiefe für die Bots |
| Tick-Rate | Fixer Simulations-Tick (~150ms) für Bot-Entscheidungen, Rendering läuft mit 60fps | Fairness/Determinismus unabhängig von Browser-Last, einfacher für generierten Code |
| Scoring | Collectibles + Zeitbonus − Tod/Fehlversuch-Abzug | Belohnt sowohl Vollständigkeit als auch Geschwindigkeit |

## Zielgruppe & Ton

- Nicht-technische bis leicht-technische Konferenzbesucher (Vertrieb, Fachbereiche, Management).
- Spaßfaktor und Show-Effekt am Stand stehen im Vordergrund, nicht Code-Qualität.
- Sekundärziel: Vertrauen/Verständnis für AI-gestützte Entwicklung mit `devkcode` aufbauen.
