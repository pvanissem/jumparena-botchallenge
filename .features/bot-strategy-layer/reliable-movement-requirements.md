# Requirements-Ergänzung: Verlässliche Bewegung, eigene Strategie

Stand: 17.09.2026. Status: Arbeitsgrundlage der direkt beauftragten Umsetzung.

Der Nutzer hat nach diesem Entwurf ausdrücklich angewiesen, ohne Spec-Modus,
weitere Freigaben oder Rückfragen direkt zu arbeiten. Die folgenden Kriterien
dienen der Überprüfung; sie begründen keine weitere Freigabeschleife.

## Kontext und verbindliche Grenze

Fortsetzung des vorhandenen Features `bot-strategy-layer`, kein paralleler
Neuaufbau. Grundlage sind `requirements.md`, `environment-navigation.md`,
`docs/02-bot-api.md`, `docs/03-architektur.md` und die Besuchersimulation vom
17.09.2026. Die Zielrichtung hat der Nutzer bestätigt; diese konkreten
Akzeptanzkriterien werden im Rahmen des direkten Umsetzungsauftrags geprüft.

**Spielprinzip und sämtliche Level bleiben exakt unverändert.** Keine Anpassung
von Geometrie, Gegnern, Gefahren, Utilities, Früchten, Checkpoints, Physik,
Sichtfeld, Scoring, Lebensbudget oder Zeitlimit, um die Abnahme zu bestehen.
Ältere Vorschläge zur Vereinfachung des Hauptwegs gelten nicht.

Der Besucher entscheidet über Ziele und Spielstil. Die gemeinsame Bewegungshilfe
übernimmt die notwendige Ausführung einschließlich vorbereitender Bewegungen und
Erholung von fehlendem Fortschritt. Besucher sollen keine Absprungkoordinaten,
Sicherheitspuffer oder physikalischen Abläufe reparieren müssen.

## Beobachtete Probleme und technische Anknüpfungspunkte

- Blitz blieb zunächst unter einem Block vor Stacheln, nach einer Korrektur an
  einer späteren Lücke stehen; Samtpfote blieb an der ersten Engstelle stehen.
- Goldgräber erreichte das Ziel. Gezielte Schatzumwege sind durch diesen Lauf
  nicht nachgewiesen; mehr Fruchtpunkte allein belegen keinen anderen Spielstil.
- `packages/bot-navigation/src/options.ts` liefert bei vorhandenen positiven
  Fortschrittsangeboten ausschließlich diese zurück. Rückwege stehen damit
  nicht immer zur strategischen Auswahl, selbst wenn sie gewünscht sind.
- `controller.ts` erkennt fehlenden Fortschritt nur innerhalb eines laufenden
  Auftrags. Dauerhaft leere Auswahl wird dadurch nicht aufgelöst.
- Die genaue Ursache jeder einzelnen gesperrten Bewegung ist vor einem Fix
  durch einen reproduzierenden Test zu bestätigen. Diese Befunde ersetzen
  weder eine vollständige Fehleranalyse noch eine erfolgreiche Implementierung.

## US-1: Bewegung ohne Reparatur durch Besucher

Als Besucher möchte ich ein Ziel und einen Spielstil beschreiben, ohne die
Motorik meines Bots programmieren lassen zu müssen.

- WHEN eine Strategie ein Ziel zur unterstützten Navigation übergibt SHALL DAS
  SYSTEM erforderliche Anlauf-, Rückzugs- und Zwischenbewegungen selbst ausführen,
  ohne dafür zusätzliche Motorikregeln in der Besucherdatei zu verlangen.
- WHEN die Navigation vorbereitet oder ausweicht SHALL DAS SYSTEM das gewählte
  strategische Ziel und die vom Bot erlaubten Risiken respektieren.
- WHEN ein Ziel nicht weiter verfolgt werden kann SHALL DAS SYSTEM den Grund
  und den Ausgang des Auftrags melden, damit die Strategie ein anderes Ziel
  wählen kann; es darf keinen unbeobachteten Erfolg behaupten.
- WHEN sich Gefahren während der Ausführung verändern SHALL DAS SYSTEM diese
  anhand neuer Beobachtungen berücksichtigen, ohne einen laufenden Sprung
  durch die normale erneute Zielbewertung versehentlich abzubrechen.

## US-2: Festhängen erkennen und auflösen

Als Besucher möchte ich, dass mein Bot selbst aus einer Engstelle herauskommt.

- WHEN ein aktiver Navigationswunsch weder Fortschritt noch einen begründeten
  Wartezustand erzeugt SHALL DAS SYSTEM innerhalb von höchstens drei Sekunden
  Spielzeit eine begrenzte Wiederherstellung oder alternative Ansteuerung beginnen;
  dies gilt auch bei leerer Bewegungsauswahl.
- WHEN der Bot wiederholt zwischen denselben Zuständen pendelt SHALL DAS SYSTEM
  dies auch ohne vollständigen Stillstand erkennen und den erfolglosen Ablauf
  nicht unbegrenzt wiederholen.
- WHEN auf eine bewegliche oder getaktete Gefahr gewartet wird SHALL DAS SYSTEM
  die beobachtete Bedingung zum Weitergehen benennen und nach deren Änderung neu
  entscheiden; dauerhafte Stacheln dürfen kein Warten auf ihr Verschwinden auslösen.
- WHEN eine Wiederherstellung scheitert SHALL DAS SYSTEM den Auftrag innerhalb
  eines im Design festgelegten endlichen Budgets als blockiert beenden, statt
  denselben Ablauf mit immer neuen IDs unbegrenzt neu zu starten.
