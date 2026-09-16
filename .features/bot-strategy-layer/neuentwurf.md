# Vorschlag: Ein kleiner Werkzeugkasten für Besucher-Bots

## Auftrag und Entscheidung

Ausgearbeitet am 16.09.2026 auf ausdrücklichen Auftrag, autonom eine einfache
Lösung für den ausschließlich lokalen Messestand zu entwerfen. Grundlage:
[Untersuchung der bestehenden API](../../docs/research/2026-09-16-bot-api-audit.md).
Der Vorschlag wurde anschließend zur autonomen Umsetzung beauftragt.
Der v2-Werkzeugkasten ersetzt inzwischen den Universalplaner. Tatsächliche
Prüfergebnisse und Grenzen stehen in [abnahme-v2.md](abnahme-v2.md).

**Empfehlung:** Das Spiel bleibt. Ein JS-Bot entscheidet jeden Tick über seine
Absicht. Drei kleine Bewegungshilfen setzen diese Absicht anhand echter
Beobachtungen um. Keine allgemeine Routensuche, keine zweite Physiksimulation,
kein Sicherheitsversprechen für unbekannte Flugbahnen.

„Lokal“ heißt: keine neue Authentifizierung, Services oder Betriebsinfrastruktur.
Ein Worker bleibt sinnvoll, weil eine Endlosschleife im generierten Bot sonst
auch die Spieloberfläche blockiert. Das ist eine praktische Schutzmaßnahme,
keine vollständige Sandbox für feindlichen Code.

## So sieht der Besucherablauf aus

1. Besucher beschreibt ein Verhalten: „Nimm den Boingo zur oberen Plattform.“
2. Agent liest Bot-Datei, sichtbaren Spielzustand und bei Bedarf den letzten Trace.
3. Agent ändert die Zielwahl oder eine Regel in `current-bot.js`.
4. Speichern startet wie bisher die Vorschau neu.
5. Beide sehen, ob der Bot den Boingo ansteuert, den Impuls bekommt und landet.
6. Bei Fehlschlag wird genau die betreffende Regel korrigiert.

Der Agent soll keinen Sprungsimulator erzeugen müssen. Er darf aber Strategie,
Bewegungsparameter und auch rohe Actions verändern. Die Standardstrategie liegt
vollständig lesbar in der Bot-Datei. Sie ist ein Startpunkt und keine Garantie,
dass jeder erzeugte Bot das gesamte Level schafft.

## Drei Verantwortlichkeiten

| Teil | Verantwortlich für | Konkrete Grenze |
| --- | --- | --- |
| Spiel / Beobachtung | Tatsächliche Positionen, Kontakte, Spielzeit und Input-Anwendung | Keine Strategieentscheidung |
| Bewegungshilfe | Den angeforderten Lauf, Sprung oder Boingo-Ablauf ausführen | Wählt kein anderes Ziel und sucht keinen Gesamtweg |
| Besucher-Bot | Ziel, Route, Früchte, Risiko, Warten, Abbruch | Benutzt Helfer oder gibt selbst Actions zurück |

Diese Trennung ist wichtiger als neue Paketnamen. Bestehende Module dürfen
weiterverwendet werden. Wir führen dafür weder Plugin-Architektur noch neue
Abstraktionshierarchien ein.

## Öffentliche API: Bestehenden Einstieg behalten, Tools vereinfachen

`decide(state, tools)` bleibt synchron und liefert die bestehenden `Action[]`.
Name, Autor, Farbe und eine einzelne JS-Datei bleiben erhalten. Die vorhandene
Framework-Versionsprüfung wird verwendet; für den inkompatiblen Werkzeugkasten
wird `frameworkVersion: 2` reserviert. Keine neue Versionierungssystematik.

Nur zwei Tool-Methoden im neuen Contract:

- `tools.run(command)` liefert Actions für den laufenden Tick.
- `tools.status()` liefert den zuletzt beobachteten Ausführungszustand.

Drei konkrete Befehle:

```ts
type Command =
  | { id: string; kind: "walk"; x: number; sprint?: boolean }
  | { id: string; kind: "jump"; platformId: string;
      x?: number; sprint?: boolean; holdMs?: number }
  | { id: string; kind: "boingo"; utilityId: string; platformId: string;
      x?: number; sprint?: boolean };

type Status = {
  commandId: string | null;
  state: "idle" | "running" | "succeeded" | "failed";
  phase: "approach" | "launch" | "flight" | "landing" | null;
  reason: string | null;
};
```

