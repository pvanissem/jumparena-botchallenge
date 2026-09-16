# Design: Verlaessliche Messe-Bots

## Aktuelle Nutzerkorrektur: vollständiger Einzelbot-Lauf

Der Nutzer verlangt ausdrücklich die Arbeit in `/dev` an einem sinnvoll
spielenden Bot über das ganze unveränderte Spiel. Turniertests sind dafür
kein Abnahmekriterium. Isolierte Boingo-Erfolge belegen nur diesen Mechanismus.
Die offen lesbare Beispielstrategie darf konkret für Level 1 aufgebaut und
anhand vollständiger Läufe korrigiert werden; Strategie bleibt Besuchercode,
Bewegungsausführung bleibt im kleinen Framework.


## Status

### Freigegebene Umsetzung v2

Verbindlicher aktueller Entwurf: [neuentwurf.md](neuentwurf.md). Der Nutzer hat
nach dessen Vorstellung die Umsetzung ausdrücklich autonom beauftragt. Die
historischen v1-Abschnitte unten beschreiben den abzulösenden Stand.
`ToolsApi` besteht künftig aus `run(command)` und `status()`; Ausführung in einem
kleinen zustandsbehafteten Controller innerhalb des vorhandenen Pakets.
Tests zuerst für Ownership, Beobachtungen und einfache Bewegungen; anschließend
Worker, Impulse und Vorlage anbinden. Keine neue Infrastruktur/Level/Physik.



### Umsetzung der freigegebenen Besucher-Manöver

Additiv zu `tools.navigate({ choose })` erhält `ToolsApi`:
`move(command)`, `continue()`, `status()` und `cancel()`.
Ein `MovementCommand` enthält `id`, `platformId`, optional absolutes `x`,
`jump`, `sprint`, `holdMs` und `viaUtilityId`. Ohne x wird die Plattformmitte
angesteuert. IDs beziehen sich ausschließlich auf sichtbare State-Objekte.

`move` prüft genau diesen Wunsch mit dem bestehenden Predictor (maximal 256
Schritte). Nur eine nachgewiesene Landung auf der gewünschten Plattform und,
falls angegeben, Kontakt mit dem gewünschten Boingo erzeugt einen aktiven Plan.
`index.ts` verwendet dieselbe Ausführung/Sicherheitsprüfung wie automatische
Pläne. Eigene Manöver werden bei Landung beendet, nicht automatisch ersetzt.
`status` liefert `busy`, `commandId`, `state` (idle/running/completed/blocked)
und `reason`; `continue` setzt den aktuellen Plan fort. Ein neues Manöver bei
laufendem Plan verlangt zuerst `cancel`. Gleiche IDs dürfen laufende identische
Manöver wiederholen; abgeschlossene IDs werden nicht automatisch neu gestartet.

Worker-Tools bleiben tickgebunden. Höchstens ein Motoraufruf (`navigate`,
`move`, `continue`) pro Tick; `cancel` ist davor erlaubt. Eigene Actions ohne
Motoraufruf verwerfen den bisherigen Plan. Epoch-/Respawn-Wechsel setzen
Status bereits vor dessen Abfrage zurück. Alte API-v1-Bots bleiben unverändert.

Tests: gewünschte Plattform unabhängig von Fortschritt, Boingo-Kontakt,
Ablehnung unbekannter/unerreichbarer Ziele, Planbesitz/Abbruch/Respawn und
Worker-Lebensdauer. Beispielbot wählt selbst Plattformen und Trampoline anhand
Geometrie; Regression zeigt Wirkung reiner Besucher-Codeänderungen. Danach
Gesamttests/Build und Live-Lauf in vorhandener Vorschau, ohne Erfolgsquote.

Aktuelle Levelvorgabe: Keine Levelaenderungen. `/code` verwendet wieder
`level-one`; `level-messe` und seine Registry-Eintraege entfallen auf
ausdruecklichen Nutzerwunsch. Anderslautende Abschnitte unten sind ueberholt.

Aktuelle Scope-Korrektur auf ausdruecklichen Nutzerauftrag: Testseite,
Test-CLI, Jobs/Leases, Revisionsvergleich und reine Testzugriffe in `RaceScene`
entfallen ohne Ersatz. Navigation bleibt im Framework; Ausprobieren und
Feedback erfolgen ueber `/code` und dessen vorhandene Traces. Diagnose-
Vorsorgefelder ohne Produzenten und doppelte Verarbeitung werden entfernt.
Das einfachere Messelevel und konkrete Wahrnehmungs-/Laufzeitkorrekturen bleiben.
Die entsprechenden Abschnitte des folgenden grossen Entwurfs sind nur noch
historischer Kontext; sie sind kein Auftrag fuer weitere Infrastruktur.

Requirements am 2026-09-15 freigegeben; Ein-Datei-Vorgabe anschliessend vom
Nutzer praezisiert. Das entsprechend ueberarbeitete Design wurde vom Nutzer
mit "jo" explizit freigegeben. Die Task-Liste wird separat zur Freigabe vorgelegt.

## 1. Architektur und Grenzen

Die bestehende Phaser-Arena, ihre Regeln, der Worker und der Transport der
Bot-Datei bleiben erhalten. Arbeitsdatei und Abgabeartefakt sind identisch:
`client/src/bot/current-bot.js`. Es gibt kein separates Autorenformat, keine
zweite Besucherdatei und keinen Buildschritt fuer den Bot.

```text
current-bot.js: Metadaten + decide(state, tools)
                       |
       unveraendert testen / kopieren / abgeben
                        |
           bestehender Browser-Worker
           laedt die eine Bot-Datei
           stellt Framework-tools bereit
                        |
      Framework-Navigation -> Action[] -> RaceScene
```

Der Core ist ein neues Workspace-Paket `@arena/bot-navigation`, ohne Phaser-,
DOM- oder Netzwerkabhaengigkeit. Er enthaelt lokale Planung und Planausfuehrung
und wird mit dem Framework gebaut, nicht mit jedem Besucherbot. Der Worker
stellt seine Funktionen als zweites Argument `tools` von `decide` bereit.
Funktionen werden im Worker erzeugt, nicht per `postMessage` uebertragen.

