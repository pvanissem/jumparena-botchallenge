# Lokale Prüfung des kleinen Bot-Werkzeugkastens

> Aktueller Reset-Stand (16.09.2026): Das Besucher-Template liefert ausschließlich `[]` und startet keine Bewegung. Die fertige Level-1-Route liegt separat in `examples/strategies/messe-demo.js`. Dies ersetzt frühere Aussagen zur laufenden Standardvorlage.

Stand: 16.09.2026. Spiel und Levelgeometrie unverändert. Geprüft in der
vorhandenen Vorschau `/code`, mit echtem Phaser und Modul-Worker.

## Konkretes Manöver

Frische Welt an bestehendem Checkpoint `checkpoint-2` (x=1470).
Nach dem Herunterfallen auf den Boden führt der Bot genau diesen Auftrag aus:

```js
{ id: "bonus-plattform", kind: "boingo",
  utilityId: "boingo-1", platformId: "level-one:platform:10",
  x: 1582, sprint: false }
```

Fünf unabhängige Neustarts landeten auf der oberen Plattform y=290.
Endposition des Sprite-Zentrums x=1580 bzw. 1583,33 / y=270,8.
Die effektive Body-Unterkante lag bei y=290; `onGround=true`,
`lastImpulse.kind="boingo"` und `sourceId="boingo-1"`.
Alle fünf Traces enthalten 0 technische Fehler.

Nachweise unter `client/src/bot/runs/` (lokale, gitignorierte Laufdaten):

- `2026-09-16T09-12-50-550Z.json`
- `2026-09-16T09-13-13-931Z.json`
- `2026-09-16T09-13-46-502Z.json`
- `2026-09-16T09-14-00-327Z.json`
- `2026-09-16T09-14-26-899Z.json`

Die ersten vier Versuche wurden anschließend über „Neu“ beendet; der fünfte
blieb oben stehen bis zum Zeitlimit. „Erfolg“ bezieht sich auf das Manöver,
nicht auf das komplette Level. Eine lokale Fünferserie ist keine allgemeine
Zuverlässigkeitsgarantie, insbesondere nicht für die spätere Boingo-Kette.

## Befunde aus den echten Versuchen

- Ein normaler jump-Auftrag auf dieselbe Plattform traf zufällig ebenfalls den
  Boingo und landete oben. Das ist **kein** Vorher/Nachher-Beweis einer besseren
  Strategie. Deshalb wurde der explizite Boingo-Ablauf separat geprüft.
- Checkpoint-Overlaps setzen in Phaser `touching.down`, auch ohne tragenden Boden.
  Die Beobachtung und Sprungfreigabe verwenden jetzt `blocked.down` der tatsächlichen
  statischen Plattformkollision. Startzustände behaupten keinen Bodenkontakt.
- Phaser emittiert beim Game-Destroy nicht das Scene-Shutdown-Ereignis.
  Die Bereinigung reagiert nun auf beide Ereignisse und beendet Worker/Trace
  genau einmal. Die vier Neustart-Traces enden jetzt mit `scene-shutdown`.
- Ein asynchroner Workerfehler zwischen Entscheidungen konnte vorher die letzte
  Richtung gehalten lassen. Der Pause-Callback löscht diese Actions nun auch
  ohne offene Entscheidung und ohne eingeschaltete Telemetrie.
- Die Vorlage verbrauchte am Spawn zunächst einen Laufauftrag während des Falls.
  Sie wartet vor neuen Aufträgen jetzt auf echten Boden; laufende Flugaufträge
  werden weiterhin ausgeführt.

Alle Korrekturen wurden mit zuerst fehlschlagenden Regressionstests abgesichert.

## Vollständiger Einzelbot-Lauf in /dev

Nach der ausdrücklichen Nutzerkorrektur wurde die Abnahme auf das komplette
unveränderte Level 1 umgestellt. Ein Turnierlauf ist kein Abnahmekriterium.

