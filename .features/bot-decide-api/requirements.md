# Requirements: Bot-Decide-API (Contract + Sandbox)

## Kontext

Kernidee des Projekts (siehe `docs/01-konzept.md`) ist, dass Standbesucher ohne eigene
Programmierkenntnisse mit Hilfe von `devkcode` eine einzelne Funktion `decide(state)`
erzeugen, die anschließend gegen andere Bots antritt. `docs/02-bot-api.md` definiert den
State/Action-Contract, `docs/09-bot-artefakt-und-turnier.md` das Modul-Format
(`{ apiVersion, name?, author?, color?, decide }`) sowie die Sandbox-Anforderungen
(Web Worker, statischer Guard, Timeout-/Fehlertoleranz, harter Kill bei Endlosschleifen).

Dieses Feature liefert die **fundamentale, spielunabhängige Schicht**: den Bot-Contract
(Typen + Validierung) als eigenständiges Package `@arena/bot-contract`, sowie die
Worker-Sandbox, die eine beliebige `decide`-Implementierung sicher, zeitlich begrenzt und
fehlertolerant ausführt. Es enthält **keine** Spiellogik (kein Level, kein Rendering, keine
Hazards) – die Anbindung an ein echtes Level erfolgt im Folge-Feature `level-one-arena`.

Architektur-Vorgabe für dieses und alle folgenden Features: striktes SOLID-Design,
Clean-Code-Standards (Uncle Bob), YAGNI/DRY/KISS – siehe US-6.

## User Stories

### US-1: Bot-Contract-Typen als zentrale, wiederverwendbare Quelle

Als Entwicklerteam möchte ich `BotState`, `Action`, `TileType`, `HazardKind`,
`UtilityKind` und das Bot-Modul-Format als benannte TypeScript-Typen in einem eigenen
Package definiert haben, damit Client (und potenziell später weitere Prozesse) denselben
Contract nutzen, ohne ihn zu duplizieren.

Akzeptanzkriterien:
- WHEN das Package `@arena/bot-contract` gebaut wird SHALL DAS SYSTEM die Typen
  `BotState`, `Action`, `TileType`, `NearestCoin`, `NearestHazard`, `NearestUtility`,
  `HazardKind`, `UtilityKind` und `BotModule` exportieren, exakt entsprechend dem in
  `docs/02-bot-api.md` und `docs/08-hazards-und-utilities.md` beschriebenen Contract.
- WHEN `Action` verwendet wird SHALL DAS SYSTEM ausschließlich die vier Werte
  `"left" | "right" | "jump" | "idle"` zulassen (Type-Level).
- WHEN ein weiteres Package (z.B. `client`) `@arena/bot-contract` importiert SHALL DAS
  SYSTEM keine Laufzeitabhängigkeit zu Phaser, DOM-APIs oder dem Hub-Server-Protokoll
  (`@arena/shared`) benötigen (reine, isolierte Typ-/Validierungs-Bibliothek).

### US-2: Modul-Validierung eines Bot-Artefakts

Als Standbetreuer möchte ich, dass ein geladenes Bot-Artefakt (Objekt aus einem
dynamisch importierten Modul) automatisch geprüft wird, damit ungültige Bots erkannt
und in der UI als "ungültig" markiert werden können, statt die Anwendung zum Absturz
zu bringen.

Akzeptanzkriterien:
- WHEN ein geladenes Modul ein Objekt mit `apiVersion: 1` und einer Funktion `decide`
  als Default-Export enthält SHALL DAS SYSTEM dieses Objekt als gültiges `BotModule`
  erkennen.
- WHEN `apiVersion` fehlt, keine Zahl ist oder nicht der aktuell unterstützten Version
  entspricht SHALL DAS SYSTEM das Modul als ungültig einstufen und einen sprechenden
  Grund zurückgeben (kein Werfen einer unbehandelten Exception).
