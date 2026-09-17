# Regressionen aus der Besuchersimulation

`blitz-stalled.json` und `samtpfote-stalled.json` enthalten jeweils einen
beobachteten Stillstand vom 17.09.2026. `moving-hazard.json` hält den späteren
unnötigen Rücksprung vor einer Säge fest. Keine Produktionsdatei lädt diese Daten.

Geometrie und Body stammen aus den gespeicherten Traces. Zeit und Tick sind für
den Test zurückgesetzt; fehlende vollständige Tuningwerte wurden aus dem
unveränderten `client/src/game/movement/movement.ts` ergänzt. Die Weltgrenze dient
nur der Testeinbettung, nicht als Routenwissen. Listen und Plattformpositionen
enthalten die im Trace dokumentierte Rundung; Navigation.body bleibt ungerundet.
Diese Snapshots prüfen Entscheidungen, nicht die anschließende Phaser-Ausführung.

Die drei `desert-*.json`-Snapshots stammen aus den Hüpfer-Läufen am 17.09.2026:
`desert-spike` zeigt den blockierten Bot innerhalb des zusätzlichen Stachel-Puffers,
`desert-warning` den erneuten Absprung neben einem warnenden Spikehead,
`desert-approach` die Auswahl vor dem problematischen Zwischenstopp. Grundlage sind
die Trace-Dateien `2026-09-17T11-20-18-417Z.json` und
`2026-09-17T11-23-20-319Z.json` (Ticks 136 bzw. 116 im letzteren Trace).
Fehlende State-Felder sind wie bei den anderen Snapshots mit unverändertem Tuning
ergänzt; für diese Regressionen wird keine vollständige Levelkarte geladen.