Die Aufgabe wird nicht zu einem Konfigurator: Besucherstrategien duerfen eigene
Bewertungen, Bedingungen und Closure-Zustaende enthalten. Der empfohlene Pfad
gibt die Actions der Framework-Navigation unveraendert zurueck; eigene Reflexe
rund um deren Motorik sind nicht Teil des Strategie-Vertrags. Der bestehende
Low-Level-Action-Contract bleibt fuer selbst steuernde Bots verfuegbar.

Nicht vorgesehen sind ein neuer Physikserver, ein Node-Port von Phaser,
globale Allzweck-Navigation oder umfassende neue Worker-Sicherheitsgarantien.

## 2. Gemeinsame und korrekte Wahrnehmung

### Aufnahme der realen Welt

`RaceScene` nimmt einen Snapshot der aktiven Spielobjekte auf. Die vorhandenen
State-Builder bleiben die einzige Umrechnung in den Bot-Contract:

- Hazardposition und Collider stammen aus den lebenden Hazard-Instanzen,
  nicht Patrol-Startpunkt, Pendel-Pivot oder Spikehead-Zielposition.
- Geschwindigkeiten entstehen genau einmal pro Beobachtungstick aus zwei
  Weltpositionen und der verstrichenen Simulationszeit. Kollisionscallbacks
  lesen Aktivitaet direkt und veraendern diese Historie nicht.
- Beim ersten Tick, Respawn, Controllerwechsel oder nichtpositivem Messintervall
  wird die Historie zurueckgesetzt; fuer die erste Messung gilt Geschwindigkeit 0.
- Alle aktiven, noch einsammelbaren `world.coins` werden aufgenommen, auch
  Blockfruechte. IDs und Fruchtwerte kommen aus den bereits vorhandenen Metadaten.
- Ausgeloeste Bloecke bleiben als solide Geometrie erhalten, solange ihr
  Physik-Body existiert. Ihr Rastertyp wird nach Ausloesung `solid`.
- Entfernte Hazards verschwinden aus Objektliste und Raster. Bewegliche Hazards
  werden auch im Raster an ihrer beobachteten Position eingetragen.
- `tuning.botWidth/botHeight` entsprechen den effektiven World-Body-Massen.
  Skalierungsfaktoren werden nicht ein zweites Mal im Planner angewendet.

Position, Geschwindigkeit und Ground-Status werden aus derselben abgeschlossenen
Physikphase aufgenommen. Die bestehende Bedeutung von `position` und `dx/dy`
wird nicht still in Body-Ecken umdefiniert; Body-Geometrie ist separat.

### Additive Contract-Felder

Bestehende Felder bleiben erhalten. Sichtbare Objekte erhalten stabile `id`s;
Plattform-IDs werden deterministisch aus Level-ID und Definitionsindex erzeugt.
Objekte erhalten bei Bedarf `bounds: { dx, dy, width, height }`, relativ zu
`state.position`. Plattformen erhalten `collision: "solid" | "one-way-up"`.

Eine optionale `navigation`-Observation mit `version: 1` enthaelt:

- `epoch`, `frame`, `observedAtMs` und `physicsStepMs`;
- tatsaechliches Spieler-Body-Rechteck;
- Bewegungszustand: Sprunghaltezeit, Impulsursprung `jump | boingo | stomp | none`,
  Impulszeitpunkt und gegebenenfalls Utility-/Hazard-ID;
- sichtbares Rechteck und, falls sichtbar, den Ziel-Overlap-Collider;
- benoetigte Bounce-Konstanten aus derselben Quelle wie die Arena.

Der neue Core verlangt Observation-Version 1 und meldet fehlende Unterstuetzung
verstaendlich. Alte `decide`-Bots brauchen diese Felder nicht. Die API enthaelt
keine unsichtbaren Levelobjekte, versteckten Fruchtwerte oder Hazard-Zeitplaene.

`gapAhead` bleibt eine Legacy-Abkuerzung; neue Planung ermittelt Stuetze und
Luecken aus Body und Plattformgeometrie in der gewaehlten Bewegungsrichtung.

## 3. Besucherstrategie

### Die einzelne Bot-Datei

`client/src/bot/current-bot.js` bleibt ein ES-Modul ohne Imports mit
`apiVersion: 1`, Metadaten und `decide`. Optionales `frameworkVersion: 1`
deklariert die benoetigte Tools-Schnittstelle. Beispiel des vorgeschlagenen,
noch nicht implementierten Aufrufs:

```js
function chooseRoute(context, options) {
  const goalRoutes = options.filter((option) => option.target.kind === "goal");
  goalRoutes.sort((a, b) => b.route.goalProgressPx - a.route.goalProgressPx);
  return goalRoutes[0]?.id ?? null;
}

export default {
  apiVersion: 1,
  frameworkVersion: 1,
  name: "Mein Bot",
  author: "Gast",
  decide(state, tools) {
    return tools.navigate({ choose: chooseRoute });
  },
};
```

Die Hilfsfunktion und alle individuellen Regeln stehen in derselben Datei.
Die Datei kann direkt abgegeben werden. `tools.navigate` verwendet intern
den aktuellen State dieses Ticks; der Bot muss keinen gefaelschten Ziel-State
konstruieren. Der Framework-Vertrag lautet:

```ts
interface BotTools {
  navigate(options?: {
    choose?: (context: StrategyContext, options: readonly RouteOption[]) => string | null;
  }): Action[];
}

interface StrategyContext {
  timeElapsedMs: number;
  timeRemainingMs: number;
  livesRemaining: number;
  justRespawned: boolean;
  previousTargetId: string | null;
}

interface RouteOption {
  id: string;
  target: {
    id: string;
    kind: "coin" | "goal";
    position: { x: number; y: number };
    value: number;
  };
  route: {
    id: string;
    estimatedDurationMs: number;
    detourPx: number;
    expectedFruitValue: number;
    goalProgressPx: number;
    risk: number;
    landingMarginPx: number;
    mechanics: Array<"walk" | "jump" | "drop" | "boingo" | "stomp">;
    scope: "target-reachable" | "local-progress";
  };
}
```