- WHEN `decide` fehlt oder keine Funktion ist SHALL DAS SYSTEM das Modul als ungültig
  einstufen und einen sprechenden Grund zurückgeben.
- WHEN `name`, `author` oder `color` fehlen SHALL DAS SYSTEM das Modul dennoch als
  gültig einstufen (diese Felder sind optional, siehe `docs/09`) und sinnvolle
  Fallback-Werte ermitteln lassen (Fallback-Erzeugung selbst ist Aufgabe des
  aufrufenden Codes/Folge-Features, nicht dieses Packages).

### US-3: Statischer Guard gegen unerlaubte APIs

Als Standbetreuer möchte ich, dass Bot-Quellcode vor der Ausführung grob auf
offensichtlich unerlaubte Konstrukte geprüft wird, damit ein erster, schneller
Verteidigungsring vor der eigentlichen (isolierenden) Worker-Ausführung besteht.

Akzeptanzkriterien:
- WHEN Bot-Quellcode eines der verbotenen Muster enthält (`import `, `require(`,
  `fetch(`, `window.`, `document.`, `eval(`, `XMLHttpRequest`) SHALL DAS SYSTEM den
  Code als nicht zulässig einstufen und einen Grund benennen, welches Muster
  gefunden wurde.
- WHEN Bot-Quellcode keines dieser Muster enthält SHALL DAS SYSTEM den Code als
  (statisch) zulässig einstufen – dies ersetzt NICHT die Isolation durch den Worker
  (siehe US-4), sondern ist ein zusätzlicher, schneller Vorfilter.

### US-4: Sichere, isolierte Ausführung von `decide(state)` im Web Worker

Als Standbetreuer möchte ich, dass jede `decide`-Funktion in einem eigenen Web Worker
läuft, damit fehlerhafter oder eine Endlosschleife enthaltender Fremd-Code weder die
Hauptanwendung noch andere Bots beeinträchtigt.

Akzeptanzkriterien:
- WHEN ein Bot gestartet wird SHALL DAS SYSTEM einen dedizierten Worker erzeugen und
  den Bot-Quellcode einmalig an ihn übergeben (`init`).
- WHEN der Main-Thread einen Tick auslöst SHALL DAS SYSTEM dem Worker den aktuellen
  `BotState` senden (`tick`) und auf eine `action`-Antwort warten.
- WHEN der Worker innerhalb eines konfigurierbaren Zeitlimits (Default 5ms) keine
  Antwort liefert SHALL DAS SYSTEM für diesen Tick die Aktion `"idle"` annehmen und
  dies als Timeout zählen, ohne den Worker zu beenden.
- WHEN `decide` zur Laufzeit eine Exception wirft SHALL DAS SYSTEM dies als Fehler
  für den aktuellen Tick behandeln, die Aktion `"idle"` zurückgeben und den Bot NICHT
  disqualifizieren.
- WHEN ein Bot eine konfigurierbare Anzahl aufeinanderfolgender Timeouts/Fehler
  überschreitet (Default 10) SHALL DAS SYSTEM den zugehörigen Worker hart beenden
  (`terminate()`) und den Bot als "pausiert" markieren (kein Neustart innerhalb
  desselben Laufs).
- WHEN `decide` einen ungültigen Rückgabewert liefert (kein String aus den vier
  erlaubten Actions) SHALL DAS SYSTEM dies wie eine ungültige Antwort behandeln und
  `"idle"` verwenden.
- WHEN ein Bot erfolgreich mehrere Ticks in Folge gültig antwortet SHALL DAS SYSTEM
  den Fehler-/Timeout-Zähler dieses Bots zurücksetzen (kein dauerhaftes "Anrechnen"
  längst vergangener Probleme).

### US-5: Bot-Runner als schmale, testbare Schnittstelle

Als Entwicklerteam möchte ich eine schmale `BotRunner`-Schnittstelle (start/tick/
dispose), damit aufrufender Code (spätere Spiel-Engine-Integration) den Worker nicht
direkt kennen muss.

