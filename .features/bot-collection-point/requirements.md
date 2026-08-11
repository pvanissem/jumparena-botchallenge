# Requirements: Bot-Sammelstelle (`bot-collection-point`)

## Kontext

Bezug: `docs/03-architektur.md` (Abschnitt "Bot-Sammelstelle"),
`docs/09-bot-artefakt-und-turnier.md` (Abschnitt "Import in `/dev`", Hinweis
zur Sammelstelle), `docs/07-offene-punkte.md` (Punkt "Wie sehen `/admin` und
`/present` denselben Bot-Stand?", als entschieden markiert mit Verweis auf
dieses Feature).

Damit später ein Turnier konfiguriert und gestartet werden kann (Folge-Features
`tournament-config`, `match-runner`), müssen zuerst beliebige, fertige
Bot-Artefakte (`.js`-Dateien, Modul-Contract aus `docs/09`) in eine zentrale
Stelle eingespeist werden, die `/admin` und `/present` **gemeinsam** sehen.

Der Transportweg von einer `/dev`-Station zum Admin-Rechner (z.B. USB-Stick)
bleibt bewusst außerhalb dieses Features (siehe `docs/03`/`docs/09`) – hier
geht es nur um das, was passiert, **nachdem** die Datei bereits auf dem
Admin-Rechner liegt.

Der Hub-Server (`@arena/server`, siehe `.features/arena-hub-server/`) bleibt
ein reiner Relay mit einer In-Memory-Registry: Er nimmt Bot-Artefakte für die
laufende Session entgegen, führt sie aber **nicht aus** (keine Sandbox, keine
Simulation auf dem Server).

## User Stories

### US-1: Bot-Artefakt in `/admin` hochladen

Als Standbetreuer möchte ich in `/admin` eine oder mehrere `.js`-Dateien mit
Bot-Artefakten hochladen können, damit sie für das Turnier zur Verfügung
stehen.

Akzeptanzkriterien:
- WHEN der Nutzer in `/admin` eine oder mehrere `.js`-Dateien per
  Datei-Auswahl oder Drag&Drop auswählt SHALL DAS SYSTEM jede Datei einzeln
  einlesen und zur Validierung an den Server übergeben.
- WHEN eine hochgeladene Datei ein gültiges Bot-Modul enthält (besteht
  `validateBotModule`, siehe `packages/bot-contract`) SHALL DAS SYSTEM einen
  neuen Eintrag in der zentralen Bot-Registry anlegen (eigene, generierte ID)
  und dies in `/admin` sofort sichtbar bestätigen.
- WHEN eine hochgeladene Datei kein gültiges Bot-Modul enthält (z.B. Static
  Guard lehnt ab, `decide` fehlt, `apiVersion` nicht unterstützt) SHALL DAS
  SYSTEM den Upload dieser Datei ablehnen, einen verständlichen Grund in
  `/admin` anzeigen und **keinen** Registry-Eintrag anlegen.
- WHEN mehrere Dateien in einem Vorgang hochgeladen werden UND einzelne davon
  ungültig sind SHALL DAS SYSTEM die gültigen Dateien trotzdem übernehmen
  (kein Alles-oder-Nichts) und pro Datei einzeln Erfolg/Fehler anzeigen.
- WHEN zweimal eine Datei mit demselben Dateinamen hochgeladen wird SHALL DAS
  SYSTEM einen zusätzlichen, eigenständigen Registry-Eintrag anlegen (kein
  Ersetzen/Deduplizieren nach Namen).

### US-2: Name/Autor/Farbe aus dem Bot-Modul übernehmen

Als Standbetreuer möchte ich keine zusätzlichen Angaben von Hand eintragen
müssen, damit der Upload-Vorgang schnell und ohne Zusatzformular bleibt.

Akzeptanzkriterien:
- WHEN ein Bot-Modul die optionalen Felder `name`/`author`/`color` gesetzt hat
  SHALL DAS SYSTEM diese Werte unverändert für den Registry-Eintrag
  übernehmen.
