# Untersuchung: gescheiterte Krupo-Besucherdemo

Stand: 17.09.2026. Reine Untersuchung nach ausdrücklichem Ende der Demo.
Keine Implementierungsfreigabe und kein Nachweis einer Reparatur.

## Ergebnis

Der Agent kann eingreifen: eigene Auswahl mit `navigate(...choose)`, eigene
Aufträge mit `run` und direkte Actions sind vorhanden. Es fehlt jedoch ein
unterstützter, beobachtungsbasierter Stomp-Auftrag. Die bequeme Navigation plant
Gefahrenvermeidung und Plattformlandungen, keine gezielten Gegnerkontakte.
Der Besucher-Agent hat diese Fähigkeitslücke zunächst als Auswahlproblem behandelt
und anschließend einen unzureichenden zweiten Bewegungscontroller geschrieben.
Damit wurde das Produktziel „Strategie beschreiben, Motorik übernimmt das
Framework“ in dieser Demo nicht erreicht.

## Belastbare Laufbefunde

Auswertung ausschließlich über den vorhandenen Reader mit `list`, `summary`
und gezielten `focus`-Aufrufen. Keine Rohdatenkopien oder Ersatzsimulation.
Aktuelle Botrevision: `bot-c102aad4`.

### Letzter vollständiger Versuch

Datei: `2026-09-17T11-47-46-178Z.json`, Session `2026-09-17T11:47:46.066Z`.
Level 1, Start x=80, Ende nach 89.966 ms durch Zeitlimit.
Maximaler Fortschritt 42,36 %, Endposition x=3153,27, keine technischen Fehler.

Bei Tick 1091:

- Bot x=3345,35; Zielrichtung positiv; nächste Lückenkante 30,65 Pixel entfernt.
- Sichtbarer `ninjafrog-3` 180,86 Pixel voraus, aktiv und stompbar, vx=60.
- Die nächste Plattform beginnt 158,65 Pixel voraus.
- Tatsächliche Entscheidung: `sprint-left` plus `jump`, Auftrag `navigation:58`,
  Ziel ist die bisherige Plattform `level-one:platform:7`.
- Bis Tick 1106 fällt x auf 3211,35. Das ist ein belegter Rückwärtssprung,
  kein fehlgeschlagener Stomp-Versuch auf den vorausliegenden Frog.

Bei Tick 2726:

- Bot steht bei x=3153,27, Rückgabe `[]`.
- Diagnose: `phase: blocked`, `reason: navigation-blocked`.
- Der Frog ist weiter sichtbar; der Bot nimmt seine Navigation nicht wieder auf.

### Ein einzelner Stomp war real, reicht aber nicht zur Abnahme

Im früheren Versuch `2026-09-17T11-45-05-012Z.json`, ebenfalls `bot-c102aad4`,
belegt Tick 908 `lastImpulse.kind: stomp`, `sourceId: ninjafrog-3`,
`atMs: 29641.54`. Danach landete der Bot und bewegte sich weiter. Der Versuch
endete nach 36.075 ms durch `hazard:schnetzler`.

Die frühere Aussage über einen bestätigten Stomp war sachlich belegt.
Sie belegte aber weder verlässliche Stomps noch einen erfolgreichen Gesamtlauf.
Auch „42 % ohne Tod“ war lediglich ein Zwischenstand. Das anschließende
Scheitern und Pendeln wurden zu früh als verbleibende Einschränkung akzeptiert.

## Ursachen im Framework

### 1. Kein ausführbarer Stomp-Vertrag

`packages/bot-contract/src/commands.ts:2` bietet `walk`, `drop`, `jump`,
`boingo`; Sprünge benötigen eine Plattform-ID. `NavigationIntent` ab Zeile 48
kennt `goal`, `coin`, `platform`, aber kein Gegnerziel.

`controller.ts:186` legt den Landepunkt beim Start fest. Laufende Parameter
dürfen unter derselben ID nicht verändert werden (`controller.ts:279`).
`navigator.ts:90` setzt einen laufenden Flug zunächst fort, bevor ein neues
strategisches Ziel übernommen wird. `choose` ist keine Steuerung pro Flugtick.

