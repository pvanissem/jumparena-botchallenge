# Untersuchung der Bot-API und Navigation

Stand: 16.09.2026. Spiel, Level und Mechaniken bleiben gesetzt. Keine Implementierung
im Rahmen dieser Untersuchung. Untersucht wurde der aktuelle Arbeitsstand inklusive
der noch uncommitteten Navigationserweiterungen; lokal installiert ist Phaser 4.2.1.

## Urteil

Die Grundform „ein JS-Modul erhält Beobachtungen und liefert Actions“ ist tragfähig.
Die aktuelle automatische Navigation ist dagegen noch keine verlässliche Grundlage
für das versprochene Messestanderlebnis. Das betrifft Modelltreue, Zeitsemantik,
beobachtbare Gefahren und die Zuständigkeit für Entscheidungen. Mehr Regeln in
`current-bot.js` beheben diese Voraussetzungen nicht.

Das ist kein Nachweis, dass autonome Bots für dieses Spiel unmöglich sind. Auch
sind nicht alle vorhandenen Tests wertlos. Sie prüfen andere, wichtige Eigenschaften.
Die zusätzlichen Methoden `move/continue/status/cancel` schaffen Eingriffsmöglichkeiten,
verwenden aber denselben unsicheren Unterbau wie `navigate`.

## Vorgehen und Evidenzgrenzen

- Contract, State-Erzeugung, Worker/Runner, Scene-Steuerung, Navigation, Predictor,
  Gefahrenfunktionen und einschlägige Tests gelesen.
- Installierten Phaser-Quellcode für den Ablauf fester Physikschritte geprüft.
- Primärquellen zu Phaser, Worker-Kommunikation, Mario-AI-Framework und zeitlich
  ausgedehnten Agentenaktionen recherchiert; Quellen unten.
- Fünf kleine Gegenproben außerhalb des Repositories ausgeführt:
  [Quellcode](/private/tmp/coin-quest-api-audit/probes.ts),
  [ausführbares Bundle](/private/tmp/coin-quest-api-audit/probes.cjs),
  [Ergebnisse](/private/tmp/coin-quest-api-audit/results.jsonl).
  Wiederholung: `node /private/tmp/coin-quest-api-audit/probes.cjs`.
- 113 bestehende Tests in sechs relevanten Dateien erneut ausgeführt, alle grün.
  [Testprotokoll](/private/tmp/coin-quest-api-audit/tests.log).
- Keine neue kontrollierte Phaser-Laufserie und kein neuer Vier-Bot-Lasttest.
  Die Gegenproben sind ausdrücklich keine vollständigen Spielsimulationen.

## 1. Das Gefahrenmodell kann die tatsächliche Zukunft nicht abbilden

[VisibleHazard](/Users/cbartel/Projects/jumparena-botchallenge/packages/bot-contract/src/state.ts:44)
enthält aktuelle Position/Bounds, aktive Phase, Warnung und Geschwindigkeit.
Patrouillengrenzen, Umkehrzeit, Pendelparameter, verbleibende sichere Zeit und
Spikehead-Triggerbereich fehlen. Der aktuelle Snapshot ist für diese Mechaniken
kein vollständiger Zustand für exakte Vorhersagen. Historie könnte einige Größen
schätzen, aber auch das macht das aktuelle Framework nicht.

Der [Predictor](/Users/cbartel/Projects/jumparena-botchallenge/packages/bot-navigation/src/predictor.ts:313)
verschiebt Gefahren linear mit `vx/vy`. Er hält `active/warning` über die Prognose
fest. Das Spiel benutzt dagegen [Patrouillen, Phasen und Pendelbewegungen](/Users/cbartel/Projects/jumparena-botchallenge/client/src/game/hazards/behaviors.ts:15).
Neu beobachtete Gefahren erhalten zunächst Geschwindigkeit null, obwohl null auch
„steht tatsächlich still“ bedeuten kann.

**Gegenprobe Loderix:** Bot läuft auf einer breiten Fläche von Mittelpunkt x=92
nach x=230. Eine Feuersäule liegt bei x=155..175. Bei Startzeit 2500 ms ist sie
inaktiv; mit der echten Spiel-Zeitfunktion (1300 ms an, 1300 ms aus) aktiviert sie
sich nach 100 ms. Der Predictor liefert `safe=true`, `reason=supported`, Dauer
683,33 ms. Dieselbe vorhergesagte Körperbahn schneidet die dann aktive Säule
bereits nach 266,67 ms.

