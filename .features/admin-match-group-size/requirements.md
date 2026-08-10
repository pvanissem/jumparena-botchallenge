# Requirements: admin-match-group-size

## Kontext

Bezug: `docs/09-bot-artefakt-und-turnier.md` (Turniermodus: Single-Elimination,
Gruppen à max. 4 Bots gleichzeitig), `docs/07-offene-punkte.md` (Technisches
Risiko "Performance bei 4 parallelen Kameras/Workern"),
`.features/tournament-runner/` und `.features/tournament-lives/` (bestehende
Turnier-Konfiguration).

Heute ist die Anzahl der gleichzeitig gegeneinander antretenden Bots fest im
Server-Code verdrahtet:

```ts
// server/src/tournament/SingleEliminationStrategy.ts
export const MAX_GROUP_SIZE = 4;
```

Der Wert wird an zwei Stellen genutzt (`createRounds()` für die erste Runde und
`createRoundFromParticipants()` für alle Folgerunden) und ist im Admin-UI
nirgends sichtbar oder änderbar. `TournamentSetup.tsx` erlaubt derzeit nur die
Auswahl von Level, Leben pro Lauf und Teilnehmern.

Am Stand ist es aber situativ sinnvoll, die Gruppengröße zu variieren: Mit 2
Bots pro Match sind die Duelle übersichtlicher und die Kacheln größer (besser
für kleinere Bildschirme und schwächere Hardware), mit 4 Bots pro Match geht
das Turnier schneller durch und wirkt actionreicher.

Ziel dieses Features: Die Gruppengröße wird im `/admin`-Turnier-Setup über eine
Auswahl zwischen **2** und **4** Bots pro Match einstellbar und für das gesamte
Turnier verbindlich angewendet.

## User Stories

### US-1: Gruppengröße im Admin-Setup auswählen

Als Betreiber am Stand möchte ich beim Aufstellen eines Turniers auswählen, ob
2 oder 4 Bots gleichzeitig gegeneinander antreten, damit ich Ablaufgeschwindigkeit
und Übersichtlichkeit an die jeweilige Situation anpassen kann.

Akzeptanzkriterien:

- WHEN das Turnier-Setup in `/admin` angezeigt wird SHALL DAS SYSTEM eine
  Auswahl "Bots pro Match" mit genau den beiden Optionen 2 und 4 als Buttons
  darstellen.
- WHEN das Turnier-Setup erstmals angezeigt wird SHALL DAS SYSTEM 4 als
  vorausgewählte Gruppengröße anzeigen (bisheriges Verhalten bleibt Default).
- WHEN der Betreiber eine der beiden Optionen auswählt SHALL DAS SYSTEM diese
  Option als aktiv hervorheben und die jeweils andere als inaktiv darstellen.
- WHEN der Betreiber das Turnier mit "Turnier aufstellen" startet SHALL DAS
  SYSTEM die ausgewählte Gruppengröße zusammen mit Level, Teilnehmern und Leben
  pro Lauf an den Server übermitteln.

### US-2: Gruppengröße wird auf das gesamte Bracket angewendet

Als Betreiber möchte ich, dass die gewählte Gruppengröße für alle Runden des
Turniers gilt, damit das Turnier durchgängig nach derselben Regel abläuft.

Akzeptanzkriterien:

- WHEN der Server ein Turnier mit Gruppengröße N (N ∈ {2, 4}) konfiguriert
  SHALL DAS SYSTEM die erste Runde in Matches mit höchstens N Teilnehmern
  aufteilen.
- WHEN nach Abschluss einer Runde eine Folgerunde aus den Siegern gebildet wird
  SHALL DAS SYSTEM auch diese Runde in Matches mit höchstens N Teilnehmern
  aufteilen.
- WHEN die Teilnehmerzahl einer Runde nicht glatt durch N teilbar ist SHALL DAS
  SYSTEM das bestehende Verhalten beibehalten (letztes Match ist kleiner; ein
  einzelner übrig bleibender Teilnehmer erhält wie bisher ein Freilos mit
  sofort finalem Match-Ergebnis).