- WHEN ein Bot-Modul `name` nicht gesetzt hat SHALL DAS SYSTEM den
  Dateinamen (ohne `.js`-Endung) als Anzeigename verwenden.
- WHEN ein Bot-Modul `color` nicht gesetzt hat SHALL DAS SYSTEM automatisch
  eine Farbe zuweisen (z.B. deterministisch aus der generierten ID
  abgeleitet), damit jeder Registry-Eintrag eine Anzeigefarbe hat.
- WHEN `/admin` hochgeladene Bots anzeigt SHALL DAS SYSTEM KEIN Formular zur
  manuellen Eingabe/Überschreibung von Name/Autor/Farbe anbieten.

### US-3: `/admin` und `/present` sehen denselben Bot-Stand

Als Standbetreuer möchte ich, dass `/admin` und `/present` jederzeit dieselbe
Liste eingereichter Bots zeigen, damit ich mich beim Konfigurieren des
Turniers auf `/present` verlassen kann.

Akzeptanzkriterien:
- WHEN ein neuer Bot erfolgreich in die Registry aufgenommen wird SHALL DAS
  SYSTEM alle aktuell verbundenen `/admin`- und `/present`-Clients per
  Broadcast über den neuen Eintrag informieren.
- WHEN ein `/admin`- oder `/present`-Client neu verbindet (z.B. Seiten-Reload)
  SHALL DAS SYSTEM ihm den vollständigen, aktuellen Registry-Stand
  übermitteln, ohne dass zuvor verpasste Einzel-Broadcasts fehlen.
- WHEN ein Bot aus der Registry entfernt wird (siehe US-4) SHALL DAS SYSTEM
  alle verbundenen `/admin`- und `/present`-Clients ebenfalls per Broadcast
  darüber informieren.

### US-4: Bot aus der Registry entfernen

Als Standbetreuer möchte ich einen fehlerhaften oder versehentlichen
Test-Upload wieder entfernen können, damit die Bot-Liste vor dem Turnier
sauber bleibt.

Akzeptanzkriterien:
- WHEN der Nutzer in `/admin` bei einem Registry-Eintrag auf "Entfernen"
  klickt SHALL DAS SYSTEM diesen Eintrag serverseitig aus der Registry löschen.
- WHEN ein Eintrag entfernt wurde SHALL DAS SYSTEM ihn in `/admin` und
  `/present` unmittelbar aus der Anzeige entfernen (siehe US-3, Broadcast).
- WHEN eine ungültige/bereits entfernte ID zum Löschen angefragt wird SHALL
  DAS SYSTEM dies ignorieren (no-op), ohne Fehlerzustand für andere Clients
  auszulösen.

### US-5: Registry ist bewusst flüchtig

Als Standbetreuer möchte ich Bot-Dateien nach einem Server-Neustart bewusst
erneut manuell auswählen, damit keine zweite persistierte Datenquelle neben
den vorhandenen `.js`-Dateien gepflegt werden muss.

Akzeptanzkriterien:
- WHEN der Hub-Server startet SHALL DAS SYSTEM immer mit einer leeren
  Bot-Registry starten.
- WHEN ein Bot hinzugefügt oder entfernt wird SHALL DAS SYSTEM ausschließlich
  die In-Memory-Registry des laufenden Serverprozesses ändern.
- WHEN `/admin` oder `/present` innerhalb derselben Server-Session neu lädt
  SHALL DAS SYSTEM weiterhin den aktuellen In-Memory-Stand als Snapshot
  liefern.
- WHEN der Server neu gestartet wurde SHALL DAS SYSTEM keine frühere
  Registry-Datei laden und die erneute manuelle Auswahl der `.js`-Dateien in
  `/admin` verlangen.

### US-6 (NFR): Konsistent mit bestehender Server-/Client-Architektur

