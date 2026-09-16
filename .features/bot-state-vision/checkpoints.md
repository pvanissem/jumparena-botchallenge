# Ergänzung: Checkpoints wahrnehmen

Freigabe: Nutzerauftrag „dann bauen wir das ein“ am 16.09.2026; autonom umsetzen.
Bezug: bestehende Wahrnehmungs-Spec und docs/02-bot-api.md.

## Anforderungen
- WHEN eine Checkpoint-Kontaktfläche im Sichtfeld liegt SHALL der Bot ID, relative Position und echte Kontaktfläche sowie reached und active erhalten. Unsichtbare Checkpoints werden nicht geliefert.
- WHEN ein Checkpoint berührt wird SHALL active dem aktuellen Respawn-Ziel entsprechen; reached bleibt auch nach Aktivieren eines anderen Checkpoints und Tod erhalten.
- WHEN ein Bot startet oder respawnt SHALL respawnPoint die bekannte tatsächliche Wiedererscheinungsposition und checkpointId (null am Levelstart) nennen, auch außerhalb der Sichtweite.
- WHEN ein Trace aufgezeichnet wird SHALL er diese Wahrnehmung unverfälscht mitführen; alte States/Traces bleiben lesbar.
- WHEN ein Besucher Checkpoints priorisieren möchte SHALL das Steering die Felder und deren Grenzen erklären; kein automatisches Ändern seiner Strategie.

## Design
RaceScene liest Checkpoint-Position und Kontaktfläche aus aktiven Phaser-Bodies.
WorldSnapshot transportiert diese Daten; buildBotState nutzt denselben Sichtfilter und Distanzsortierung wie andere Objekte. RacerRuntimeState speichert erreichte IDs und aktuelle ID, die pure Checkpoint-Regel aktualisiert beides. Der Respawn-Punkt wird mit derselben Funktion wie der tatsächliche Respawn berechnet. Sichtbare Checkpoints sind keine Hindernisse und keine neuen Utility-Typen.
Additive optionale Contract-Felder checkpoints und respawnPoint für ältere Fixture-/Trace-Kompatibilität; der neue Runtime-Builder liefert sie immer. Keine Levelroute, keine neuen Steuerbefehle oder automatische Checkpoint-Strategie. Template bleibt still.

## Tasks
- [x] Tests zuerst: Sichtgrenzen, Kontaktflächen, Statuswechsel, Respawn und Trace-Kopie.
- [x] Contract, Regeln, Szene, Builder und Trace ergänzen.
- [x] API/Steering erläutern, relevante Tests und Build prüfen.

## Verifikation
1190 Tests in 137 Dateien bestanden; vollständiger Build bestanden (bestehende Bundle-Größenwarnung). Szenen-Integration prüft tatsächliche Body-Geometrie bis zum Bot-State, inklusive Checkpoint-Prüfstart. Kein neuer manueller Browserlauf durchgeführt.