Die bisherige heuristische Vorlage war als Startbot ungeeignet: Sie wählte
Plattformen ohne passenden Anlauf, landete in Stacheln und wiederholte schlechte
Entscheidungen. Die neue Arbeitsdatei und Vorlage enthalten deshalb eine offen
editierbare Level-1-Beispielroute. Ziele, Sprunghalten, Tempo und Warten sind
Besucherentscheidungen; im Framework liegt weiterhin ausschließlich die
Ausführung von walk/jump/boingo.

Beobachtete vollständige Zieleinläufe:

| Trace unter client/src/bot/runs/ | Laufzeit | Befund |
| --- | --- | --- |
| 2026-09-16T09-30-17-649Z.json | 47,392 s | Erster vollständiger sichtbarer Zieleinlauf; noch vor StrictMode-Korrektur |
| 2026-09-16T09-34-20-618Z.json | 44,883 s | Korrigierter Absprung vor Block 5; frischer vollständiger Lauf |
| 2026-09-16T09-36-04-188Z.json | 44,844 s | Feuerpassage mit hohem Boingo-Anflug statt knapper niedriger Landung |
| 2026-09-16T09-37-00-425Z.json | 44,850 s | Wiederholung der überarbeiteten Route; sichtbarer Zieleinlauf mit 338 Punkten |

Die abgeschlossenen Traces weisen keine technischen Fehler aus. Die letzten
drei Läufe begannen am Levelanfang und erreichten ohne Respawn das Ziel.

Wichtige Korrekturen aus den Vollläufen:

- Absprung vor Block 5 weiter nach links verlegt: Der frühere Punkt verursachte
  abhängig vom Entscheidungsframe einen Kopfstoß und anschließenden Absturz.
- Erste Feuerpassage: hoher Anflug mit dem vorhandenen Boingo bis hinter beide
  Feuersäulen. Die frühere niedrige Landung hing ungünstig von deren Phase ab.
- Checkpoint-Markierungen stehen direkt am jeweiligen Routenschritt. Das
  Einfügen weiterer Schritte macht keine parallele Indextabelle ungültig.
- Teilweise über einer Checkpoint-Kante stehende Bots dürfen auf mehr Boden
  laufen; Bewegung weiter über die Kante hinaus bleibt blockiert.
- React StrictMode erzeugte zwei Phaser-Spiele beim ersten Mount. Die
  abbrechbare Microtask-Erzeugung verhindert den Probemount; Cleanup stoppt
  Szene und Worker sofort und verwirft verspätete Callbacks. Nach vollständigem
  Reload existiert nur der aktive Lauf.
- /dev zeigt vorhandene Auftragsdiagnose direkt an; nach Pause, Respawn und
  eigener Action-Übernahme verschwindet veraltete Diagnose.

Die Route ist eine konkrete Level-1-Referenz, kein Universalspieler für alle
Level. Sie macht die API im zusammenhängenden Spiel überprüfbar und bleibt
veränderbarer Besuchercode. Andere Level und andere Strategien sind damit
nicht automatisch abgenommen.


Letzte Fassung einschließlich stabiler Checkpoint-Markierungen:
`2026-09-16T09-39-48-724Z.json`, Revision `bot-10c5a267`.
Vollständiger Zieleinlauf in 44,850 s, 233 Fruchtpunkte, 338 Gesamtpunkte.
Ein einzelner Trace vom Start bis zum Ziel, keine Respawns, keine technischen
Fehler. Arbeitsdatei und Startvorlage enthalten diese Fassung.

Abschlussprüfung: `npm test` — 1.171 Tests in 136 Dateien bestanden.
`npm run build` — alle Workspace-Pakete erfolgreich; bestehende Vite-Warnung
zur Bundlegröße bleibt. `git diff --check` sauber. Unabhängiges Review ohne
kritische Findings. Kein Commit/Push.