`x` ist eine absolute Koordinate, kein Offset. Plattform-/Utility-IDs beziehen
sich auf sichtbare Objekte. Ein weggelassenes Lande-x bedeutet deren Mitte.
Vorhandene relative Beobachtungen werden intern an genau einer Stelle umgerechnet;
kein flächiger State-Umbau nur für schönere Feldnamen.

### Planbesitz ohne fünf konkurrierende Methoden

- Genau ein `run` pro Entscheidung. Derselbe Befehl setzt die Ausführung fort.
- Wiederholte identische Parameter unter derselben ID starten nichts neu.
- Erfolg/Fehler bleiben für diese ID stehen, bis die Bot-Datei einen neuen
  Befehl wählt. Absichtlich erneut versuchen: neue ID.
- Eine andere ID ersetzt den bisherigen Befehl bewusst, auch im Flug. Der
  Helfer startet aus dem beobachteten Zustand; er erfindet keinen neuen Absprung.
- Geänderte Parameter unter einer bereits verwendeten aktuellen ID sind ein
  verständlicher Botfehler: zum Ändern neue ID verwenden. Nur der aktuelle Befehl
  wird gespeichert, keine unbegrenzte Historie aller IDs.
- Ohne `run` oder mit abweichenden zurückgegebenen Actions übernimmt der Bot
  selbst; die alte Ausführung endet. `return []` ist damit eindeutig Warten/Stoppen.
- Respawn setzt Helfer zurück. Der Besucher-Bot setzt eigene Closure-Zustände
  anhand des bestehenden Respawn-/Epoch-Signals zurück.
- `status()` wird vor der Botentscheidung aus der neuen Beobachtung aktualisiert.
  Ein gerade beobachteter Boingo-Kontakt oder eine Landung darf nicht erst nach
  dem nächsten `run` sichtbar werden.

Damit entfallen im neuen Contract `navigate`, `choose`, `move`, `continue` und
`cancel`. Die Bot-Datei hält den aktuellen Befehl und kann ihn explizit ersetzen.
Das ist absichtlich ein einziger Steuerungsweg statt Automatik plus Nebenkanälen.

## Was die Helfer tatsächlich leisten

### Laufen

Richtung zum gewünschten x, Anhalten im kleinen Zielbereich. Aktuelle Gefahr,
fehlender Boden oder ausbleibender Fortschritt führen zu einem sichtbaren Fehler,
nicht zu einem heimlich ausgewählten Sprung. Der Bot entscheidet dann, ob er
wartet, springt oder ein anderes Ziel ansteuert.

### Springen

Geprüfte Startbedingungen: Ziel sichtbar und breit genug, erlaubte Parameter,
tatsächlicher Bodenkontakt für einen neuen Absprung. Danach ein kleiner Ablauf:
Absprung auslösen, Jump für die gewünschte Dauer halten, horizontal zum gewählten
Landebereich steuern und anhand echter Kontakte den Ausgang feststellen.

Der Standard ist ein normaler voller Sprung; `holdMs` erlaubt ausdrücklich
Besucherexperimente mit kürzerem Halten. Der genaue Standardwert wird aus der
vorhandenen Mechanik übernommen und im realen Spiel überprüft, nicht mit einem
neuen Optimierer gesucht. Ein Luftstart kann horizontal korrigieren, aber keinen
zweiten Sprung erzeugen; ungeeignete Startzustände werden gemeldet.

Erfolg verlangt beobachtete Landung auf der gewählten Plattform im vereinbarten
Landebereich. Ein Treffer auf einer anderen Plattform ist ein Fehler mit Grund.
Ein bloß abgelaufener Timer oder eine rechnerische Flugbahn ist kein Erfolg.

### Boingo

Ein expliziter Ablauf: zum Boingo kommen, nötigenfalls aus dem Stand kurz springen,
absteigenden Kontakt abwarten, echten Boingo-Impuls erkennen, dann horizontal zur
Zielplattform steuern und dort die Landung feststellen.

Der Zwischenpunkt ist nur bis zum Boingo-Kontakt relevant. Kontakt mit dem falschen
Boingo, fehlender Impuls oder Landung auf einem anderen Ziel beendet das Manöver
mit passendem Grund. Kein Zurücklenken zum Boingo nach bereits erfolgtem Impuls.
Ob ein kurzer Hüpfer nötig ist, muss gegen die tatsächlichen Collider geprüft
werden. Wir behaupten nicht vor diesem Versuch, dass jede Anfahrt damit klappt.

### Grenzen

