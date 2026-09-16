# 09 – Bot-Artefakt, Sandbox & Turniermodus

Dieses Dokument beschreibt, wie das Artefakt einer devkcode-Vibe-Coding-Session
in die Arena kommt, sicher ausgeführt wird und im Turnier gegeneinander antritt.

## Das Bot-Artefakt (Modul-Contract)

Ergebnis jeder Session ist **eine `.js`-Datei** – ein ES-Modul mit genau einem
Default-Export:

```js
export default {
  apiVersion: 1,
  frameworkVersion: 2,
  name: "Blitz-Bot",
  author: "Anna",
  color: "#ff5da2",
  decide(state, tools) {
    if (!state.onGround) return [];
    return tools.run({ id: "erste-strecke", kind: "walk", x: 200 });
  },
};
```

- `apiVersion: 1` und `decide` sind Pflicht. `name`, `author`, `color` sind
  technisch optional, Besucherbots erhalten aber nichtleere Namen.
- `apiVersion` schützt über einen mehrstündigen Event vor echten Breaking
  Changes: Bots aus Runde 1 laufen auch in Runde 20.
- `frameworkVersion: 2` fordert die Tools-API aus [02-bot-api.md](02-bot-api.md)
  an. Ohne dieses Feld laufen alte v1-Bots weiter mit `decide(state)` und
  `Action[]` als Rueckgabe. Unbekannte Framework-Versionen werden abgelehnt.
- Arbeitsdatei, Vorschau und Upload verwenden dieselben unveraenderten
  Bytes von `client/src/bot/current-bot.js`, maximal 200.000 Bytes. Kein Bundler,
  Wrapper, zweites Autorenformat oder Exportbefehl ist erforderlich.
- Die kurze Vorlage `current-bot.template.js` und die kompletten Bots unter
  `examples/strategies/` brauchen keine beigelegte Bibliothek. Navigation gehoert
  zum Betreiber-Framework und wird jedem Tools-Bot separat im Worker bereitgestellt.
  Reine Action-Bots bleiben kompatibel. Framework-v1-Bots werden ausdrücklich
  abgelehnt und müssen auf run/status umgestellt werden.

### Gemeinsamer Framework-Release

Vorschau, Uploadvalidierung und Turnier muessen dieselbe
Framework-Version und denselben Worker-Initialisierungspfad verwenden. Vor dem
ersten Tick wird `module-ready` abgewartet. Ein Update des Frameworks kann auch
das Verhalten unveraenderter Bot-Dateien aendern; waehrend einer Turnierserie
bleibt der Release deshalb eingefroren. Navigation ist kein eingebetteter Core
im Bot. Keine Nachladung vom Netz.

## Import in `/dev` (kein Server, keine Dateiauswahl, deterministische Datei)

> **Aktualisiert durch `.features/dev-station-mode/`:** Der ursprünglich hier
> beschriebene Import beliebiger `.js`-Dateien per File System Access
> API/Datei-Picker wurde **verworfen** zugunsten einer einzigen, festen
> Bot-Arbeitsdatei. Grund: devkcode bearbeitet die Bot-Logik direkt als
> Quelldatei im `/dev`-Projekt – ein zusätzlicher Import-Schritt danach wäre
> überflüssige Reibung.

- Die Bot-Logik lebt in `client/src/bot/current-bot.js` (git-ignoriert,
  Vorlage in `current-bot.template.js`, eingecheckt). devkcode bearbeitet
  diese Datei **direkt**, kein Upload, kein Picker, kein Ordner-Scan.
- `/code` (Besucheransicht) und `/dev` laden den Quelltext per Vite-`?raw`-Import und fuehren ihn
  unverändert über die bestehende Sandbox aus (siehe "Sandbox" unten).
- Jede Änderung an `current-bot.js` löst über Vites HMR automatisch einen
  vollstaendigen Reload von `/code` beziehungsweise `/dev` aus; Level, Racer-Status und
  BotRunner/Worker starten dadurch garantiert frisch mit dem neuen Code, ohne
  manuellen Klick.
- Zwischen zwei Besuchern setzt `npm run reset-bot` (Repo-Root) die Datei auf
  die Standardvorlage zurück; die fertige Datei wird davor manuell (z.B. per
  USB-Stick) vom Stationsrechner kopiert – siehe unten "Weiterhin offen/t.b.d."
- Reset leert auch `client/src/bot/runs/`.
  Er ist ausschliesslich explizite Betreiberaktion; Einfuehrung oder Update
  des Frameworks ersetzt keinen bestehenden Besuchercode automatisch.
  Die neue Vorlage ist deshalb nicht automatisch der aktuell laufende Bot.
