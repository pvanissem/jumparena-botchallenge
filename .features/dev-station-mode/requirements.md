# Requirements: Dev-Station-Modus

## Kontext

Betrifft `docs/03-architektur.md` (Abschnitt "Warum kein Server?" /
"Zentraler Server für Multi-Stationen-Betrieb") und `docs/09-bot-artefakt-und-turnier.md`
(Bot-Artefakt, Import, Sandbox, Testmodus).

Aktuell startet `npm run dev` im Repo-Root den Hub-Server (`@arena/server` im
Dev-Modus mit Vite-Middleware), der WebSocket-Gateway inklusive – unabhängig
davon, ob `/dev`, `/admin` oder `/present` genutzt wird. `/dev` (`DevPage.tsx`)
hängt aktuell an `useWebSocketConnection` (Status-Badge, Broadcast-Feed) und an
einer festen Auswahl mitgelieferter Beispiel-Bots (`EXAMPLE_BOTS`).

Das widerspricht der in `docs/03` getroffenen Entscheidung, dass eine
`/dev`-Station ein **komplett isolierter, lokaler Prozess ohne jede
Server-/Netzwerk-Anbindung** ist. Dieses Feature räumt das auf und führt
gleichzeitig das eigentliche Kernszenario ein: Ein Besucher entwickelt mit
devkcode eine echte `decide(state)`-Bot-Datei direkt im Quellcode, testet sie
live in `/dev`, und die Datei wird danach (z.B. per USB-Stick) manuell vom
Präsentationsrechner eingesammelt – siehe `docs/09`, Abschnitt "Weiterhin
offen/t.b.d.: Transportweg Stationsrechner → Admin-Rechner" (bleibt bewusst
unberührt von diesem Feature).

Begleitend werden folgende, bereits im Chat getroffene Architektur-Klärungen
in den Docs nachgezogen (siehe "Begleitende Doku-Updates" unten):

- Der ursprüngliche 16-Bot-Heat-Modus (`docs/01`, `docs/05`) gilt als durch den
  Turniermodus (Single-Elimination, max. 4 Bots/Match, `docs/09`) abgelöst.
- `/dev` läuft künftig als reiner Vite-Client-Prozess (`npm run dev`), der
  bisherige Hub-Server-Start wandert unter dem Namen `npm run present` zum
  Präsentationsrechner (`/admin` + `/present`, WS-Hub bleibt dort unverändert
  bestehen – dieses Feature ändert an `/admin`/`/present` selbst nichts).

## User Stories

### US-1: Getrennte Startbefehle für Dev-Station und Präsentation

Als Standbetreuer möchte ich `npm run dev` ausführen können, um ausschließlich
eine isolierte Dev-Station zu starten, und `npm run present` für den zentralen
Präsentationsrechner, damit beide Betriebsarten eindeutig getrennt und nicht
verwechselbar sind.

Akzeptanzkriterien:
- WHEN `npm run dev` im Repo-Root ausgeführt wird SHALL DAS SYSTEM
  ausschließlich den Vite-Dev-Server für `@arena/client` starten (kein
  Server-Prozess, kein WebSocket-Gateway wird gestartet).
- WHEN `npm run present` im Repo-Root ausgeführt wird SHALL DAS SYSTEM das
  bisherige Verhalten von `npm run dev` liefern (Hub-Server mit
  WebSocket-Gateway + Vite-Middleware, `/admin` und `/present` erreichbar).
- WHEN die Dev-Station läuft (`npm run dev`) SHALL DAS SYSTEM unter `/dev`
  keine WebSocket-Verbindung aufbauen oder versuchen aufzubauen.

### US-2: Bot-Artefakt als editierbare Quelldatei mit HMR

Als Besucher (unterstützt durch devkcode) möchte ich, dass meine Bot-Logik in
einer festen, direkt im Quellcode liegenden Datei entsteht, damit Änderungen
sofort per Hot-Module-Reload in der Testansicht sichtbar werden, ohne manuellen
Datei-Import.

Akzeptanzkriterien:
- WHEN die Dev-Station zum ersten Mal nach einem frischen Checkout gestartet
  wird und `client/src/bot/current-bot.js` noch nicht existiert SHALL DAS
  SYSTEM eine klar verständliche Fehlermeldung anzeigen, die auf das
  Ausführen von `npm run reset-bot` hinweist (kein kryptischer
  Build-/Importfehler).
- WHEN `client/src/bot/current-bot.js` vorhanden ist SHALL DAS SYSTEM ihren
  Quelltext beim Start von `/dev` laden und im Bot-Testmodus als Grundlage für
  den `BotRunner` verwenden.
- WHEN der Inhalt von `client/src/bot/current-bot.js` während einer laufenden
  Dev-Session verändert und gespeichert wird SHALL DAS SYSTEM die Änderung via
  Vite-HMR übernehmen (spätestens nach einem "Neu starten"-Klick in `/dev` ein
  frischer Testlauf mit dem neuen Code, kein Server-Neustart nötig).
- WHEN der Bot-Quelltext geladen wird SHALL DAS SYSTEM ihn unverändert über die
  bestehende Sandbox-Pipeline ausführen (Static Guard + Web-Worker-Import,
  siehe `packages/bot-contract`, `client/src/sandbox`) – keine Ausführung im
  Main-Thread.

### US-3: Reset auf Standardvorlage zwischen zwei Besuchern

Als Standbetreuer möchte ich die Bot-Datei mit einem einzigen Befehl auf die
Ausgangsvorlage zurücksetzen können, damit der nächste Besucher garantiert mit
einem sauberen, bekannten Standard-Bot startet.