`navigate` besitzt pro Bot-Worker eine persistente Navigatorinstanz. Die
Strategie-Callbackfunktion `choose` wird nur an sicheren Entscheidungspunkten
aufgerufen; waehrend eines Manoevers setzt die Instanz ihren Plan fort.
Mehrfacher `navigate`-Aufruf im selben Tick wird als API-Fehler gemeldet, damit
Planausfuehrung und Zaehler nicht versehentlich mehrfach fortgeschrieben werden.
Der Aufruf ist synchron, nur waehrend `decide` gueltig und an den aktuellen
State gebunden. Das eingefrorene Tools-Objekt gibt keine internen Instanzen frei.

`choose` liefert eine angebotene Options-ID, keinen Plan und keine Actions.
`null` waehlt den dokumentierten Standard: bekannte Ziel-Fortsetzung mit
niedrigem Risiko und Fortschritt. Eine unbekannte ID erzeugt einen Hinweis und
denselben Fallback. Exceptions laufen durch die bestehende Worker-Fehlerbehandlung.
Optionen und Context sind Kopien, keine veraenderbaren internen Planreferenzen.

`risk` ist ein transparenter relativer Kostenwert, keine Sterbewahrscheinlichkeit.
Er setzt sich aus knappen Landepuffern, Prognosehorizont und unsicherer Bewegung
benachbarter Hazards zusammen. Bekannte Kollisionen werden vorher ausgeschlossen,
nicht durch einen niedrigeren Risikoaufschlag legitimiert.

### Drei Referenzstrategien

Alle drei verwenden denselben Core-Release und stabile Tie-Breaks nach Options-ID:

| Strategie | Entscheidung |
| --- | --- |
| Sprinter | Ziel-Fortsetzung mit groesstem Fortschritt pro geschaetzter Sekunde; kein gezielter Sammelumweg |
| Sammler | Erreichbarer Fruchtwert pro Zusatzzeit, maximal 320 px Umweg; ab 65 s Ziel-Fortsetzung |
| Vorsichtiger | Zuerst geringstes Risiko, dann groesster Landepuffer, dann Fortschritt; keine geplanten Stomps |

Die Standardvorlage enthaelt eine vollstaendige einfache Fortschrittsstrategie
und nichtleere Platzhalter fuer Namen. Sie muss sofort laufen. Name und Autor
werden im Besuchergespraech ersetzt, ohne dass dies Voraussetzung fuer Bewegung ist.

## 4. Lokale Navigation

### Ziele und erreichbare Routen

Der Planner baut einen kleinen lokalen Graph aus begehbaren Intervallen der
sichtbaren Stuetzflaechen. Ein Zustand umfasst Flaeche, Stand-/Anlaufintervall,
Richtung und relevante Geschwindigkeit, nicht nur eine Plattformmitte.
Kanten sind ausfuehrbare Lauf-, Sprung-, Fall- oder Bounce-Manoever.

Eine Fruchtoption ist erst `target-reachable`, wenn eine geplante Bahn ihren
Einsammel-Collider durchquert und anschliessend auf einer bekannten tragenden
Flaeche landet beziehungsweise tragfaehig weiterlaeuft. Naehe zum Fruchtzentrum
allein reicht nicht. Versteckte Bloecke sind zunaechst Hindernisse, keine Ziele;
nach Freilegung werden ihre Fruechte wie alle anderen behandelt.

Fuer ein entferntes Levelziel werden `local-progress`-Optionen angeboten.
Diese versprechen ausschliesslich den naechsten bekannten Teilweg, nicht einen
vollstaendigen Weg durch unsichtbares Gelaende. Nach Zwischenlandungen wird die
Fortsetzung erneut geprueft. Das echte `goalDirection` wird nicht durch einen
Fruchtvektor ersetzt.

Initiale feste Suchgrenzen: acht Fruchtziele plus Levelziel, maximal 32
Graphzustaende, Routentiefe drei, maximal 24 ausgegebene Optionen und maximal
256 Integrationsschritte je Entscheidung (nach Kaltstartmessung gegenueber
dem Entwurf mit 2.048 reduziert). Einzeltrajektorien und Planung koennen an sicheren Standorten
ueber mehrere Ticks fortgesetzt werden; ein geometrie-/epochengebundener Cache
vermeidet Neuberechnung. Maximal 500 ms Simulationszeit fuer einen Planungsversuch.
Budgetende bedeutet `search-budget-exhausted`, nicht `unreachable`.

Diese Grenzen sind Startwerte und werden unter echtem Worker-Roundtrip gemessen.
Sie duerfen nur dokumentiert mit erneutem Performance-Nachweis geaendert werden;
das produktive 5-ms-Zeitbudget wird nicht still erhoeht.

### Bewegungsmodell und Kollisionsnachweis

Vorhandene reine Bewegungsformeln werden wiederverwendet beziehungsweise in
einen gemeinsamen reinen Baustein verschoben. Der Predictor integriert mit dem
gemeldeten Physikraster, nicht mit einem angenommenen 33-ms-Physikschritt.
Er bleibt eine begrenzte Vorhersage und wird gegen Phaser verifiziert.

- Solide Collider beruecksichtigen Wand-, Boden- und Deckenkontakte.
- `one-way-up` kollidiert nur von oben beim Fallen; von unten und seitlich
  durchlaessig. Drop-through wird nicht erfunden, Abstieg erfolgt ueber die Kante.
- Jump-Cut wirkt nur im Aufstieg eines normalen Sprungs nach Mindesthaltezeit.
- Die dokumentierte Sprint-Ruecksetzung bei Stillstand, Richtungswechsel und
  normalem Laufen gilt gemeinsam fuer Arena und Predictor.
- Boingo und Stomp beenden den alten normalen Sprungzustand. Ihr externer Impuls
  darf nicht vom verbliebenen Jump-Cut-Timer abgeschnitten werden.
- Bounce-Kandidaten modellieren Kontakt, Folgeimpuls und anschliessende Landung.
  Ein Stomp wird nicht bloss aus der Hazardpruefung herausgefiltert.