Das beweist eine falsche Sicherheitsbewertung des Predictors, nicht zwangsläufig
einen Tod im gesamten Navigator: Dessen reaktive Prüfung kann später noch stoppen.
Ein später Abbruch ersetzt aber keine belastbare Prognose, insbesondere im Flug.

**Gegenprobe Patrouille:** Grenzen 100..200, Geschwindigkeit 100 px/s. Zum Zeitpunkt
900 ms steht der Gegner bei x=190 und läuft rechts. Die lineare Prognose sieht
nach 500 ms x=240; die echte Spiel-Funktion liefert nach Umkehr x=160: 80 px Differenz.

**Folgerung:** Entweder erhalten Hilfen die zur jeweiligen Prognose nötigen,
freigegebenen Verhaltensdaten sichtbarer Objekte, oder sie behandeln unbekannte
Zukunft ausdrücklich als Unsicherheit. Momentaufnahmen rechtfertigen keine
Aussage „sicher“. Mehr Suchkandidaten beheben fehlende Information nicht.

## 2. Es gibt zwei Bewegungssysteme und mehrere Zeitraster

Im [Spiel](/Users/cbartel/Projects/jumparena-botchallenge/client/src/game/scenes/RaceScene.ts:390)
werden Input, Sprint-Rampe und Gefahren pro Render-Update vorbereitet; die Zeit
wird mit dessen `delta` fortgeschrieben. Arcade integriert fest mit 60 Hz und
kann pro Render-Update null, einen oder mehrere Physikschritte ausführen. Der
Bot entscheidet ungefähr alle 33 ms und seine Antwort kommt asynchron.

Der [Navigator](/Users/cbartel/Projects/jumparena-botchallenge/packages/bot-navigation/src/movement.ts:55)
aktualisiert Sprint/Sprung dagegen pro prognostiziertem Physikschritt. Seine
Kollisionen sind eine eigene Implementierung aus Achsentrennung und konservativen
Rechteckkorridoren; Arcade verwendet seine eigene Separation, Kontaktflags und
Collider-Reihenfolge. Gemeinsame Zahlenwerte bedeuten noch keine gemeinsame Semantik.

**Numerische Gegenprobe:** Erster Sprint-Sprung aus Ruhe, identische Konstanten.
Die vorhandene Spiel-Bewegungsformel ergibt bei einem 30-Hz-Renderdelta
-566,67 px/s Anfangsimpuls, bei 120 Hz -561,67 px/s. Das Navigationsmodell mit
60-Hz-Schritt ergibt -563,33 px/s. Das ist ein isolierter Formelvergleich mit
gleichem Startzustand, kein gemessener Gesamtsprung in drei Browsern.

**Folgerung:** Ein fester Arcade-Takt allein macht diesen Steuerungsablauf nicht
zu einem deterministischen Modellvertrag. Wir brauchen eine ausdrückliche Definition
von Beobachtungszeit, Input-Anwendungszeit und Gültigkeitsdauer. Eine technische
Änderung der Integration muss die gesetzten Mechaniken bewahren und gesondert
geprüft werden; das Spiel wird damit nicht zur Disposition gestellt.

## 3. Das Ausführungsbudget vermischt Entscheidung und Transport

[BotRunner](/Users/cbartel/Projects/jumparena-botchallenge/client/src/sandbox/BotRunner.ts:162)
startet den 5-ms-Timer vor `postMessage`. In diesem Zeitraum liegen Kopieren,
Worker-Scheduling, Framework-Planung, Besuchercode und Rücktransport. Das ist ein
Roundtrip-Zeitlimit, keine Messung der Laufzeit von `decide`.

**Gegenprobe:** Ein Fake-Worker liefert die triviale Antwort `right` nach 8 ms.
Ergebnis: `timeout`, Actions `[]`. Diese kontrollierte Transportverzögerung sagt
nichts über eine reale Timeoutquote oder die notwendige neue Grenzzahl aus.
Sie belegt aber, was das bestehende Limit tatsächlich bewertet.

Die Welt läuft während regulärer Entscheidungen weiter. Antworten sind gegen
Tick/Epoch korreliert, aber nicht an einen zugesicherten zukünftigen Physikschritt
gebunden. Langsame Geräte oder mehrere Worker können dadurch das Verhalten beeinflussen.
Die Bereitschaftsbarriere beim Start ist dagegen bereits eine sinnvolle Absicherung.

**Folgerung:** Schutz vor blockierendem Code, erlaubte Planungsarbeit und Alter
einer Steuerantwort getrennt spezifizieren. Nicht einfach den Timeout hochdrehen.
Die Last unter vier Bots muss separat gemessen werden, bevor das Standbudget gilt.