### 2. Der Angebotsgenerator kennt keinen erwünschten Gegnerkontakt

`options.ts:42` übernimmt Gefahrengeometrie und Geschwindigkeiten, aber nicht
die Eigenschaft `stompable`. `danger` ab Zeile 61 prüft eine vergrößerte,
prognostizierte Gefahrenbox. Bei Flugkontakt wird das Angebot an Zeile 265
verworfen. Eine Ausnahme für erwünschten Kontakt von oben fehlt.

Das tatsächliche Spiel unterscheidet dagegen Stomp und Schaden:
`RaceScene.ts:1067` prüft Abwärtsbewegung und relative Höhe; anschließend wird
über `resolveHazardContact` ein stompbarer Gegner zerstört und der Stomp-Impuls
mit Gegner-ID aufgezeichnet. Angebotsprüfung und Spielregeln haben somit
unterschiedliche Bedeutungen von „Kontakt mit einem Frog“.

`crossesEnemy` (`navigator.ts:230`) sagt lediglich, dass zwischen Start und
Landepunkt horizontal ein Gegner nahe der Ausgangshöhe liegt. Es enthält weder
Gegner-ID noch Kontaktzeit, Trefferprognose oder Stomp-Erfolgsbedingung.
Auch bewegliche, nicht stompbare Gefahren können dieses Merkmal setzen.

### 3. Eigene Auswahl übernimmt mehr Verantwortung als nur eine Präferenz

Mit `choose` entfallen der Filter für große Rückwege (`navigator.ts:177`)
und das Unterdrücken ausgewählter Rückwärtsbewegungen vor dynamischen Gefahren
(`navigator.ts:257`). Das ermöglicht gewollte Umwege, bedeutet aber auch:
Eine eigene Auswahl muss unerwünschte Rückwege selbst begrenzen.

Besuchsabhängige Bewertung und Fehlversuchssperren bleiben vorhanden.
Eine Strategie mit kategorischem „immer laufen, falls angeboten“ kann deren
Reihenfolge dennoch überstimmen. Fehlversuchssperren erfassen außerdem nicht
automatisch eine Folge technisch erfolgreicher, strategisch nutzloser Bewegungen.

### 4. Blockade ist terminal

Nach 20 Sekunden ohne ausreichenden neuen Bestfortschritt beendet
`navigator.ts:133` die Navigation mit `navigation-blocked`. Für dieselbe
Zielidentität bleibt dieser Zustand terminal. Ein erneutes `navigate(goal)`
startet keine neue Suche. Diese Begrenzung verhindert unendliche interne
Versuche; sie ersetzt weder eine erfolgreiche Wiederherstellung noch die
Reaktion der Strategie auf den Fehler.

### 5. Direkter Eingriff existiert, kostet aber Navigationszustand

`botWorkerRuntime.ts:168` setzt den Controller zurück, wenn der Bot direkte
Actions statt der unveränderten Helferausgabe zurückgibt. Das ist dokumentierte
Kontrollübergabe, kein Verbot des Eingreifens. Verloren gehen dabei auch
Besuchszähler, Sperren und Fortschrittsgedächtnis der Navigation.
Der Agent muss bei eigener Flugsteuerung deren Lebenszyklus und die Rückkehr
zur Navigation selbst verwalten.

## Fehler im von mir erzeugten Besucherbot

- Die erste Anpassung verwechselte „Gegner überqueren“ mit „auf ihm landen“.
  Die Bewertung einer Plattformlandung nach Nähe zu einer geschätzten
  Gegnerposition kann keinen kontrollierten Stomp erzeugen.
- Die Laufpriorität verdrängte notwendige frühe Sprünge. Der spätere
  Hindernischeck entschärfte eine Startstelle, bewies aber keine robuste Route.
- `current-bot.js:34` startet den direkten Bodenangriff nur innerhalb von
  `sprintMoveSpeed / 2`, hier 160 Pixeln. Beim belegten Rückwärtssprung war der
  Frog 180,86 Pixel entfernt: Der Angriff wurde gar nicht aktiviert.