Die Sprint-/Bounce-Korrekturen sind ausdrueckliche Korrekturen bestehender
Bewegungssemantik, keine neuen Tuningwerte. Tastatur und Bot verwenden denselben
Pfad; bestehende Bots bleiben ausfuehrbar, aber nicht pixelidentisch.

Eine abgesicherte Landung referenziert eine konkrete Stuetzflaeche, eine
abwaerts gerichtete Oberkantenquerung, einen freien Anflug und mindestens
acht Pixel seitlichen Body-Landepuffer. Der tatsaechliche Phaser-Kontakt wird
im Regressionstest nachgewiesen. Kein bekanntes Landen bedeutet keine Freigabe
durch Weltgrenzen, Zielnaehe oder optimistische Annahmen ueber unbekannten Boden.

Dynamische Hazardprognosen bleiben unsicher. Alle sichtbaren Hazards im
Manoeverkorridor werden betrachtet, nicht nur die naechsten 170 px. Lineare
Extrapolation beweist weder Umkehrzeiten noch kuenftige Aktivitaet. Geometrisch
abgesicherte Landung und dynamisches Risiko werden getrennt diagnostiziert;
laufende Plaene ueberwachen neu beobachtete Gefahren.

### Ein Besitzer der Motorik

Die Framework-Navigatorinstanz verwaltet `select`, `execute`, `wait`, `recover`
und `blocked`. Ein Plan besitzt Ziel-/Routen-/Plan-ID, Phase, Sollkorridor,
Abschlussbedingung, Deadline und benoetigte Collider-/Utility-IDs.

Prioritaet pro Tick:

1. Neue Epoche, Tod oder Respawn: alten Plan und Recovery verwerfen.
2. Nachgewiesene neue Gefahr oder ungueltige Voraussetzungen: sichere Korrektur.
3. Laufendes Manoever fortsetzen; normale Strategiewechsel unterbrechen es nicht.
4. An sicherem Entscheidungspunkt Optionen neu bewerten.

Ein Fruchtziel bleibt ueber seine ID gebunden, nicht ueber einen alten relativen
Abstand. Verschwinden ausserhalb der Sicht gilt nicht automatisch als Einsammeln.
Fortschritt ist phasenabhaengig: Anlauf, Hoehengewinn, Bounce und Landung zaehlen.

Maximal zwei Recovery-Versuche pro Ziel und Geometriezustand, jeweils hoechstens
1,5 s. Danach wird das Ziel drei Sekunden beziehungsweise bis zu relevanter
Geometrieaenderung gesperrt. Sicheres Level-Fortschrittsziel hat Vorrang vor
erneutem Pendeln. Jede Rueckwaertsbewegung wird auf Boden und Hazards geprueft.
Wenn keinerlei bekannte Fortsetzung existiert, beendet `blocked` den
Neuplanungszyklus mit Diagnose. Warten auf neue Information ist dann explizit,
kein unbegrenzter aktiver Recovery-Loop oder blinder Sprung.

## 5. Abgabe und Framework-Kompatibilitaet

Vorschau, Test und Sammelstelle verwenden unveraendert den Inhalt von
`current-bot.js`. Abgabe ist Kopieren beziehungsweise Hochladen dieser einen
Datei. Kein Bundler, keine generierte Wrapperdatei, keine beigelegte Bibliothek,
kein Release-Manifest des Besuchers und kein zusaetzlicher Exportbefehl.
Der bestehende Rohtext-Import in `currentBotSource.ts` bleibt der Vorschaupfad.
Guard, Modulvalidierung und 200.000-Byte-Grenze pruefen diese Datei direkt.
Bei Fehlern darf die UI keine alte Revision als erfolgreich aktualisiert zeigen.

Framework-Hilfen gehoeren zum Betreiber-Release. Vorschau, Testseite,
Uploadvalidierung und Turnier verwenden denselben Worker-Initialisierungspfad:

1. Bot-Quelltext laden und `apiVersion: 1` wie bisher validieren.
2. Optionales `frameworkVersion` validieren. Version 1 bedeutet die neue
   Tools-API; unbekannte angeforderte Versionen werden vor dem Lauf abgelehnt.
3. Fuer Bots mit `frameworkVersion: 1` eine eigene Navigatorinstanz erzeugen
   und `decide(state, tools)` aufrufen. Alte Bots ohne dieses Feld werden
   unveraendert mit `decide(state)` aufgerufen, ohne implizite Navigation.
4. Actions wie bisher normalisieren und anwenden. Keine Hauptthread-Ausfuehrung
   von Besucher-Code und keine gemeinsamen veraenderbaren Plaene zwischen Bots.

Die Tools-API-Version steht bei Bedarf in derselben Bot-Datei. Die genaue
Framework-Implementierungsrevision steht in Test-/Turniermetadaten und gehoert
zu den Vergleichsbedingungen, nicht als eingebetteter Core zum Bot-Artefakt.
Ein Frameworkupdate kann deshalb das Verhalten unveraenderter Bots verbessern
oder veraendern. Fuer eine Turnierserie wird ein einheitlicher Framework-Release
verwendet; Updates waehrend der Serie sind ausgeschlossen. Keine automatische
Auswahl verschiedener Core-Releases pro Teilnehmer und kein Nachladen vom Netz.

`current-bot.template.js` wird zu einer kurzen, sofort laufenden Vorlage mit
Framework-Aufruf. `npm run reset-bot` kopiert weiterhin diese Vorlage nach
`current-bot.js` und leert die Session-Traces/Testergebnisse. Bestehender
Besuchercode wird bei der Einfuehrung nicht automatisch ueberschrieben oder
migriert. Es gibt weder zweiten Arbeitsmodus noch zusaetzliche Arbeitsdatei.

Alte Beispieldateien bleiben als vollstaendige v1-Bots erhalten. Neue Referenzen
liegen unter `examples/strategies/`, sind aber ebenfalls direkt abgebbare
Bot-Dateien mit `apiVersion`, Metadaten und `decide`, keine Vorprodukte.
Kompatibilitaet bedeutet ladbar und ausfuehrbar, nicht identische Ergebnisse
trotz korrigierter Wahrnehmung. Neue Tools-Bots benoetigen ein Framework, das
ihre deklarierte Tools-Version unterstuetzt, genau wie andere API-Erweiterungen.