## 4. Der Entscheidungsraum gehört weiterhin teilweise der Automatik

`navigate({choose})` generiert Kandidaten, prüft sie, bietet eine Auswahl an,
führt einen Plan aus und entscheidet über Recovery/Fallback. Der Callback wird
nicht bei jedem Tick erneut aufgerufen. Nicht erzeugte oder zuvor verworfene Wege
kann die Besucherstrategie nicht auswählen.

**Gegenprobe:** Bei drei angebotenen Optionen gibt `choose` bewusst `null` zurück.
Der Navigator liefert `sprint-right`, Grund `route-selected`.
Das ist dokumentiertes Verhalten, kein neu entdeckter Implementierungsfehler.
Es zeigt aber: `null` ist Standardwahl, kein „nichts davon“. Ein Filter ist damit
kein zuverlässiges Veto gegen das Verhalten des Fallbacks.

`move` verbessert die Zielhoheit. Es verlangt allerdings vom Bot bereits
Plattform, Landepunkt, Jump/Sprint/Haltedauer und optional Boingo. Die aktuelle
Besucherdatei muss deshalb selbst eine Kandidatensuche über Bewegungsparameter
aufbauen. Das ist ein Teil des Navigationsproblems, den wir gerade auslagern wollten.

**Folgerung:** Eine klare Aufteilung wählen: Die Bot-Datei entscheidet über Ziele,
Prioritäten, Warten und Abbruch. Kleine Hilfen führen ausdrücklich angeforderte
Manöver aus und melden deren beobachteten Ausgang. Automatische Routensuche kann
ein austauschbarer Verbraucher dieser Hilfen sein, sollte aber nicht die Basis-API
und deren Entscheidungsfreiheit definieren.

## 5. Die Tests lassen genau die entscheidende Lücke offen

Der [Boingo-Test](/Users/cbartel/Projects/jumparena-botchallenge/packages/bot-navigation/src/boingoApproach.test.ts:64)
füttert den Executor mit Samples des Predictors. Die Closed-Loop-Tests der
Überkopfblock-Passage simulieren ebenfalls mit diesem Predictor.
[Scene-Tests](/Users/cbartel/Projects/jumparena-botchallenge/client/src/game/state/raceSceneObservation.test.ts:13)
mocken Phaser ausdrücklich. Die Dateien beschreiben diese Grenzen korrekt.

Damit sind viele nützliche Eigenschaften geprüft: Besitz laufender Pläne,
Lifecycle, Transportkorrelation, Budgetgrenzen und interne Geometriekonsistenz.
Aber ein gemeinsamer Modellfehler kann alle diese Tests passieren. Die heute
wiederholten 113 grünen Tests bestehen gleichzeitig mit den Gegenproben oben.

Meine bisherigen Aussagen über hohe Testzahlen haben deren Aussagekraft für das
Besucher-Erlebnis zu stark gewichtet. Auch „7 statt 40 Sekunden“ aus zwei alten
Läufen war kein kontrollierter Kausalnachweis für die Strategieänderung.

**Folgerung:** Wenige gezielte Vergleiche gegen echte Arcade-Ausführung sind
wichtiger als weitere Varianten im selben Prognosemodell. Dafür braucht es
keine neue Testseite oder Messeplattform. Testfall und tatsächliche Steuerung
müssen aber unabhängig vom zu prüfenden Predictor beobachtet werden.

## Was aus der Recherche folgt

