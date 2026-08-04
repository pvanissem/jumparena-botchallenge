# 07 – Offene Punkte, Risiken & To-Dos

Diese Liste fasst alle offenen Fragen zusammen, die im Brainstorming aufgekommen sind und vor
dem eigentlichen Umsetzungsstart geklärt/entschieden werden sollten.

## Offene Entscheidungen

- [ ] **Sichtfeld-Größe** im `BotState` (`nearbyTiles`) – wie viele Tiles soll ein Bot "sehen"?
- [ ] **Bot-Interaktion:** Bleibt es endgültig bei "keine Infos über andere Bots", oder wird
      später doch ein Wettbewerbs-Element zwischen Bots gewünscht?
- [ ] **Mehrere Schwierigkeitsgrade** des Bot-State (Einsteiger- vs. Fortgeschrittenen-API)?
- [ ] **Stand-Setup:** Läuft devkcode pro Station lokal, oder zentral mit mehreren Terminals?
- [ ] **Vorgefertigte Bot-"Persönlichkeiten"** als Einstiegshilfe (z.B. "Der Draufgänger")?
- [ ] **Validierung des generierten Codes** vor dem finalen Export (Testlauf in Sandbox)?
- [ ] **Ein Level für alle Heats** oder mehrere Level-Varianten über den Tag verteilt?
- [ ] **Level-Erstellung:** Tiled-Editor-Export vs. handgeschriebene Tilemap für den MVP?
- [ ] **Finale/Show-Runde:** Sollen die Top-Bots am Ende nochmal gegeneinander antreten?
- [ ] **Tie-Breaker-Regel** bei Score-Gleichstand im Leaderboard.
- [x] **Zentrales Leaderboard über mehrere Stationen/Rechner hinweg** – entschieden:
      Ein zentraler Node.js-WebSocket-Router-Server verbindet `/present` und
      `/admin` (mit Broadcast-Kanal auch zu `/dev`). Siehe
      `.features/arena-hub-server/` und `docs/03-architektur.md`.
- [x] **Wie sehen `/admin` und `/present` denselben Bot-Stand?** – entschieden:
      Zentrale In-Memory-Bot-Sammelstelle im Hub-Server, aus der beide Ansichten
      lesen (siehe `docs/03-architektur.md`, Abschnitt "Bot-Sammelstelle").
      Eingespeist wird sie vorerst über manuellen Datei-Upload in `/admin`.
      Umsetzung als eigenes Feature-Spec `bot-collection-point` (nach
      `bot-decide-api` und `level-one-arena`).
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
| Performance bei 16 parallelen Kameras/Workern | Ungetestet, wie sich das auf typischer Stand-Hardware verhält | Frühzeitig Prototyp mit 16 Dummy-Bots bauen und Performance messen |
| KI generiert ungültigen/fehlerhaften Code | Nutzer könnte trotzdem am Ende einen kaputten Bot bekommen | Validierungsschritt in devkcode-Profil (Testausführung vor Export) |
| Zeitdruck am Stand (15–20 Min) reicht nicht immer | Manche Besucher brauchen länger, Warteschlange entsteht | Klar geführter, zeitlich begrenzter Gesprächsablauf im Profil (siehe 04) |
| Browser-Kompatibilität für Ordner-Upload (File System Access API) | Nicht in jedem Browser gleich gut unterstützt | Fallback auf klassisches Multi-File-Input testen |
| Zu große Sichtfeld-Angaben machen Bots "zu gut"/Level zu leicht lösbar | Reduziert Show-Effekt/Vielfalt der Strategien | Sichtfeld bewusst klein halten, im Vorfeld mit Testbots ausprobieren |

## Nächste konkrete Schritte (Vorschlag für die Umsetzung)

1. **Prototyp Bot-API + Worker-Sandbox** bauen (unabhängig vom Level): Kann ein simpler
   `decide()`-Code sicher und performant in einem Worker laufen und getickt werden?
2. **Level-MVP** in Phaser bauen (ein Bot, keine KI, manuell steuerbar) – Basis für alles
   Weitere.
3. **Multi-Kamera-Grid-Prototyp** mit z.B. 4 Dummy-Bots (simple, hartkodierte Logik statt
   echter Bot-Dateien) – Performance-Check, bevor auf 16 hochskaliert wird.
4. **devkcode-Profil entwerfen und mit 2-3 Testpersonen durchspielen** (auch nicht-technische
   Kollegen), um Zeitbudget und Verständlichkeit zu validieren.
5. **Scoring/Leaderboard-UI** bauen und mit den Testbots aus Schritt 1–3 kalibrieren.
6. **Import/Upload-Flow** für Bot-Dateien bauen und End-to-End testen (devkcode-Export →
   Import in die Arena → Heat-Lauf → Leaderboard).
7. **Dry-Run mit echten Kollegen** (wie am Montag besprochen) vor dem eigentlichen
   Konferenztermin, um das Zeitbudget und den Show-Effekt am Stand zu validieren.