## 6. Laufzeit und eindeutige Korrelation

Der Runner bekommt eine explizite `whenReady()`-Barriere. Modulfehler, Worker-
Fehler, Initialisierungsdeadline und Dispose loesen wartende Promises definiert
auf. Keine Entscheidung vor `module-ready`, maximal eine ausstehende Anfrage.

Die Szene besitzt die fachliche Ticknummer; Worker-Request-IDs werden nicht
als State-Ticks ausgegeben. Zuordnung erfolgt ueber Session, Epoche und
State-Tick. Ein Controllerwechsel invalidiert alte Promises und Antworten.
Dispose beendet auch ausstehende Entscheidungen. Spaete Antworten werden
weiterhin verworfen, nicht auf den naechsten Tick uebertragen.

Der Scene-Ablauf bleibt in Vorschau, Turnier und Test derselbe: In `PRE_UPDATE`
die neueste verfuegbare Action einmal vor der Physik anwenden; nach abgeschlossener
Physikphase in `POST_UPDATE` konsistent beobachten und die Entscheidung anfragen.
Die asynchrone Antwort speichert Actions fuer das naechste `PRE_UPDATE`, ohne
Bewegung oder Sprinttimer selbst erneut auszufuehren. Das Bot-Intervall
bleibt 33 ms; Restzeit wird mitgenommen, aber es gibt keine Burst-Nachholung
mehrerer Entscheidungen auf demselben State. Verzoegerungen sind beobachtbar.

Die Action-Antwort und ihre tatsaechliche Anwendung sind unterschiedliche
Ereignisse. Diagnose nennt `stateFrame`, `stateTick`, `appliedFrame` und die
normalisierten, tatsaechlich gesetzten Actions. Workerzeit wird getrennt vom
Roundtrip gemessen; das produktive 5-ms-Limit bleibt ein Roundtrip-Limit.

## 7. Agentenbedienbare Tests mit echter Physik

### Browser-Teststation statt zweiter Engine

Ein explizit aktivierter, nur an Loopback gebundener Vite-Testserver stellt
`/__bot-test` bereit. Der Betreiber oeffnet diese Seite einmal selbst.
CLI und Agent starten keine GUI und benoetigen weder CDP noch Browserautomation.
Ein eigener schlanker Seiteneinstieg verwendet vorhandenes Phaser, Assets,
`RaceScene` und fuer Gruppen den vorhandenen `MatchRunner`.

Phaser HEADLESS unter Node ist hier kein einfacher Ersatz: die vorhandene
Szene benoetigt Browser-Assets, Canvas und Modul-Worker. Deshalb kein neuer
DOM-/Canvas-/Worker-Port und keine zusaetzliche Test-Physik.

Vorgesehene Befehle, erst mit Implementierung verfuegbar:

```sh
npm run bot:test -- doctor
npm run bot:test -- run --scenario mechanics --mode fixed
npm run bot:test -- run --scenario messe-v1 --mode realtime
npm run bot:test -- compare --before <datei> --after <datei>
```

Der Test liest einmalig die unveraenderte Bot-Datei ein. Weitere Dateiaenderungen
veraendern den Auftrag nicht. Ein Engine-/Fixture-Reload bricht den Auftrag
explizit als Infrastrukturabbruch ab, statt unbemerkt neu anzufangen.

### Begrenzter Transport

`botTestPlugin.ts` verwaltet einen aktiven Auftrag im Speicher:

- `GET /__bot-test/api/status`: Bereitschaft, Protokollversion und Belegung.
- `POST /__bot-test/api/jobs`: validiertes Artefakt plus Szenario und Modus.
- `GET /__bot-test/api/jobs/:id`: Status und finales Ergebnis.
- `DELETE /__bot-test/api/jobs/:id`: Abbruch.
- Browser-Claim/Heartbeat und Ergebnis-POST sind an Job-ID und Lease gebunden.

Maximal 200.000 Bytes Artefakt, 2 MiB Ergebnis, ein Auftrag gleichzeitig,
zehn Ergebnisse im Speicher und zehn Minuten Aufbewahrung.
Host-/Origin-Pruefung und strikt lokale Bindung verhindern offenen LAN-Zugriff;
kein beliebiger serverseitiger Dateipfad und keine automatische CORS-Freigabe.
Gemaess expliziter Nutzerkorrektur entfallen Session-Token und Authorization
vollstaendig. Die Browserseite bietet "Verbinden" ohne Eingabefeld; die CLI
benoetigt nur die lokale Serveradresse. Job-Leases dienen weiterhin der
Zuordnung und dem Abbruch laufender Auftraege, nicht als Betreiber-Login.
Der CLI-Status unterscheidet `busy`,
`browser-unavailable`, Protokollfehler und regulaeren spielerischen Misserfolg.

Der betreiberseitige Testserver speichert Ergebnisse atomar unter
`client/src/bot/runs/evaluations/`; die CLI gibt Ergebnis und Lesepfad aus.
Dateiname ist Job-ID plus Revision, keine vom Browser gelieferten Pfade.
Das Besucherprofil braucht dort nur Leserecht. Der endgueltige Status nennt
Persistenzfehler explizit, auch wenn der eigentliche Spiellauf erfolgreich war.

### Zwei Betriebsarten

| Modus | Ausfuehrung | Aussage |
| --- | --- | --- |
| `fixed` | Ganze Phaser-Game-Steps mit 1.000/60 ms; nach jedem Step ausstehende Workerentscheidung abwarten | reproduzierbare Mechanik-/Navigationsregression |
| `realtime` | regulaerer Frame-Loop und nichtblockierende Workeranbindung | reales Verhalten und Scheduling unter Turnierbedingungen |

Nach Boot-/Asset-/Worker-Barriere stoppt `fixed` die automatische Schleife und
treibt ausschliesslich `game.step(frame * delta, delta)`. Kein zusaetzliches
`world.step`, kein isoliertes `Scene.update`, keine asynchrone Scene-Methode,
auf die Phaser vermeintlich wartet. Beide Hosts verwenden dieselbe explizite
Arcade-Konfiguration `fixedStep: true, fps: 60` und dieselbe Action-Phasenfolge.