Die Helfer können unerreichbare Ziele bekommen und scheitern. Sie lösen keine
Gegnerbegegnung allgemein, planen nicht automatisch um und garantieren keine sichere
Flugbahn. Offensichtlich ungültige Aufträge werden abgelehnt; das Ausprobieren
plausibler Aufträge bleibt möglich. Ein konservativer Predictor darf nicht mehr
jede Besucheridee vor ihrer Ausführung blockieren.

Einheitliche Fehlergründe reichen, z.B. `target-missing`, `not-grounded`,
`blocked`, `bounce-missed`, `wrong-landing`, `stalled`, `died`.
Details werden im vorhandenen Trace ergänzt, nicht in einem neuen Diagnosesystem.

## Zeit und lokale Ausführung: pragmatische erste Stufe

Wir bauen vorerst weder die Phaser-Schleife um noch machen wir die komplette
Welt für Worker klonbar. Die Spielmechanik und ihre Werte bleiben unangetastet.
Die Helfer arbeiten mit tatsächlicher Spielzeit und beobachteten Kontakten;
sie setzen keine exakt 33 ms zwischen Aufrufen voraus. Haltezeit beginnt am
beobachteten Absprung, nicht am Versand der ersten Anfrage.

- Vorhandener Worker mit höchstens einer offenen Anfrage bleibt.
- Beobachtete Zeit, Epoch und Antwortkorrelation bleiben erhalten.
- Actions wirken ab dem nächsten möglichen Spiel-Update und gelten bis zur
  nächsten Antwort; keine Behauptung eines garantierten Anwendungsframes.
- Initialisierung behält ihren separaten Timeout.
- Der enge 5-ms-Roundtrip wird durch einen einfachen, vorläufigen **100-ms-Watchdog**
  ersetzt. Das ist Schutz vor einem hängenden Bot, kein Rechenzeitbudget.
- Überschreiten oder Laufzeitfehler stoppt den betreffenden Bot mit verständlichem
  Hinweis; gehaltene Actions werden gelöscht, verspätete Antworten ignoriert.
  Kein automatischer Wiederanlauf, keine zehn aufeinanderfolgenden Hänger abwarten.
- 100 ms ist eine Entwicklungsentscheidung, keine gemessene optimale Schwelle.
  Wir prüfen sie am lokalen Rechner auch mit vier bestehenden Turnieransichten.

Diese Stufe verspricht keine bitgenaue Wiederholbarkeit oder identische Resultate
bei jeder Framerate. Wir verlangen sichtbare Robustheit unter normaler Standlast.
Erst wenn reale Versuche zeigen, dass die Update-Reihenfolge der begrenzende Fehler
ist, wird dieser konkrete Ablauf vereinheitlicht. Kein vorsorglicher Engine-Umbau.

## Informationen und Gefahren

Die vorhandenen Bounds, IDs, Geschwindigkeiten und Spielzeiten bilden den State
für den ersten Bewegungssatz. Eine kleine Lücke muss beim Umsetzen geprüft werden:
Ein kurzer Sprung oder Kontakt kann vollständig zwischen zwei Bot-Abfragen liegen.
Ein tatsächlicher Sprung-/Boingo-Impuls muss deshalb mit Zeitpunkt und Quelle bis
zur nächsten Beobachtung lesbar bleiben; ein auf Bodenberührung zurückgesetztes
Momentanfeld genügt dafür nicht. Dafür reicht der letzte relevante Impuls mit
laufender Nummer. Kein Event-Bus, kein Ereignisarchiv.

Keine vollständige Weltkarte, keine Zukunftsdaten für alle Gegner und kein neues
Weltmodell.

Für die erste Fassung steuert der Besucher Risiken über Regeln wie „warte, bis
frei“ und „lande nicht direkt neben einem Gegner“. Daraus wird keine Sicherheitsgarantie.
Falls konkret das Durchqueren getakteter Feuersäulen eine verlässliche Zeitangabe
braucht, ergänzen wir gezielt eine aus der echten Loderix-Funktion abgeleitete
Angabe. Nicht jetzt vorsorglich alle Hazardtypen mit Prognose-APIs ausstatten.

## Migration und was entfallen darf

1. Den dokumentierten Sicherungsstand behalten. Kein weiterer Stash-/Branch-Umbau
   für die Ausarbeitung; bei Umsetzung normale gezielte Änderungen.
2. Neue Helfer zunächst in `packages/bot-navigation` aufbauen. Bestehendes Paket
   wiederverwenden, nicht allein wegen seines Namens ein weiteres erzeugen.
3. Neue Besucher-Vorlage und ein kurzes Beispiel ausschließlich auf diese Helfer
   stellen. Vorhandene `current-bot.js` nur im Rahmen des beauftragten Umbaus
   ersetzen und vorher sichern.