Akzeptanzkriterien:
- WHEN aufrufender Code einen `BotRunner` für ein gültiges `BotModule` erzeugt SHALL
  DAS SYSTEM eine Methode bereitstellen, die für einen gegebenen `BotState` genau eine
  `Action` liefert (asynchron, mit eingebautem Timeout-Verhalten gemäß US-4).
- WHEN aufrufender Code den `BotRunner` beendet (`dispose`) SHALL DAS SYSTEM den
  zugehörigen Worker zuverlässig terminieren (keine Ressourcen-/Worker-Leaks).

### US-6 (NFR): Saubere, skalierbare Architektur

Als Entwicklerteam möchten wir, dass dieses Feature nach SOLID, Clean Code (Uncle Bob)
und YAGNI/DRY/KISS umgesetzt wird, damit `level-one-arena` und `bot-collection-point`
darauf aufbauen können, ohne diese Schicht umzubauen.

Akzeptanzkriterien:
- WHEN Verantwortlichkeiten wie Typ-Definition, Modul-Validierung, statischer Guard
  und Worker-Kommunikation implementiert werden SHALL DAS SYSTEM diese in getrennten
  Modulen/Dateien mit je einer klaren Verantwortung abbilden (Single Responsibility).
- WHEN neue Bot-API-Versionen oder zusätzliche Validierungsregeln nötig werden SHALL
  DAS SYSTEM dies ermöglichen, ohne bestehende, unveränderte Regeln anfassen zu
  müssen (Open/Closed, z.B. Versions-Dispatch statt verschachtelter If-Ketten).
- WHEN dieses Feature umgesetzt wird SHALL DAS SYSTEM strikt testgetrieben (Rot-Grün-
  Refactor, siehe `AGENTS.md`) entwickelt werden; produktiver Code ohne vorher
  geschriebenen, fehlschlagenden Test gilt als nicht konform.
- WHEN Code entsteht, der aktuell nicht für einen konkreten Akzeptanzkriterium-Bedarf
  nötig ist (z.B. mehrere API-Versionen gleichzeitig, konfigurierbare Guard-Regelsets
  aus externer Konfiguration) SHALL DAS SYSTEM darauf verzichten (YAGNI).

## Nicht-Ziele

- Kein Rendering, kein Phaser, kein Level, keine Hazards/Utilities-Umsetzung – das ist
  Teil von `level-one-arena`.
- Kein Datei-Import-UI (File System Access API, Drag&Drop) – das ist Teil eines
  späteren Bot-Import-Features im Client.
- Keine Netzwerk-/Server-Anbindung (kein Bezug zum Hub-Server oder zu
  `bot-collection-point`).
- Keine echte Sandbox-Härtung gegen böswillige Angreifer auf Betriebssystem-Ebene
  (Web-Worker-Isolation im Browser gilt als ausreichend für den Event-Kontext, siehe
  `docs/09`) – kein zusätzliches Sandboxing-Framework.
- Keine UI-Komponenten – reine Bibliothekslogik (Package + evtl. Client-seitige
  Nutzung als Modul, ohne eigene sichtbare Oberfläche).

## Offene Fragen

- Exaktes Timeout-Default (5ms laut `docs/02`) und Fehler-Schwellenwert (10 laut
  `docs/09`) werden als Konstanten übernommen; falls sich das im Betrieb als zu
  strikt/lax erweist, ist das ein späteres Kalibrierungs-Thema (siehe
  `docs/07-offene-punkte.md`, "Scoring-Konstanten kalibrieren" – analog für
  Sandbox-Konstanten).
- Wie genau Web Worker in der Vitest/jsdom-Testumgebung realistisch getestet werden
  (echter `Worker` vs. Test-Double) wird in `design.md` festgelegt.

## Begleitende Doku-Updates

Keine – die relevante Doku (`docs/02`, `docs/08`, `docs/09`) beschreibt den Contract
bereits korrekt; dieses Feature setzt ihn nur um.