Grenzen pro Einzellauf: 5 s Browserbereitschaft, 15 s Boot, maximal 90 s
Simulationszeit beziehungsweise 5.400 Frames und 120 s reale Laufzeit nach Boot.
Im Fixedstep-Modus darf der Workertransport bis 1.000 ms dauern, damit
Scheduling nicht die Mechanikpruefung verfaelscht. Dieser Modus ist ausdruecklich
kein Nachweis des produktiven 5-ms-Budgets; Echtzeit nutzt unveraendert 5 ms.
Disconnect, Abbruch und Timeout bereinigen Worker, Game und Lease idempotent.

Reproduzierbarkeit gilt fuer deterministische Referenzstrategien mit identischen
Bedingungen. Beliebiges `Math.random`, Wandzeitabfragen oder externe Effekte in
Fremdcode werden nicht durch ein blosses Seed-Feld deterministisch.

### Ergebnis und Vergleich

Ein versioniertes Gesamtlaufergebnis ist getrennt von den bisherigen
Versuchs-Traces zwischen zwei Respawns. Es enthaelt:

- Job-ID, SHA-256 der abgegebenen Bot-Datei, Tools-API-Version und Framework-Revision;
- Level-/Fixture-Revision, Engine-Hash inklusive uncommittierter relevanter
  Quellen und Assetmanifest, Phaser-Version und Browser-/Plattformangaben;
- Leben, Zeitlimit, Physikraster, Bot-Intervall, Workerlimit, Testmodus;
- bei Gruppen Teilnehmer-Revisionen und Slotbelegung;
- Zielerreichung, End-/Maximalfortschritt, Fruechte, Fruchtpunkte, Tode,
  Gesamtscore, Simulations-/Wandzeit und technische Fehler;
- Szenario-Assertions und `completed | aborted | infrastructure-error`.

Ein Bedingungen-Hash fasst die vergleichsrelevanten Werte zusammen. Unterschiedliche
Bedingungen ergeben `comparable: false` mit konkreten Differenzen. Ein DNF ist
kein Transportfehler, ein Browserverlust kein regulaerer DNF. Drei getrennte
Urteile betreffen technische Gueltigkeit, Leistung und Strategiewunsch.

Der Prueflingsslot ist explizit markiert. Seine Artefaktrevision wird separat
verglichen und ist nicht Teil des Bedingungen-Hashes; sonst waere jeder
gewuenschte Revisionsvergleich unmoeglich. Mitspielerrevisionen, Slotbelegung
und alle uebrigen Bedingungen bleiben Bestandteil des Hashes. Die gemeinsame
Framework-Revision gehoert ebenfalls dazu: Ein Core-Wechsel ist eine geaenderte
Laufzeitbedingung, keine Codeaenderung der abgegebenen Bot-Datei.

## 8. Diagnose ohne Raten

Der Worker liest nach `decide` die Diagnose seiner eigenen Framework-
Navigatorinstanz aus, sofern `tools.navigate` verwendet wurde. Die Bot-Datei
braucht keinen Diagnoseexport und keinen zweiten `decide`-Aufruf. Navigation,
Besucherentscheidung und Diagnose bleiben im selben Host-Zeitbudget. Alte
Low-Level-Bots erhalten weiterhin Action-/State-Traces ohne erfundene
Navigationsabsicht. Weicht die normalisierte Rueckgabe eines Bots von den
Actions seines `navigate`-Aufrufs ab, wird dies als `navigation-output-overridden`
markiert; der Trace darf dann nicht unveraenderte Planausfuehrung behaupten.

Die normalisierte Diagnose nennt Ziel-/Routen-/Plan-ID, Phase, Grund,
Suchbudgetstatus und relevante Objekt-IDs. Maximal 2 KiB Diagnose pro Tick;
nur bekannte primitive Felder, begrenzte Strings/Listen. Hostseitige Validierung
ist erforderlich, fremde Worker-Nachrichten werden nicht blind vertraut.

Traceformat v2 erhaelt vollstaendige relevante Collider und Utilities fuer
den ausgewaehlten Plan sowie Frame-/Tick-/Epochenzuordnung. Maximal acht
Fenster mit jeweils bis zu 45 Ticks davor und zehn danach; Ueberlappungen
werden vereinigt. Harte Ausgabegrenze 2 MiB, Kuerzungen explizit markieren.
Eine gekuerzte Aufzeichnung darf nicht als vollstaendige Planrekonstruktion gelten.

Persistierte v1-Traces bleiben lesbar, aber ohne erfundene neue Diagnosefelder.
Neue Writer senden v2. Beobachtete Ereignisse bleiben Fakten; Heuristiken
bleiben Hinweise. Falsch starke Aussagen, insbesondere zur Mindesthaltezeit
ohne bekannten Sprungbeginn, werden nicht weiter ausgegeben.

## 9. Messelevel und Testszenarien

Ein eigenes `level-messe` wird aufgenommen; vorhandene Level bleiben unveraendert.
`/code` verwendet dieses Level. Die Turnierkonfiguration kann es ueber die
erweiterte Registry explizit waehlen; bestehende Stages werden nicht migriert.
Die Standanleitung verlangt fuer die Messe-Abnahme `level-messe` in allen
verwendeten Stages. Schwierige andere Level bleiben freiwillige Herausforderungen.

Festgelegter Ausgangsentwurf, alle Positionen in Pixeln:

| Bereich | Geometrie und Zweck |
| --- | --- |
| Welt | 2.400 x 540, Bodenoberkante y=460, Spawn x=80, Ziel x=2.288 ueber solidem Boden |
| Boden | x=0..640, x=736..1.472, x=1.584..2.400; Luecken 96 und 112 px |
| Sichere Umgehung | breite One-Way-Bruecke x=1.376..1.664 bei y=348 ueber der zweiten Luecke |
| Sammelplateau | One-Way x=304..528 bei y=332, optionale hochwertige Fruechte |
| Boingo-Bonus | Utility um x=1.984, optionale hohe Fruchtbahn, solider Boden darunter |
| Checkpoints | x=848 und x=1.760, mit freiem Anlauf und Abstand zu Luecken |
| Gefahren | getrennte optionale Risikozone, kein Pflichtkontakt und kein kombiniertes Timing-Puzzle |