Als Entwicklerteam möchten wir, dass dieses Feature exakt in die bestehende
Architektur aus `.features/arena-hub-server/` passt, damit Turnier-Config und
Match-Runner (Folge-Features) ohne Umbau auf der Registry aufbauen können.

Akzeptanzkriterien:
- WHEN neue Message-Typen für Upload/Sync/Entfernen definiert werden SHALL DAS
  SYSTEM sie als benannte, typisierte Contracts in `packages/shared/src/messages.ts`
  ergänzen (DRY, konsistent mit `PingBroadcastMessage`/`AudioSettingsMessage`).
- WHEN der Server die neuen Message-Typen verarbeitet SHALL DAS SYSTEM dafür
  neue Handler registrieren (`MessageDispatcher`), ohne bestehende Handler
  (`ping-broadcast`, `audio-settings`) oder das `WebSocketGateway` inhaltlich zu
  ändern (Open/Closed, siehe bestehendes Muster).
- WHEN die Bot-Registry serverseitig implementiert wird SHALL DAS SYSTEM sie
  als eigenständiges Modul mit klar begrenzter Verantwortung (Speicherung,
  keine Validierung, keine WS-Details) umsetzen (Single Responsibility,
  analog zu `ClientRegistry`).
- WHEN die Validierung eines Bot-Moduls benötigt wird SHALL DAS SYSTEM die
  bestehenden Funktionen `checkStaticGuard`/`validateBotModule` aus
  `packages/bot-contract` wiederverwenden, keine zweite/abweichende
  Validierungslogik einführen (DRY).
- WHEN eine Ausführungsumgebung (Sandbox) nötig ist, um Quelltext in ein
  Modul-Objekt zu verwandeln, SHALL DAS SYSTEM die bereits vorhandene
  Worker-Sandbox des Clients wiederverwenden und **keine** zweite
  Sandbox-Implementierung aufbauen (DRY, KISS).
- WHEN dieses Feature umgesetzt wird SHALL DAS SYSTEM strikt testgetrieben
  (Rot-Grün-Refactor, siehe `AGENTS.md`) entwickelt werden.

## Nicht-Ziele

- Kein Transportweg von einer `/dev`-Station zum Admin-Rechner (bleibt
  manuell/USB-Stick, siehe `docs/03`/`docs/09`) – dieses Feature beginnt erst
  beim Upload-Klick in `/admin`.
- Keine Turnier-Konfiguration, kein Bracket, keine Match-Steuerung (Folge-
  Features `tournament-config`, `match-runner`).
- Keine Ausführung von Bot-Code (`decide()`-Aufrufe, Simulation) auf dem
  Server. Der Server prüft Quelltext nur textuell (Static Guard) und speichert
  ihn – das Laden/Ausführen des Moduls passiert ausschließlich clientseitig in
  der vorhandenen Worker-Sandbox.
- Keine Datei- oder Datenbank-Persistenz der Bot-Registry. Die vorhandenen
  `.js`-Dateien bleiben die einzige dauerhafte Quelle und werden nach einem
  Server-Neustart erneut manuell ausgewählt.
- Kein manuelles Formular zur Eingabe/Überschreibung von Name/Autor/Farbe.
- Keine Authentifizierung/Autorisierung des Uploads.
- Keine Bearbeitung eines bereits hochgeladenen Bot-Artefakts (nur
  Hinzufügen/Entfernen, kein "Update"/Diff-Vergleich).

## Offene Fragen

- Obergrenze für Dateigröße/Anzahl gleichzeitiger Uploads? (Vorschlag fürs
  Design: großzügiges, aber sinnvolles Limit, z.B. 200 KB pro Datei – Bot-Code
  ist immer sehr klein; wird in `design.md` konkretisiert.)
- Soll die Registry-Liste in `/admin` sortiert/filterbar sein (z.B. nach
  Upload-Zeitpunkt)? Für den MVP reicht vermutlich Upload-Reihenfolge
  (wird in `design.md` entschieden, kein Blocker für Requirements-Freigabe).