4. Framework-v1-Artefakte werden bei einem inkompatiblen Wechsel ausdrücklich
   als neu zu erzeugen gemeldet; keine dauerhafte doppelte Navigationsarchitektur.
   Alte reine Action-Bots bleiben ohne zusätzliche Kompatibilitätsschicht möglich.
   Vor tatsächlicher Entfernung prüfen, ob im lokalen Bestand erhaltenswerte
   v1-Bots liegen, und diese gezielt migrieren statt stillschweigend zu brechen.
5. Sobald die neue Schleife im Spiel belegt ist, den ungenutzten Planner,
   Prognose-Executor, deren Cache-/Recovery-Sonderfälle und überholte Tests entfernen.
   Nützliche echte Regressionen vorher den verbleibenden Verantwortlichkeiten zuordnen.

Weiter bestehen: Metadaten, Import/Abgabe, Turnier, Spiel, Level, `/code`, vorhandene
Traces und die Dateibeobachtung. Kein neues Backend, kein SDK-Build für Besucher.

## Überschaubare Umsetzung mit klaren Abbruchpunkten

Die Reihenfolge ist ein Vorschlag, noch keine abgearbeitete Task-Liste.
Jede Verhaltensänderung wird testgetrieben umgesetzt. Kein umfangreicher
Parallelumbau, bevor die Bewegungen im Spiel nachgewiesen sind.

1. **Besitz und Rückmeldung:** Den kleinen Contract, Statusübergänge, Respawn und
   Raw-Action-Übernahme mit den bestehenden Worker-Tests absichern. Watchdog
   getrennt von normaler erfolgreicher Ausführung prüfen.
2. **Laufen und ein Sprung:** Zwei überschaubare Helfer implementieren; gleicher
   Steuerungspfad wie das echte Spiel. In `/code` Landung und Fehlfall ansehen.
   Falls das unzuverlässig ist, dort stoppen und Ursache klären.
3. **Boingo:** Anfahrt, Impuls und Landung ergänzen. Die vorhandene Passage im
   unveränderten Level verwenden. Keine weitere Sonderregel für eine andere
   Passage hinzufügen, bevor dieser Ablauf funktioniert.
4. **Besuchermoment:** Zwei Fassungen derselben Bot-Datei vorführen: vorher
   falsche Entscheidung, nach einer verständlichen Anweisung gezieltes Manöver.
   Dann fünf Wiederholungen der Passage. Ziel: fünf beobachtete Landungen,
   nicht fünf vom Modell behauptete Erfolge. Das ist eine lokale Abnahme,
   keine statistische Zuverlässigkeitsgarantie.
5. **Aufräumen und Standprobe:** Alten Standardpfad entfernen, Steering und
   API-Doku kurz halten, Gesamttests und einen echten Lauf mit vier Bots prüfen.

Für den Einstieg in die Passage zuerst den vorhandenen Selbst/Bot-Wechsel nutzen,
der Position und Spielzustand erhält. Das zeigt das Verhalten, ist aber kein
identischer Reset. Wenn reproduzierbares Wiederholen damit zu aufwendig ist,
ist genau eine kleine Entwicklungshilfe in `/code` zulässig: Neustart an einer
gewählten bestehenden Checkpoint-Position mit zurückgesetzter Weltzeit und
Weltzustand. Keine neue Route, kein Levelumbau, kein Snapshot-Service. Diese Hilfe
wird erst eingebaut, wenn der Versuch sie tatsächlich braucht.

## Warum gerade diese Lösung?

Der bisherige Ansatz sollte einen bereits sehr guten autonomen Spieler liefern
und zugleich weitreichende Besucherkorrekturen ermöglichen. Dafür ist sein Modell
nicht verlässlich genug, und die Verantwortung wandert zwischen Bot und Framework.

Dieser Entwurf nimmt eine kleinere Aufgabe an: verlässliche Bedienhilfen für
konkrete Bewegungen. Gute Routen bleiben Aufgabe der editierbaren Strategie.
Ob dieser Werkzeugkasten für den Stand ausreicht, wird am echten Besucherablauf
geprüft, nicht aus einer neuen Methodenliste abgeleitet.

Bewusst später oder gar nicht: A*/MCTS, Behavior-Tree-Bibliothek, Plan-Optimierer,
Reinforcement Learning, allgemeine Replay-Plattform, Cloud-Komponenten,
Security-Härtung für fremde Angreifer und eine universelle Engine-Abstraktion.