- `current-bot.js:157` akzeptiert als letzten Ausweg das erste verbleibende
  Angebot, auch einen Rückwärtssprung. Es fehlt ein begrenzter, begründeter
  Wiederherstellungsplan. Die im Trace sichtbare Rückwärtsentscheidung wurde
  über diesen Navigationspfad ausgeführt, nicht über die direkte Stomp-Steuerung.
- Der direkte Angriff prüft weder die vollständige Flugbahn noch eine tragfähige
  Landung oder andere Gefahren; er hat keinen eigenen Timeout und wertet den
  bereits verfügbaren Stomp-Impuls nicht als Erfolgsbedingung aus. Er kann auch
  ein begonnenes Hindernismanöver übernehmen und dessen Steuerung zurücksetzen.
- `selectGoal` liefert immer einen Intent; `decide` kehrt an Zeile 173 zurück.
  Der darunter verbliebene `tools.status()`-Zweig ist unerreichbar. Auf
  `navigation-blocked` reagiert der Bot deshalb nicht.
- „Boingo nur als einzige Option“ wurde auf die momentane Angebotsliste bezogen.
  Selbst ein nutzloser Rückweg verhindert damit die Boingo-Wahl. Das ist keine
  Prüfung, ob eine vorwärts führende Alternative existiert. An Tick 1091 gibt
  es allerdings keine sichtbare Utility; dort erklärt diese Regel den Fehler nicht.

## Tests und Aussagegrenzen

Neu ausgeführt: `options.test.ts`, `navigator.test.ts`, `strategyChoice.test.ts`,
`goalNavigation.test.ts`, `raceRules.test.ts`: **74/74 bestanden**, fünf Dateien.

Der einschlägige Test in `strategyChoice.test.ts:48` setzt einen stillstehenden
Frog und prüft lediglich, dass ein Sprungauftrag ausgewählt wird. Er führt
keinen bewegten Gegnerkontakt bis zu einem beobachteten Stomp aus.
Die Regeltests prüfen Stomp-Zulässigkeit, nicht das Ansteuern des Kontakts.

Die bestehende `navigation-validation.md:54` benennt bereits eine offene
Abnahme. Die dortigen Übersprung-Nachweise ersetzen keinen Stomp-Nachweis.

Der kompakte Trace zeichnet nicht alle angebotenen und verworfenen Bewegungen
mit Ablehnungsgründen auf. Deshalb ist nicht abschließend bewiesen, welche
einzelne Vorwärtsflugbahn in Tick 1091 an welcher Prüfung scheiterte. Bewiesen
sind die Rückwärtsentscheidung, der nicht ausgelöste direkte Angriff, die
spätere terminale Blockade und die strukturell fehlende Stomp-Unterstützung.
Keine neue Phaser-Serie gestartet; keine Erfolgsquote aus Einzelversuchen abgeleitet.

## Empfohlene nächste Arbeit im bestehenden Feature

1. Stomp als ausdrückliche, beobachtungsbasierte Fähigkeit spezifizieren:
   Gegner-ID, vorbereitende Bewegung, gezielter Kontakt von oben, Nachsteuerung,
   bestätigter Impuls, Fortsetzung nach dem Bounce und begrenzter Fehlschlag.
   Öffentliche Form noch entscheiden; keine festen Levelrouten.
2. Bewegungsprüfung zwischen schädlichem Kontakt und zulässigem Stomp
   unterscheiden lassen. Bloß den Sicherheitsabstand zu verkleinern reicht nicht.
3. Rückzug, Wiederholung und Blockadestatus für eigene Auswahlregeln verbindlich
   behandeln; ausdrückliche Umwege weiterhin ermöglichen.
4. Kompakte Diagnose um gewähltes Manöver, Gegnerbezug und wesentliche
   Ablehnungsgründe ergänzen, damit Ursachen ohne Rohdaten-Dumps prüfbar sind.
5. Vor Umsetzung regressionsfähige Fälle festlegen: bewegter Frog auf Boden,
   Frog hinter Lücke, Richtungswechsel, Überhang, unerreichbarer Frog,
   nicht stompbare Gefahr, Bounce und Übergabe an die Zielnavigation.
6. Danach TDD und wiederholte Läufe im unveränderten Phaser-Spiel. Einzelstomp,
   Zielankunft und Erfüllung von Lauf-/Sprung-/Boingo-Präferenzen getrennt messen.