- WHEN eine Bewegung von einer Gefahr wegführt SHALL DAS SYSTEM tatsächliche
  Kollision und zusätzlichen Vorsichtsabstand unterscheiden, damit ein reiner
  Abstandspuffer einen möglichen Rückzug nicht pauschal verhindert.

## US-3: Sichtbar unterschiedliche Entscheidungen

Als Besucher möchte ich meinen eigenen Spielstil im Lauf wiedererkennen.

- WHEN ein Sprinter und ein Sammler dieselbe Ausgangssituation mit einem
  erreichbaren Fruchtabstecher erhalten SHALL DAS SYSTEM sowohl das direkte
  Weiterkommen als auch den Abstecher ermöglichen, einschließlich erforderlicher
  Rückwege oder Aufstiege trotz vorhandener Vorwärtsbewegung.
- WHEN ein vorsichtiger Bot an einer zeitabhängigen Gefahr wartet SHALL DAS
  SYSTEM nach beobachteter geeigneter Gelegenheit weiteres Vorankommen ermöglichen;
  bloßes Überleben im Stillstand gilt nicht als erfüllter Strategiewunsch.
- WHEN Besucher Ziele oder Risikoprioritäten verändern SHALL DAS SYSTEM diese
  Änderung über die einzelne Bot-Datei ermöglichen, ohne Änderungen am gemeinsamen
  Bewegungskern und ohne Beschränkung auf feste Persönlichkeitsnamen.
- WHEN die Abnahme Spielstilunterschiede ausweist SHALL DAS SYSTEM konkrete
  Zielwahl, Fruchtsammlung auf einem Abstecher oder begründetes Warten mit
  anschließendem Weiterkommen belegen; Endpunktzahlen allein genügen nicht.

## US-4: Nachweis im unveränderten Spiel

Als Betreiber möchte ich wiederholbare Ergebnisse statt eines Glückstreffers.

- WHEN die beobachteten Engstellen geprüft werden SHALL DAS SYSTEM Block plus
  Stacheln sowie die Lücke vor der Feuerpassage in jeweils fünf von fünf
  unabhängigen Versuchen mit identischen Startbedingungen im echten Phaser-Spiel
  überwinden; bloße Prognosen oder isolierte Unit-Tests genügen nicht.
- WHEN die vollständige Referenzabnahme erfolgt SHALL DAS SYSTEM Sprinter,
  Sammler und vorsichtigen Bot auf dem unveränderten Level 1 jeweils mindestens
  neunmal in zehn Läufen innerhalb des bestehenden Limits ins Ziel bringen,
  ohne technische Fehler oder dauerhaften Navigationsstillstand.
- WHEN Ergebnisse verglichen werden SHALL DAS SYSTEM Botrevision, Frameworkstand,
  Startbedingung, Zeitlimit, Lebensbudget, Zielankunft, Tode, Fruchtpunkte und
  Blockaden festhalten. Vorschau- und Turnierbedingungen werden nicht vermischt.
- WHEN neue Navigationslogik abgenommen wird SHALL DAS SYSTEM außerdem ihre
  Unabhängigkeit von bestimmten Levelkoordinaten und Objekt-IDs durch verschobene
  Geometrie und umbenannte IDs nachweisen. Keine fest codierte Levelroute.
- WHEN natürliche Sprache als erfolgreicher Eingriff bewertet wird SHALL ein
  frischer Messe-Agent ausschließlich anhand der Besucheranleitung eine solche
  Strategieänderung ohne Reparatur der Motorik umsetzen und sichtbar überprüfen.

## US-5: Bestehender Besucherablauf bleibt verwendbar

- WHEN eine neue Session zurückgesetzt wird SHALL die leere Vorlage weiterhin
  ohne Bewegung bleiben; die neue Unterstützung wird durch einen ausdrücklichen
  Navigationswunsch aktiviert und startet keinen heimlichen Standardspieler.
- WHEN Bots getestet oder abgegeben werden SHALL weiterhin eine einzelne
  JavaScript-Datei und die bestehende Vorschau verwendet werden. Keine zusätzliche
  Testseite, Dienste oder Jobverwaltung als Voraussetzung für Besucher.
- WHEN bestehende Low-Level-Bots oder explizite Bewegungsaufträge ausgeführt werden
  SHALL deren Kontrolle erhalten bleiben; die neue Unterstützung darf deren
  Actions nicht unbemerkt durch eine eigene Strategie ersetzen.

## Nicht-Ziele und Designentscheidungen

Keine Garantie für beliebigen fehlerhaften Besuchercode oder perfekte Sicherheit
an jeder dynamischen Gefahr. Keine Leveländerung, versteckte Weltkenntnis,
festgelegte Ideallinie oder Einschränkung auf drei fertige Bots.

Das Design legt den kleinsten geeigneten Navigationsvertrag, begrenzte
Wiederherstellung, CPU-/Speicherbudget, Diagnose und Testbedingungen fest. Es
muss die Abgrenzung zur bisherigen reinen Auftragsausführung ausdrücklich
beschreiben. Änderungen an anderen vorhandenen Levels sind ausgeschlossen;
deren unterstützte Mechaniken werden als Regression geprüft. Aussagen über
deren vollständige Erfolgsquote erfordern eigene Nachweise.

Die direkte Nutzeranweisung ersetzt die weiteren Spec-Gates für diesen Auftrag.
Umsetzung mit vorher fehlschlagenden Tests und anschließender Prüfung im echten Spiel.