Das [Mario-AI-Framework](https://github.com/amidos2006/Mario-AI-Framework)
stellt Agenten ein Forward Model bereit. Dessen
[Implementierung](https://raw.githubusercontent.com/amidos2006/Mario-AI-Framework/master/src/engine/core/MarioForwardModel.java)
klont die Spielwelt und ruft beim Fortschreiben deren `update(actions)` auf.
Das ist der relevante Unterschied: Planung stützt sich auf die Spieltransition.
Es folgt daraus weder, dass A* zwingend ist, noch dass wir das Java-Framework
übernehmen sollten.

[Phaser](https://docs.phaser.io/api-documentation/class/physics-arcade-world)
unterscheidet Render-Updates und feste Physikschritte; Collisions-/Overlap-Verarbeitung
gehört zur World-Ausführung. Die installierte Implementierung wurde zusätzlich lokal
geprüft. Die Webdokumentation wurde teilweise als Version 4.1.0 ausgeliefert und
wurde nicht als exakte Beschreibung jedes Details der installierten 4.2.1 ausgegeben.

[MDN](https://developer.mozilla.org/en-US/docs/Web/API/Worker/postMessage)
beschreibt `postMessage` als strukturierte Übertragung mit einem Task auf dem
empfangenden Event Loop. Daher kann ein äußerer Timeout nicht allein die Rechenzeit
der Botfunktion messen.

Die Arbeit von [Sutton, Precup und Singh](https://people.cs.umass.edu/~barto/courses/cs687/Sutton-Precup-Singh-AIJ99.pdf)
beschreibt zeitlich ausgedehnte Aktionen über Startbedingungen, eine interne Policy
und eine Abschlussbedingung. Für uns ist diese Trennung nützlich: „Boingo nutzen“
ist ein Ablauf mit Voraussetzungen und überprüfbarem Ende, keine einzelne Taste.
Das ist keine Empfehlung, Reinforcement Learning einzuführen.

[Chris Simpson](https://www.gamedeveloper.com/programming/behavior-trees-for-ai-how-they-work)
beschreibt länger laufende Aktionen mit running/success/failure. Ein kleiner
Zustandsautomat kann das für unsere wenigen Manöver ebenso ausdrücken; ein neuer
Behavior-Tree-Editor oder eine Bibliothek ist dafür nicht begründet.

[Gymnasium](https://gymnasium.farama.org/api/env/)
trennt Beobachtung, Aktion, Zustandsfortschritt und Ende eines Versuchs ausdrücklich.
Wir benötigen kein Gymnasium im Browser, aber einen ebenso eindeutigen Vertrag
zwischen State, Action und deren zeitlicher Wirkung.

## Empfehlung und Alternativen

| Ansatz | Vorteil | Wesentliche Grenze | Bewertung |
| --- | --- | --- | --- |
| Bestehenden Universalplaner weiter ergänzen | Viel Code bleibt direkt nutzbar | Fehlende Zukunftsdaten und Modellabweichungen bleiben | Nicht als nächster Schritt |
| Nur rohe Actions, alles in Besucher-Bots | Volle Freiheit, kleinste öffentliche API | Jeder Bot muss Timing und Bewegungswissen neu lösen | Als Ausweg erhalten, nicht als alleiniger Messeweg |
| Klare Basis-API + kleine beobachtbare Manöver + editierbare Strategie | Verantwortung und Fehler werden lokalisierbar | Benötigt zuerst verlässliche Zeit-/Bewegungsgrundlage | Empfohlene Richtung |
| Gemeinsames vollständiges Forward Model | Gute Grundlage für anspruchsvolle Planung | Phaser-Welt im Worker klonbar zu machen ist erheblicher Aufwand | Später bewerten, nicht sofort beginnen |

**Behalten:** Ein-Datei-Modul, State/Action-Grundvertrag, Worker-Isolation,
Metadaten/Validierung, Ready-Barriere, Epoch-Korrelation, reale Bounds/IDs,
vorhandene Vorschau und Traces. Das sind brauchbare Bausteine, keine Garantie
eines bereits vollständig geprüften Fundaments.

**Zuerst klären:** Zeitvertrag; welche Zukunftsinformationen sichtbarer Gefahren
bewusst zugänglich sein sollen; welche Zusagen die Hilfen wirklich machen.
Ein unvollständiger Snapshot kann sinnvoll sein, wenn Unsicherheit Teil des
Spiels sein soll. Dann dürfen wir keinen garantierenden Planer daraufsetzen.

**Dann belegen:** Gleiche Startbeobachtung und gleiche Inputs ergeben im Modell
und in Arcade innerhalb definierter Toleranzen dieselben Bewegungs-/Kontaktfolgen.
Besonders normale Sprünge, Boingo, Plattformkante, Decke und getaktete Gefahr.
30/60/120 Render-FPS und verzögerte Workerantworten gehören zur Abgrenzung.

**Erst danach:** Zwei oder drei kleine Manöver mit expliziten Voraussetzungen,
Fortschritt, Erfolg/Fehlschlag und Abbruch. Eine direkt editierbare Standardstrategie
kombiniert sie. Der Besucher ändert deren Entscheidungen. Automatische Navigation
kann später darauf aufbauen und muss austauschbar bleiben.

Noch offen: Welche Modellabweichung dominiert reale Todesfälle? Welches Zeitmodell
passt mit unveränderten Spielmechaniken und Turnierlast zusammen? Reicht ein kleiner
Manöversatz für alle bestehenden Levels? Diese Recherche belegt die heutigen
Lücken, aber nicht die Wirksamkeit einer noch nicht implementierten Alternative.