Ein weiterer Grenzwert-Patch in Krupo wäre keine belastbare Behebung dieser
Fähigkeitslücke. Die obige Untersuchung beschreibt den Stand vor der Reparatur.

## Umsetzung nach ausdrücklicher Freigabe ohne schwergewichtigen Spec-Modus

Die Reparatur erfolgt im gemeinsamen Framework, testgetrieben:

- `enemies: "stomp"` erzeugt ausdrückliche Stomp-Manöver mit Gegner-ID und
  geprüftem Landeziel. Andere Gefahren bleiben Hindernisse.
- Der Motor verfolgt bewegte Gegner, hält den Aufstieg bei noch fehlender
  horizontaler Ausrichtung länger und bestätigt Erfolg anhand des passenden
  Stomp-Impulses plus anschließender Landung. Bloßes Verschwinden zählt nicht.
- `movement: "ground"` bevorzugt brauchbare Laufwege; `allowBoingo: "fallback"`
  erlaubt Boingos erst ohne andere vorwärtsführende Angebote.
- Wiederholte erfolgreiche Rückwege ohne Fortschritt werden ausgeschlossen.
  Veränderte Gefahrensituationen erlauben begrenzte Wiederaufnahme nach Blockade;
  eine geänderte Strategie kann ebenfalls neu planen.
- Trace-Diagnosen enthalten angegriffenen Gegner und Landeplattform.
- Krupo und `examples/navigation/stomper.js` verwenden diese API unmittelbar.
  Der konkurrierende rohe Angriffscontroller in Krupo entfällt.
- Zusätzlich bleibt die Fallspalte eines Spikeheads beim Ende seiner Warnung
  gesperrt. Dies ist im Angebotsgenerator und im Laufmotor abgesichert.

### Verifikation und verbleibende Grenzen

Gesamtsuite: **146 Dateien, 1.288 Tests bestanden**. Workspace-Build erfolgreich
(bestehender Vite-Bundlegrößenhinweis). Read-only-Review fand einen Fehler beim
Strategiewechsel aus terminalem Zustand; dieser wurde mit Regressionstest behoben.

Reale Phaser-Läufe auf Level 1, Start am Levelanfang, 90 Sekunden, unendliche Leben:

- Vor adaptivem Sprunghalten: Sessions 11:58:18.222Z und 12:00:01.312Z,
  Ziel in 39,8 bzw. 36,3 Sekunden ohne Tod; bestätigte Stomps im Trace.
- Mit adaptivem Halten: Session 12:08:51.804Z, Ziel nach Trace in 38,277 Sekunden
  ohne Tod, 189 Fruchtpunkte.
- Abschließender Stand einschließlich Fallspaltenkorrektur: Session
  12:10:00.642Z, Ziel laut UI in 41,6 Sekunden, 196 Fruchtpunkte, **ein Tod**.
  Bestätigte Stomps; Tod an Spikehead-1 während eines Sprungs. Bei Sprungbeginn
  ruhte der Kopf unten (vy=0), anschließend stieg er in die Flugbahn.
- Ein früherer Lauf (12:05:26.930Z) hatte nach einem Spikehead-Tod eine
  Feuer-/Checkpoint-Respawn-Schleife mit 185 Toden. Dieser Lauf gilt ausdrücklich
  nicht als erfolgreicher Zuverlässigkeitsnachweis.
- Wiederholung mit abschließendem Stand: Session 12:11:06.173Z, Ziel in
  38,5 Sekunden laut UI (38,417 Sekunden laut Trace), 189 Fruchtpunkte,
  kein Tod. Dies hebt den vorherigen Spikehead-Fehlschlag nicht auf.

Level, Physik und Respawn-Regeln wurden nicht verändert. Die Gefahrvorhersage
kennt bei einem ruhenden Spikehead dessen bevorstehenden Phasenwechsel nicht.
Eine allgemeine fehlerfreie Gesamtroute und ein zuverlässiger Respawn bei aktivem
Feuer sind weiterhin nicht nachgewiesen. Die Stomp-Fähigkeit ist durch Tests
und beobachtete Kontakte belegt; diese Aussage ist enger als eine vollständige
Messe-Abnahme.