Fruechte auf dem Hauptweg haben geringe Werte; Plateau und Bonusroute hoehere.
Der Hauptweg verlangt normale Lauf-/Sprungnavigation, keine Stomp- oder
Boingo-Kette. Der Sammler soll eine zusaetzliche Route nehmen, der Sprinter
den Hauptweg und der Vorsichtige die breitere Umgehung. Diese Entscheidungen
werden ueber Ziel-/Routen-IDs nachgewiesen, nicht allein durch Punkte.

Die Koordinaten sind ein zu verifizierender Designentwurf, kein behaupteter
Erreichbarkeitsnachweis. Noetige Geometriekorrekturen werden im Design mit
Begruendung dokumentiert; vor der 10er-Abnahme wird die Fixture-Revision
eingefroren. Aenderungen daran invalidieren die bisherige Abnahmeserie.

Mechanik-Fixtures verwenden echte kleine `LevelDef`s und denselben World-Builder:

- ebener Boden, Stillstand, Sprintaufbau und Richtungswechsel;
- kurzer/langer Sprung, Sprint-Sprung, Decke, Wand und One-Way-Plattform;
- Luecke mit bekannter Landung und unerreichbare letzte Kante;
- Blockkontakt, verbleibender Collider und neu sichtbare Frucht;
- Patrol, Pendel und Spikehead: Bodyposition, Geschwindigkeit, Aktiv-/Warnstatus;
- Boingo-/Stomp-Impuls samt Folgelandung;
- Checkpoint, Respawn, Controllerwechsel und spaete Workerantwort;
- konkurrierende Fruchtziele, sichere Umgehung und begrenzte Recovery.

Der bestehende `toolkit-test` mit unerreichbarem Ziel bleibt ein Negativtest:
erwartet wird erkannte fehlende Fortsetzung, kein erzwungener Zielerfolg.

## 10. Teststrategie und Abnahme

Alle Implementierungsschritte beginnen mit einem fehlschlagenden Test.
Vitest bleibt das Unit-/Contract-Framework; neue Packages richten es vor dem
ersten Produktivcode ein. Kein Test ersetzt reale Physik durch einen Mock und
behauptet anschliessend, die Phaser-Integration zu belegen.

| Ebene | Nachweis |
| --- | --- |
| Unit | Snapshot-Umrechnung, IDs, Collider, Planbesitz, Budgets, Recovery, Strategiewahl |
| Contract | v1-Bots mit/ohne Tools, unbekannte Framework-Version, Guard, Groesse, Dateihashes, unveraenderte Abgabe |
| Runtime | Ready-Barriere, Dispose, Fehler, ueberlappende Requests, Epochen, tatsaechliche Action-Anwendung |
| Transport/Trace | Lease, Grenzen, Abbruch, Vergleich, v1-Lesen/v2-Schreiben, Trunkierung |
| Phaser-Fixedstep | reale Mechaniken, Wahrnehmung gegen Body, Plan gegen echte Landung |
| Echtzeit | vollstaendige Referenzlaeufe und Turnierlast auf Standhardware |

Explizite Integrationstests vergleichen den Hash von Arbeitsdatei, Vorschau,
Test und Upload sowohl fuer bisherige Bots als auch fuer Tools-Bots und nach
einer Quellenrevision. Keine dieser Stationen darf Core-Code oder Wrapper in
die Bot-Datei einfuegen. Runtime-Tests pruefen getrennte Navigatorinstanzen,
unbekannte Tools-Versionen und den unveraenderten Aufruf alter Bots.
Vergleichstests erlauben
eine allein geaenderte Prueflingsrevision, lehnen aber andere Mitspieler oder
Bedingungen als direkten Leistungsvergleich ab. Der Betreiber-Dry-Run prueft
Test und serverseitige Ergebnispersistenz mit den realen Besucherprofilrechten.

Geometrie-Observation gegen Body: maximal 0,01 px Rundungsabweichung.
Identische Fixedstep-Wiederholung: identische Actions und diskrete Ereignisse,
Positionen innerhalb 0,01 px. Predictor gegen reale freie Bewegung: maximal
acht Pixel und ein Physikframe Abweichung innerhalb eines Manoevers von bis
zu 1,6 s; bei Kontakten zusaetzlich gleiche Kollisionsart und tragende Flaeche.
Eine falsche Landung wird nicht durch numerische Toleranz akzeptiert.

Die Zuverlaessigkeitsabnahme umfasst zehn vollstaendige Echtzeitlaeufe je
Referenzbot, drei Leben, 90 s, eingefrorenes Messelevel und identischen Core.
Sie laeuft in Vierergruppen ueber `MatchRunner`; die vierte Spur verwendet
einen festgelegten zusaetzlichen Referenzbot. Slotwechsel werden dokumentiert.
Mindestens neun von zehn Laeufen je Bot erreichen das Ziel ohne technische
Fehler. Keine nachtraegliche Auswahl nur guter Laeufe. Infrastrukturabbrueche
werden separat ausgewiesen und verhindern eine vollstaendige Abnahme, solange
zehn gueltige Laeufe fehlen. Fixedstep-Erfolge ersetzen diese Serie nicht.

## 11. Agent-Workflow und Betriebsgrenzen

Der Betreiber richtet Dev-Server, Framework-Release und Browser-Testseite vor der
Besuchersession ein. Das Besucherprofil hat Schreibrecht auf `current-bot.js`,
Leserecht auf dokumentierte Referenz/API und Ergebnisse sowie Ausfuehrungsrecht
fuer einen festen CLI-Wrapper und lokalen Testtransport. Kein Schreibrecht auf
Navigation, Framework-Buildskripte, Server oder Projekt-Steering. Die tatsaechliche externe
Profilbereitstellung wird dokumentiert und nicht als im Repo vorhanden behauptet.