- Damit ist die ursprüngliche „kein Server"-Entscheidung aus `docs/03`
  weiterhin gültig –   `/dev` läuft als reiner Vite-Client-Prozess
  (`npm run dev`, siehe `docs/03-architektur.md`) ohne jede WebSocket-/
  Server-Anbindung.

> **Ergänzung (siehe `.features/arena-hub-server/`):** Für den Betrieb von
> `/present` und `/admin` bei mehreren `/dev`-Stationen gibt es inzwischen einen
> zentralen WebSocket-Router-Server (siehe `docs/03-architektur.md`, Abschnitt
> "Zentraler Server für Multi-Stationen-Betrieb"). Dieser Server transportiert
> aber (noch) **keine** Bot-Artefakte automatisch von `/dev` – `/dev` sendet
> grundsätzlich nichts an den Server. Für `/admin` und `/present` ist stattdessen
> eine **zentrale Bot-Sammelstelle** im Hub-Server vorgesehen (flüchtige In-Memory-Registry,
> siehe `docs/03-architektur.md`, Abschnitt "Bot-Sammelstelle"), die beide
> Ansichten mit demselben Stand versorgt. Eingespeist wird diese Sammelstelle
> vorerst über einen **manuellen Datei-Upload in `/admin`** (Zwischenlösung).
> **Weiterhin offen/t.b.d.:** Wie das fertige Bot-Artefakt (`current-bot.js`)
> von einer `/dev`-Station **auf den Admin-Rechner** gelangt (z.B. USB-Stick,
> manuelles Kopieren) – das ist bewusst nicht Teil der bisherigen Infrastruktur
> und Gegenstand eines künftigen, separaten Feature-Specs.

## Sandbox (Web Worker)

Jeder Bot läuft in einem **eigenen Web Worker** (Modul-Worker):

1. **Statischer Guard** (`@arena/bot-contract`): schneller Regex-Vorfilter
   gegen `import`/`require`/`fetch`/`window`/`document`/`eval`/… – erste, nicht
   alleinige Verteidigungslinie.
2. **Dynamischer Import**: Der Quelltext wird als Blob-URL an den Worker
   übergeben, der ihn per `import()` lädt und validiert.
3. **Tick-Loop**: Nach `module-ready` sendet der Main-Thread etwa alle 33 ms
   einen beobachteten `BotState`, der Worker antwortet mit `Action[]`.
   Maximal eine Anfrage ist gleichzeitig offen. State-Tick, Epoche und
   Anwendungsframe werden korreliert; veraltete Antworten werden verworfen.
4. **Fehlerstopp**: Beim ersten Laufzeitfehler oder Timeout wird der Worker
   terminiert, der Bot gestoppt und jede gehaltene Action gelöscht. Ein
   Neustart erfolgt ausdrücklich über die vorhandene Vorschau.

Der harte Kill ist der Grund, warum echter Fremd-Code zwingend im Worker läuft
(nicht im Main-Thread): nur so lässt sich eine echte Endlosschleife stoppen.
Der lokale Roundtrip-Watchdog beträgt 100 ms; die Initialisierung hat separat
2000 ms. Das ist ein Hängerschutz, kein gemessenes Rechenzeitbudget. Guard und Worker sind begrenzte
Schutzmassnahmen, keine umfassende Isolation beliebigen Fremdcodes.

## Turniermodus

- **Single-Elimination**, Gruppengröße im Admin-Setup wählbar zwischen **2 oder 4
  Bots** pro Match (Default: 4).
- Pro Match laufen alle Bots im **selben Level** gleichzeitig; jeder hat ein
  eigenes Sprite + eine eigene **Kamera** (Grid 1×1 / 1×2 / 2×2). Keine
  Bot-zu-Bot-Kollision.
- **Level je Runde (Stage):** Vor dem Aufstellen des Turniers konfiguriert der
  Betreiber in `/admin` eine geordnete Liste von Levels (`stageLevelIds`). Die
  erste Runde spielt auf `stageLevelIds[0]`, die zweite auf `stageLevelIds[1]`
  usw. Überschreitet die tatsächliche Rundenzahl die konfigurierte Stages,
  werden Runden jenseits der Liste auf dem Level der letzten Stage gespielt.
- **Wertung pro Match** (`game/scoring.ts`, aus `docs/05`): Frucht-Score +
  Zeitbonus − Tode − DNF-Abzug. Nur der/die **Erstplatzierte** kommt weiter
  (Zeit als Tie-Breaker).
