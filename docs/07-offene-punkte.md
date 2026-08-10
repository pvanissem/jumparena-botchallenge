# 07 – Offene Punkte, Risiken & To-Dos

Diese Liste fasst alle offenen Fragen zusammen, die im Brainstorming aufgekommen sind und vor
dem eigentlichen Umsetzungsstart geklärt/entschieden werden sollten.

## Offene Entscheidungen

- [ ] **Sichtfeld-Größe** im `BotState` (`nearbyTiles`) – wie viele Tiles soll ein Bot "sehen"?
- [ ] **Bot-Interaktion:** Bleibt es endgültig bei "keine Infos über andere Bots", oder wird
      später doch ein Wettbewerbs-Element zwischen Bots gewünscht?
- [ ] **Mehrere Schwierigkeitsgrade** des Bot-State (Einsteiger- vs. Fortgeschrittenen-API)?
- [x] **Stand-Setup:** entschieden (`.features/dev-station-mode/`): devkcode
      läuft pro Station lokal, `/dev` ist ein reiner, isolierter
      Vite-Client-Prozess (`npm run dev`) ohne Server/WebSocket – siehe
      `docs/03-architektur.md`, Abschnitt "Startbefehle: /dev vs.
      Präsentationsrechner".
- [ ] **Vorgefertigte Bot-"Persönlichkeiten"** als Einstiegshilfe (z.B. "Der Draufgänger")?
- [x] **Validierung des generierten Codes** vor dem finalen Export –
      teilweise entschieden (`.features/dev-station-mode/`): `/dev` zeigt
      während der Session eine Live-Diagnose (ungültiges Modul,
      Laufzeitfehler, Timeout/harter Kill), damit Probleme sichtbar werden,
      bevor die Datei den Stationsrechner verlässt.
- [x] **Ein Level für alle Heats** oder mehrere Level-Varianten über den Tag verteilt?
      Entschieden und umgesetzt: Pro Runde kann ein eigenes Level konfiguriert
      werden (`stageLevelIds` im `TournamentState`, konfigurierbar in `/admin`).
      Runden ohne eigene Stage verwenden das Level der letzten Stage.
      Siehe `.features/tournament-stage-levels/`.
- [ ] **Level-Erstellung:** Tiled-Editor-Export vs. handgeschriebene Tilemap für den MVP?
- [ ] **Finale/Show-Runde:** Sollen die Top-Bots am Ende nochmal gegeneinander antreten?
- [x] **Tie-Breaker-Regel** bei Score-Gleichstand im Leaderboard – entschieden
      (`.features/tournament-runner/`): bei Score-Gleichstand gewinnt die
      kürzere Zeit (`timeElapsedMs`).
- [x] **16-Bot-Heat-Modus vs. Turniermodus** – entschieden
      (`.features/dev-station-mode/`): Der ursprüngliche Heat-Modus
      (`docs/01`, `docs/05`) gilt als durch den Turniermodus
      (Single-Elimination, max. 4 Bots/Match, `docs/09`) abgelöst.
- [x] **Bot-Artefakt-Datei-Ansatz in `/dev`** – entschieden
      (`.features/dev-station-mode/`): Statt beliebiger Datei-Auswahl/-Import
      bearbeitet devkcode eine feste Quelldatei
      (`client/src/bot/current-bot.js`), die per Vite-HMR bei jeder Änderung
      einen vollständigen Reload von `/dev` auslöst; Reset zwischen
      Besuchern über `npm run reset-bot`.
- [x] **Zentrales Leaderboard über mehrere Stationen/Rechner hinweg** – entschieden:
      Ein zentraler Node.js-WebSocket-Router-Server verbindet `/present` und
      `/admin` (mit Broadcast-Kanal auch zu `/dev`). Siehe
      `.features/arena-hub-server/` und `docs/03-architektur.md`.
- [x] **Wie sehen `/admin` und `/present` denselben Bot-Stand?** – entschieden
      und umgesetzt (`.features/bot-collection-point/`): Zentrale
      Bot-Sammelstelle im Hub-Server mit JSON-Persistenz, Broadcast an alle
      Clients und Snapshot für Neuverbindungen. `/admin` bietet Upload +
      Entfernen, `/present` zeigt nur an. Siehe `docs/03-architektur.md`,
      Abschnitt "Bot-Sammelstelle".
- [ ] **Transportweg Stationsrechner → Admin-Rechner:** Wie gelangt ein fertiges
      Bot-Artefakt (`decide.js`) von einer isolierten `/dev`-Station auf den
      Admin-Rechner (z.B. USB-Stick, manuelles Kopieren, künftig evtl. ein
      eigener Mechanismus)? `/dev` bleibt bewusst ohne Netzwerkanbindung an den
      Hub-Server (siehe `docs/03-architektur.md`, `docs/09-bot-artefakt-und-turnier.md`).
      Weiterhin offen.
- [ ] **Scoring-Konstanten kalibrieren** (siehe 05-scoring-und-heats.md) mit Testbots vor dem Event.

## Technische Risiken

| Risiko | Beschreibung | Gegenmaßnahme (Vorschlag) |
|---|---|---|
| Performance bei 4 parallelen Kameras/Workern | Ungetestet, wie sich das auf typischer Stand-Hardware verhält | `.features/tournament-runner/` limitiert Matches auf max. 4 Bots; vor dem Event mit 4 echten Bots auf Stand-Hardware testen |
| KI generiert ungültigen/fehlerhaften Code | Nutzer könnte trotzdem am Ende einen kaputten Bot bekommen | Validierungsschritt in devkcode-Profil (Testausführung vor Export) |
| Zeitdruck am Stand (15–20 Min) reicht nicht immer | Manche Besucher brauchen länger, Warteschlange entsteht | Klar geführter, zeitlich begrenzter Gesprächsablauf im Profil (siehe 04) |
| Browser-Kompatibilität für Ordner-Upload (File System Access API) | Nicht in jedem Browser gleich gut unterstützt | Fallback auf klassisches Multi-File-Input testen |
| Zu große Sichtfeld-Angaben machen Bots "zu gut"/Level zu leicht lösbar | Reduziert Show-Effekt/Vielfalt der Strategien | Sichtfeld bewusst klein halten, im Vorfeld mit Testbots ausprobieren |

## Nächste konkrete Schritte (Vorschlag für die Umsetzung)

1. **Prototyp Bot-API + Worker-Sandbox** bauen (unabhängig vom Level): Kann ein simpler
   `decide()`-Code sicher und performant in einem Worker laufen und getickt werden?
2. **Level-MVP** in Phaser bauen (ein Bot, keine KI, manuell steuerbar) – Basis für alles
   Weitere.
3. **Multi-Kamera-Grid-Prototyp** mit 4 echten Bots – Performance-Check auf der Stand-Hardware
   (entscheidend für `.features/tournament-runner/`).
4. **devkcode-Profil entwerfen und mit 2-3 Testpersonen durchspielen** (auch nicht-technische
   Kollegen), um Zeitbudget und Verständlichkeit zu validieren.
5. **Scoring/Leaderboard-UI** bauen und mit den Testbots aus Schritt 1–3 kalibrieren.
6. **Import/Upload-Flow** für Bot-Dateien bauen und End-to-End testen (devkcode-Export →
   Upload in `/admin` → Turnier-Lauf → Champion-Screen).
7. **Dry-Run mit echten Kollegen** (wie am Montag besprochen) vor dem eigentlichen
   Konferenztermin, um das Zeitbudget und den Show-Effekt am Stand zu validieren.