Das lokale Steering trennt Besucher-Bot-Bau explizit vom Repository-Spec-/TDD-
Workflow. Es beschreibt nur Strategie-API, Prioritaeten, Testaufruf und Grenzen.
Alle enthaltenen Codebeispiele sind als Fixtures extrahierbar und getestet.
Widerspruechliche Action-/Sprungzaehler-Beispiele entfallen.

Eine Iteration besteht aus Erstpruefung plus maximal zwei technischen
Reparatur-/Nachpruefungsrunden, insgesamt hoechstens fuenf Minuten. Die Suite
verwendet zuerst kurze Mechanik-/Strategiechecks und dann einen begrenzten
Kontrolllauf. Danach meldet der Agent verbleibende Probleme statt endlos zu
optimieren. Eine fachliche Aenderung des Besucherwunsches verlangt weiterhin
Zustimmung. Feedback: maximal zwei Beobachtungen und ein Strategievorschlag.

Ohne verbundene Browser-Testseite ist der CLI-Aufruf schnell und eindeutig
blockiert. Es gibt keinen heimlichen Node-Ersatz und keinen Browser-GUI-Start
durch den Agenten. Nicht ausgefuehrte Live-/Lasttests bleiben in der Abnahme offen.

## 12. Betroffene Dateien

Neue Komponenten werden klein gehalten und nur bei klarer Verantwortung getrennt:

- `packages/bot-navigation/`: Strategietypen, Bewegungsprognose, lokale Planung,
  Tools-Adapter/Planausfuehrung und Tests; Bestandteil des Frameworks.
- `scripts/bot-test.mjs`: CLI-Transport/Vergleich der unveraenderten Bot-Datei.
- `client/vite/botTestPlugin.ts`: explizit aktivierte Teststation.
- `client/src/testing/`: Browser-Einstieg, Game-Treiber, Szenarioregistry,
  Ergebnisvertrag und echte Level-Fixtures.
- `client/src/game/state/`, `level/tiles.ts`, `RaceScene.ts`, Movement und
  World-/Hazard-Anbindung: konsistente Observation und Bewegungsereignisse.
- `packages/bot-contract/src/`: additive Observation, Tools-Vertrag und
  Validierung des optionalen `frameworkVersion`-Felds.
- `client/src/sandbox/`, `game/trace/`, `client/vite/botTracePlugin.ts`:
  Ready-/Request-Lifecycle, korrelierte Diagnose und versionierte Persistenz.
- `client/src/bot/`, `scripts/reset-bot.mjs`, `examples/strategies/`:
  kurze Ein-Datei-Vorlage, direkt abgebbare Referenzbots und getestetes Steering.
- `levelMesse.ts`, Levelregistries, `ArenaPage.tsx`: Messelevel fuer `/code`.
- `ArenaView.tsx`, `match/`: gemeinsame Physikkonfiguration und Beobachtungszugang.
- Workspace-Build/Test-Konfiguration und `docs/01`, `02`, `03`, `04`, `06`, `09`:
  konsistente Architektur-, Contract-, Setup- und Betriebsdokumentation.

## 13. Requirements-Abdeckung

| Requirements | Design und Verifikation |
| --- | --- |
| US-1: reale Hazards/Velocity, Respawn, Coins/Collider, skalierter Body | Abschnitt 2; Snapshot-Units und reale Body-/Block-/Hazard-Fixtures |
| US-2: laufender Startbot und echte Ziele | Abschnitte 3-5; Template-/Worker-Test und reale Sammelroute |
| US-2: Planbesitz, begrenzte Recovery, abgesicherte Landung | Abschnitt 4; Konflikt-, Negativ- und Phaser-Kollisionstests |
| US-2: freie Prioritaeten | Abschnitt 3; eigene choose-Funktionen und unterschiedliche Ziel-/Routen-IDs |
| US-3: drei Referenzen und reale Mechanikpruefung | Abschnitte 3, 9, 10; gemeinsame Core-Identitaet und Fixture-Suite |
| US-3: neun von zehn, einfacherer Hauptweg | Abschnitte 9-10; eingefrorenes Messelevel und Echtzeit-Abnahmeserie |
| US-4: begrenzter Test, Ergebnis, Vergleich | Abschnitt 7; Transport-/Vergleichstests und echter Game-Lauf |
| US-4: Diagnose mit Geometrie/Utilities und Actions | Abschnitte 6 und 8; Trace-/Epochen- und Integrationstests |
| US-4: Iterationsbudget und differenziertes Feedback | Abschnitt 11; dokumentierter und im Dry-Run gepruefter Ablauf |
| US-5: Setup, getestete Beispiele, getrennter Kern | Abschnitte 5 und 11; Tools-/Steering-Tests und Betreiber-Dry-Run |
| US-5: eine unveraenderte Bot-Datei, Hilfen im Framework | Abschnitte 1, 3 und 5; Dateihash-Gleichheit, kein Bot-Build, Tools im Worker |
| US-5: bestehende apiVersion-1-Artefakte | Abschnitte 2 und 5; unveraenderte Legacy-Artefakte durch Worker und Upload |

## 14. Risiken und Freigabegrenzen

Die lokale Routenplanung ist der groesste Implementierungsblock. Zuerst wird
ihre Basis auf kleinen echten Fixtures nachgewiesen; komplexe unbekannte Level
sind kein Abnahmekriterium. Suchgrenzen, Performance und konservative Landungen
muessen gemeinsam getestet werden, statt Probleme mit groesseren Zeitlimits
oder blindem Risiko zu verdecken.

Der Transport ist keine neue Sicherheitsgrenze fuer beliebigen Bot-Code.
Der bestehende Guard ist eine begrenzte Schutzmassnahme; der Browser-Worker
bleibt der vorhandene Ausfuehrungsort. Tools geben keine Engineobjekte frei.
Framework-Navigation wird gemeinsam mit der Arena versioniert, weshalb
Framework-/Engine-/Fixture-Hashes zu allen Leistungsvergleichen gehoeren.

Requirements und dieses Design sind freigegeben. Die Umsetzung folgt nach
Task-Freigabe beziehungsweise expliziter Startbestaetigung.
Browser-/Standhardware-Abnahme kann erst nach tatsaechlicher Ausfuehrung
als erfuellt markiert werden.