- WHEN ein Turnier ohne explizite Gruppengröße konfiguriert wird (z. B. durch
  einen älteren Client) SHALL DAS SYSTEM die bisherige Standardgröße 4
  verwenden.

### US-3: Ungültige Gruppengrößen werden abgelehnt

Als Betreiber möchte ich, dass der Server unsinnige Gruppengrößen nicht
akzeptiert, damit kein kaputtes Bracket entsteht.

Akzeptanzkriterien:

- WHEN eine Turnier-Konfiguration mit einer Gruppengröße außerhalb der
  erlaubten Werte (2 oder 4) beim Server eintrifft SHALL DAS SYSTEM die
  Konfiguration ablehnen und den bisherigen Turnierzustand unverändert lassen.
- WHEN eine Turnier-Konfiguration mit einer nicht-numerischen Gruppengröße beim
  Server eintrifft SHALL DAS SYSTEM die Konfiguration ablehnen.
- WHEN eine Turnier-Konfiguration abgelehnt wird SHALL DAS SYSTEM den Grund wie
  bei den bestehenden Ablehnungen (zu wenige Teilnehmer, ungültige Leben) auf
  dem Server protokollieren.

### US-4: Darstellung im Match-Grid folgt der Gruppengröße

Als Zuschauer möchte ich, dass bei 2 Bots pro Match auch nur zwei (entsprechend
größere) Kacheln angezeigt werden, damit der Bildschirmplatz sinnvoll genutzt
wird.

Akzeptanzkriterien:

- WHEN ein Match mit 2 Teilnehmern in `/present` läuft SHALL DAS SYSTEM das
  bestehende 2-Kachel-Layout aus `computeGridViewports` nutzen (zwei Kacheln
  nebeneinander über die volle Höhe).
- WHEN ein Match mit 3 oder 4 Teilnehmern läuft SHALL DAS SYSTEM unverändert das
  bestehende 2×2-Layout nutzen.

## Nicht-Ziele

- Keine frei eingebbare Gruppengröße (kein Zahlenfeld, keine Werte wie 3, 5, 6,
  8) – bewusst nur die beiden Optionen 2 und 4. Grund: Für andere Werte gibt es
  weder ein erprobtes Grid-Layout noch eine Performance-Aussage
  (siehe `docs/07-offene-punkte.md`, Risiko "Performance bei 4 parallelen
  Kameras/Workern").
- Keine Änderung der Gruppengröße bei bereits laufendem Turnier (die Auswahl
  gilt ab dem Aufstellen; danach ist sie für dieses Turnier fix).
- Keine Änderung an der Scoring-Formel, an der Rangfolge-Logik oder am
  Freilos-Verhalten.
- Keine neuen Grid-Layouts in `computeGridViewports` (die vorhandenen Layouts
  für 1, 2 und 3–4 Teilnehmer decken beide Optionen bereits ab).
- Keine Änderung an der Anzeige des Ergebnis-Fensters pro Kachel (siehe dafür
  das separate Feature `.features/present-racer-tile-overlay/`).

## Entschiedene Fragen

- **`groupSize` im `TournamentState`:** Ja. Nicht nur zur Dokumentation der
  Konfiguration, sondern technisch nötig – `TournamentStrategy.advance()`
  bekommt nur den `TournamentState` und müsste sonst in Runde 2+ raten, mit
  welcher Gruppengröße die Folgerunde gebildet wird (US-2). *(entschieden)*
- **Ort der Validierung:** `@arena/shared`, analog zu `isValidLivesPerRun`,
  damit `/admin` und Server nicht auseinanderdriften. *(entschieden)*
- **Performance-Hinweis bei Auswahl von 4:** Nein (YAGNI/KISS). 4 ist der
  bisherige, erprobte Default; ein Warnhinweis am Normalfall wäre am Stand nur
  störend. *(entschieden)*