Akzeptanzkriterien:
- WHEN `npm run reset-bot` ausgeführt wird SHALL DAS SYSTEM den Inhalt von
  `client/src/bot/current-bot.template.js` unverändert nach
  `client/src/bot/current-bot.js` kopieren (vorhandene Inhalte werden
  überschrieben).
- WHEN `client/src/bot/current-bot.js` noch nicht existiert SHALL DAS SYSTEM
  sie durch `npm run reset-bot` neu anlegen (identisches Verhalten wie beim
  Überschreiben).
- WHEN das Repository initial ausgecheckt wird SHALL DAS SYSTEM
  `client/src/bot/current-bot.template.js` versioniert mitliefern, während
  `client/src/bot/current-bot.js` git-ignoriert ist und nicht Teil des Commits
  wird.

### US-4: Sichtbare Diagnose für Bot-Probleme, die auch im Turnier relevant wären

Als Besucher/Standbetreuer möchte ich in `/dev` unmittelbar sehen, wenn der Bot
ungültig ist, einen Laufzeitfehler wirft oder zu langsam antwortet, damit
Probleme, die später im Präsentationsturnier zum stillen Ausfall führen
würden, schon während der Session sichtbar und behebbar sind.

Akzeptanzkriterien:
- WHEN der geladene Bot-Quelltext den statischen Guard nicht besteht (z.B.
  verbotenes `fetch`/`import`/`window`/…) SHALL DAS SYSTEM dies in `/dev` als
  klar erkennbaren Status "ungültig" mit Grund anzeigen, bevor ein Testlauf
  gestartet wird.
- WHEN das Bot-Modul ungültig ist (fehlendes `decide`, falsche/fehlende
  `apiVersion`) SHALL DAS SYSTEM denselben "ungültig"-Status mit
  verständlichem Grund anzeigen.
- WHEN `decide()` während eines laufenden Tests einen Laufzeitfehler wirft
  SHALL DAS SYSTEM dies sichtbar melden (z.B. letzte Fehlermeldung + Zähler),
  statt den Fehler nur intern still als `idle` zu behandeln.
- WHEN `decide()` wiederholt das Zeitlimit pro Tick überschreitet und der Bot
  dadurch (gemäß bestehender `BotRunner`-Logik) hart pausiert/beendet wird
  SHALL DAS SYSTEM diesen Zustand ("Bot pausiert wegen Zeitüberschreitung")
  deutlich anzeigen.
- WHEN der Bot gültig ist und ohne Fehler/Timeout läuft SHALL DAS SYSTEM einen
  klar positiven Status ("läuft") anzeigen.

### US-5: Bestehende Testmodi bleiben erhalten, Auswahl entfällt

Als Standbetreuer möchte ich weiterhin sowohl das Level manuell per Tastatur
als auch den aktuellen Bot testen können, aber ohne eine Auswahl aus mehreren
Bot-Dateien treffen zu müssen, damit der Ablauf am Stand einfach und
deterministisch bleibt.

Akzeptanzkriterien:
- WHEN `/dev` geöffnet wird SHALL DAS SYSTEM weiterhin die Wahl zwischen
  "Selbst spielen" (Tastatur) und "Bot laufen lassen" anbieten.
- WHEN "Bot laufen lassen" gewählt wird SHALL DAS SYSTEM immer und
  ausschließlich `client/src/bot/current-bot.js` verwenden (keine Dropdown-
  Auswahl einer Bot-Datei mehr).

## Nicht-Ziele

- Keine Änderungen an `/admin` oder `/present` (bleiben WS-basiert, unter
  `npm run present` unverändert nutzbar).
- Kein automatischer Transportweg der fertigen Bot-Datei zum
  Präsentationsrechner (USB-Stick/manuelles Kopieren bleibt wie in `docs/09`
  beschrieben offen/manuell).
- Kein automatisches Zurücksetzen der Bot-Datei (z.B. beim Start von
  `npm run dev`) – `npm run reset-bot` wird bewusst manuell ausgeführt (siehe
  Klärung im Chat: kein `predev`-Hook).
- Keine Entfernung/Änderung der Sandbox-Kernlogik selbst (`BotRunner`,
  `checkStaticGuard`, `validateBotModule`) – nur deren Beobachtbarkeit nach
  außen wird bei Bedarf erweitert (Detail für `design.md`).
- Beispiel-Bots (`client/public/example-bots/`, `examples/bots/`) werden in
  diesem Feature vollständig entfernt, nicht nur aus der Auswahl genommen.

## Begleitende Doku-Updates

- `docs/01-konzept.md`, `docs/05-scoring-und-heats.md`: 16-Bot-Heat-Modus als
  durch den Turniermodus (`docs/09`, max. 4 Bots/Match) abgelöst markieren.
- `docs/03-architektur.md`: `/dev` als reiner, isolierter Vite-Client-Prozess
  (`npm run dev`, kein Server/WS) präzisieren; `npm run present` als Name für
  den bisherigen Hub-Server-Start dokumentieren.
- `docs/07-offene-punkte.md`: Entscheidungen aus diesem Feature (Heat→Turnier,
  Dev-Station-Modus, Bot-Artefakt-Datei-Ansatz) als erledigt/entschieden
  vermerken.

## Offene Fragen

Keine – alle Punkte wurden im Brainstorming vor diesem Spec geklärt (siehe
Chatverlauf). Verbleibende technische Detailentscheidungen (genauer Zuschnitt
der `BotRunner`-Beobachtbarkeit für US-4, exaktes HMR-Verhalten) werden in
`design.md` ausgearbeitet.