- Bei zu wenigen Bots einfach kleinere/weniger Gruppen (kein Auffüllen).
- Am Ende: **Champion-Screen**. Bracket-Anzeige zeigt Runden → Matches →
  Gewinner live, ergänzt um den Levelnamen und den aktuellen Rundenstatus
  (ausstehend / läuft / abgeschlossen) je Runde.

### Multi-Racer-Architektur (getrennte Welten)

Die naheliegende Idee – ein Level, mehrere Racer-Sprites, mehrere Kameras –
hätte ein hartes Fairness-Problem: Sammelt Bot A eine Frucht oder löst einen
Block, würde das Objekt zerstört und Bot B könnte es nicht mehr einsammeln.
Das wäre vom Startzeitpunkt abhängig und unfair.

Deswegen wird die bestehende `RaceScene` **pro Racer als separate Instanz**
unter einem eindeutigen Scene-Key gestartet. Jede Instanz besitzt ihre eigene
Physik-Welt und eigene Level-Objekte; die Kameras werden auf ein Grid von
Viewports im selben Canvas beschränkt. So entfällt jegliches Objekt-Sharing
strukturell, und "keine Bot-zu-Bot-Kollision" ergibt sich automatisch. Der
Hub-Server kennt weiterhin keine Spiellogik; er hält nur den Turnierzustand
und leitet Bracket, Match-Result und Match-Progress weiter.

### Ablauf-Komponenten
- `server/src/botRegistry/BotRegistry.ts` – alle importierten Bots der laufenden Server-Session
- `server/src/tournament/TournamentService.ts` – Bracket-Struktur, Advance-Logik
- `server/src/tournament/SingleEliminationStrategy.ts` – Single-Elimination-Strategie
- `packages/shared/src/tournament.ts` – Turnier-Typen
- `packages/shared/src/messages.ts` – Turnier- & Match-Nachrichten
- `client/src/tournament/useTournamentState.ts` – Turnier-Zustand aus WebSocket
- `client/src/tournament/useMatchProgress.ts` – Live-Progress pro Match
- `client/src/match/MatchRunner.ts` – startet N × RaceScene im Grid
- `client/src/match/MatchView.tsx` – Phaser-Host für `/present`
- `client/src/game/scenes/RaceScene.ts` – parametrisierbarer Key, Viewport, Audio
- `client/src/pages/AdminPage.tsx` – Turnier-Konfiguration & Steuerung
  (inklusive Stage-Level-Editor)
- `client/src/pages/PresentPage.tsx` – Bracket / Match / Ergebnis / Champion
- `client/src/components/StageLevelEditor.tsx` – Konfiguration der Stage-Levels
- `client/src/components/BracketView.tsx` – Bracket mit Level + Rundenstatus
  pro Runde

## Ausprobieren (`/code`)

Die Botbau-Vorschau liegt unter `/code`; `/dev` bezeichnet die bisherige
Stationsansicht. Der normale Vite-Start mit `npm run dev` genuegt. Botname und
Strategie besprechen, Arbeitsdatei bearbeiten, speichern und den automatischen
Reload abwarten. Gemeinsam den Bot laufen lassen, vorhandene Traces lesen,
das beobachtete Verhalten erklaeren und eine passende Verbesserung vorschlagen.
Kein weiterer Testaufbau ist erforderlich. Details:
[04-devkcode-profil.md](04-devkcode-profil.md).

`/dev` bietet zwei Testmodi (siehe `.features/dev-station-mode/`):
„Selbst spielen" (Tastatur, ← → / Leertaste) und „Bot laufen lassen"
(deterministisch immer `client/src/bot/current-bot.js`, siehe "Import" oben).
Beide laufen im selben Level, nützlich zum Ausprobieren und Debuggen –
unabhängig vom späteren Turniermodus in `/present`.

Im Bot-Modus zeichnen `/code` und `/dev` Lauf-Telemetrie auf. Ein Run entspricht einem
einzelnen Versuch vom Start beziehungsweise Respawn bis Tod, Ziel, Zeitlimit
oder Abbruch. Jeder Run wird als eigene zeitgestempelte JSON-Datei unter
`client/src/bot/runs/` gespeichert; `/present` zeichnet keine Telemetrie auf.
Vor der Zuordnung zum aktuellen Code `run.botRevision` pruefen. Zuerst `run`,
`summary` und `findings` lesen, dann relevante `events`-/`windows`-Ausschnitte.
Ereignisse sind Fakten, Diagnosen Hinweise, gekuerzte Traces kein vollstaendiger
Laufnachweis. Fehlende Laeufe und nicht ausgefuehrte Browser-/Lastpruefungen
offenlassen; keine allgemeine Leistungssteigerung aus einem Versuch ableiten.
Nur ein expliziter Betreiber-Reset leert den Ordner fuer die naechste Session.
