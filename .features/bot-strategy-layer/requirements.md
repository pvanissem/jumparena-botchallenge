# Requirements: Verlaessliche Messe-Bots

## Status

Weitere verbindliche Nutzerkorrektur: Levelaenderungen sind nicht im Scope.
`/code` verwendet wieder das urspruengliche `level-one`; das neu eingefuehrte
`level-messe` samt Registry-Eintraegen wird entfernt. Diese Vorgabe ersetzt
alle nachfolgenden historischen Aussagen zum Beibehalten eines neuen Messelevels.

Scope-Korrektur vom Nutzer mit "ja!" ausdruecklich zur Umsetzung freigegeben:
Die zusaetzliche Testplattform wird entfernt. Verbindlicher Restumfang sind
Wahrnehmungs-/Laufzeitkorrekturen, Framework-Navigation, eine Bot-Datei, das
einfachere Messelevel sowie Ausprobieren in `/code` mit vorhandenen Traces.
Die unten stehenden urspruenglichen Kriterien zu automatischen Testauftraegen,
Versionsvergleichen und Abnahmeserien sind historische Planung, nicht weiter
umzusetzender Feature-Umfang. Kein Ersatz durch eine neue Testarchitektur.

Aktuelle Akzeptanzkriterien fuer den Rueckbau:
- WHEN ein Besucher seinen Bot ausprobiert SHALL DAS SYSTEM den bestehenden
  `/code`-Ablauf und die vorhandene Trace-Persistenz verwenden.
- WHEN das Projekt startet SHALL DAS SYSTEM keine zusaetzliche Testseite,
  Test-CLI, Auftragsverwaltung oder dafuer benoetigte Setup-Schritte verlangen.
- WHEN Testplattform-Code entfernt wird SHALL DAS SYSTEM konkrete Wahrnehmungs-,
  Worker- und Bewegungsfehlerkorrekturen samt Regressionstests bewahren.
- WHEN ein Bot abgegeben wird SHALL DAS SYSTEM weiterhin dieselbe einzelne
  JavaScript-Datei ohne Buildschritt oder eingebetteten Navigationskern verwenden.

Vom Nutzer am 2026-09-15 mit "ja" explizit freigegeben.
Die Freigabe betrifft die Requirements; Design und Implementierung folgen
den weiteren Repository-Gates.
Praezisierung durch den Nutzer: Das abgegebene Endergebnis bleibt eine einzige
Bot-Datei; gemeinsame Hilfsfunktionen gehoeren in das Framework. Das Design
setzt dies ohne separate Strategie-Arbeitsdatei oder Bot-Buildschritt um.
Weitere explizite Nutzerentscheidung: Token-Autorisierung ausbauen, da der
gesamte Hilfsprozess ausschliesslich lokal betrieben wird. Diese begrenzte
Korrektur ist mit "bitte ausbauen" zur Umsetzung beauftragt.

## Kontext

Bezug: `docs/01-konzept.md`, `docs/02-bot-api.md`,
`docs/04-devkcode-profil.md`, `docs/06-level-design.md` und
`docs/09-bot-artefakt-und-turnier.md`.

Dieses Feature baut auf `.features/bot-toolkit/`, `.features/bot-state-vision/`
und `.features/bot-run-feedback/` auf, statt deren Implementierung zu ersetzen.
Besucher sollen in 15-20 Minuten eine erkennbare Strategie entwickeln lassen.
Sprungphysik, Kollisionsbehandlung und konkurrierende Steuerungsregeln sollen
nicht bei jeder Besuchersession neu geloest werden muessen.

Bewusste Aenderungen gegenueber bisherigen Specs:
- Eine funktionierende Standardstrategie ersetzt das absichtlich leere Template.
- Besucher-Code gestaltet Ziele und Prioritaeten ueber gemeinsamer Navigation.
- Die bisherige Toolkit-Vorgabe ohne Framework-Hilfen im Worker wird ersetzt:
  gemeinsame Navigation darf zur Laufzeit bereitgestellt werden; die einzelne
  Bot-Datei bleibt direkt abgebbar.
- Ein begrenzter technischer Testablauf darf ohne einzelne Besucherfreigaben
  ausgefuehrt werden. Strategiewuensche werden nicht eigenmaechtig veraendert.
- Bot-Geometrie beschreibt reale Collider. Ein ausgeloester Muenzblock bleibt
  sichtbar, solange er im Spiel solide bleibt; die gegenteilige Annahme aus
  `bot-toolkit` US-2 wird ersetzt.

## User Stories

### US-1: Verlaessliche Wahrnehmung

Als Bot-Autor moechte ich die tatsaechliche Spielwelt wahrnehmen, damit korrekte
Entscheidungen nicht an falschen Eingangsdaten scheitern.

Akzeptanzkriterien:
- WHEN ein Bot-State erzeugt wird SHALL DAS SYSTEM bewegliche Hazards an ihren
  aktuellen Weltpositionen und mit ihrer gemessenen aktuellen Geschwindigkeit
  melden, ohne aus Respawns kuenstliche Geschwindigkeiten abzuleiten.
- WHEN ein Block ausgeloest oder eine Frucht eingesammelt wird SHALL DAS SYSTEM
  verbleibende Collider und alle aktuell einsammelbaren Fruechte innerhalb des
  Sichtbereichs konsistent mit der Arena melden.
- WHEN die Spieler-Kollisionsbox skaliert wird SHALL DAS SYSTEM ihre effektiven
  Weltabmessungen fuer die Bot-Navigation bereitstellen.

### US-2: Gemeinsame Navigation, individuelle Strategie

Als Besucher moechte ich bestimmen, was mein Bot erreichen soll, ohne mit dem
Agenten seine Motorik reparieren zu muessen.

Akzeptanzkriterien:
- WHEN eine neue Besuchersession mit dem Standardtemplate beginnt SHALL DAS
  SYSTEM einen ohne weitere Codeaenderung bewegungsfaehigen Grundbot liefern.
- WHEN eine Strategie ein sichtbares Sammelziel oder das Levelziel priorisiert
  SHALL DAS SYSTEM dessen Ansteuerung ueber gemeinsame Navigation erlauben,
  ohne eigene Sprunghaltezaehler im Besucher-Code zu verlangen.
- WHEN ein Bewegungsplan laeuft SHALL DAS SYSTEM Zielwahl und Planausfuehrung so
  koordinieren, dass normale Strategieentscheidungen den Sprung nicht jeden
  Tick durch konkurrierende Richtungsbefehle abbrechen.
- WHEN ein Ziel nicht erreichbar ist oder Fortschritt ausbleibt SHALL DAS
  SYSTEM einen begrenzten, diagnostizierbaren Ausweich- oder Neuplanungsablauf
  verwenden, statt unbegrenzt zu warten oder zwischen zwei Zielen zu pendeln.
- WHEN die Navigation eine Landung als abgesichert bezeichnet SHALL DAS SYSTEM
  eine erreichbare tragende Flaeche unter Beruecksichtigung der relevanten
  Kollisionen nachweisen; unbekannte Fortsetzungen gelten nicht als sicher.
- WHEN Besucher unterschiedliche Prioritaeten fuer Fruchtwert, Umweg, Risiko
  oder Endspurt formulieren SHALL DAS SYSTEM diese durch eigene Entscheidungslogik
  ausdrueckbar machen, nicht ausschliesslich durch feste Persoenlichkeitsnamen.

### US-3: Nachgewiesene Grundqualitaet

Als Standbetreiber moechte ich funktionierende und unterscheidbare Referenzbots,
bevor Besucher mit dem System arbeiten.

Akzeptanzkriterien:
- WHEN das Feature abgenommen wird SHALL DAS SYSTEM einen Sprinter, einen
  Sammler und einen vorsichtigen Referenzbot auf derselben Navigation enthalten.
- WHEN diese Bots auf festgelegten Testszenarien laufen SHALL DAS SYSTEM ihre
  unterschiedlichen Ziel- oder Routenentscheidungen automatisiert nachweisen.
- WHEN der Grundcontroller abgenommen wird SHALL DAS SYSTEM seine erforderlichen
  Bewegungsmechaniken gegen die echte Spielphysik pruefen, nicht ausschliesslich
  gegen eine zweite unabhaengige Simulationsformel.
- WHEN die Referenzbots auf dem festgelegten Messelevel unter Turnierbedingungen
  geprueft werden SHALL DAS SYSTEM fuer jeden Bot Zielerreichung ohne technische
  Fehler in mindestens neun von zehn vollstaendigen Laeufen nachweisen.
- WHEN Levelmechaniken diese Grundqualitaet verhindern SHALL DAS SYSTEM einen
  einfacheren Hauptweg mit optionalen Herausforderungen fuer das Messelevel
  vorsehen; andere Level werden nicht stillschweigend umgebaut.

### US-4: Kurze, vergleichbare Iterationen

Als Bot-Agent moechte ich eine bestimmte Bot-Version gezielt testen und das
Ergebnis auswerten, statt den Besucher technische Fehler diagnostizieren zu lassen.

Akzeptanzkriterien:
- WHEN der Agent einen dokumentierten Test ausloest SHALL DAS SYSTEM einen
  begrenzten Lauf mit festgelegtem Level, Lebensbudget und Zeitlimit ausfuehren
  und ein maschinenlesbares Ergebnis bereitstellen.
- WHEN die lokale Teststation explizit aktiviert ist SHALL DAS SYSTEM Tests
  ohne Session-Token, Authorization-Header oder Geheimniseingabe im Browser
  erlauben; Loopback-Bindung, lokale Herkunftspruefung und Auftragsgrenzen
  bleiben erhalten.
- WHEN ein Ergebnis vorliegt SHALL DAS SYSTEM Bot-Revision, Testbedingungen,
  Fortschritt, Fruchtpunkte, Tode, Zielerreichung und technische Fehler ausweisen.
- WHEN zwei Revisionen verglichen werden SHALL DAS SYSTEM unterschiedliche
  Testbedingungen kenntlich machen und keine Verbesserung allein aus
  unterschiedlich konfigurierten Laeufen ableiten.
- WHEN ein Navigationsproblem aufgezeichnet wird SHALL DAS SYSTEM das gewaehlte
  Ziel, den Planungsgrund und die relevante Geometrie samt Utilities mit den
  zugehoerigen States und Actions korrelieren.
- WHEN eine technische Pruefung fehlschlaegt SHALL DER BOT-AGENT innerhalb eines
  festgelegten Iterationsbudgets reparieren und nachpruefen duerfen; nach dessen
  Ablauf berichtet er den verbleibenden Fehler statt endlos zu optimieren.
- WHEN Feedback an den Besucher erfolgt SHALL DER BOT-AGENT technische Gueltigkeit,
  spielerische Leistung und Erfuellung des Strategiewunsches unterscheiden.

### US-5: Ein konsistenter Besucher-Workflow

Als Betreiber moechte ich einen kurzen, reproduzierbaren Agent-Kontext statt
wachsender Listen von Sonderregeln.

Akzeptanzkriterien:
- WHEN das Bot-Profil gestartet wird SHALL DIE DOKUMENTATION Arbeitsverzeichnis,
  benoetigte Berechtigungen, Strategie-Schnittstelle und Testaufruf eindeutig
  beschreiben und vom Entwicklungsworkflow des Repositorys unterscheiden.
- WHEN das Steering Beispiele zeigt SHALL DAS SYSTEM diese gegen den aktuellen
  Contract testen und widerspruechliche Low-Level-Startbeispiele entfernen.
- WHEN Besucher-Code bearbeitet wird SHALL DAS SYSTEM gemeinsame Navigation und
  individuelle Strategie so trennen, dass fuer regulaere Strategieaenderungen
  keine Bearbeitung des Navigationskerns erforderlich ist.
- WHEN ein Besucher seinen Bot bearbeitet, testet oder abgibt SHALL DAS SYSTEM
  dieselbe einzelne JavaScript-Bot-Datei verwenden, ohne zusaetzliche
  Besucherdateien oder einen vorgeschalteten Artefakt-Build zu verlangen.
- WHEN ein Bot gemeinsame Navigationshilfen verwendet SHALL DAS SYSTEM diese
  im Framework bereitstellen, statt deren Quellcode in jede Bot-Datei zu kopieren.
- WHEN vorhandene exportierte Bot-Artefakte geladen werden SHALL DAS SYSTEM
  deren bestehenden `apiVersion: 1`-Contract weiterhin unterstuetzen.

## Nicht-Ziele

- Kein Wechsel auf ein anderes Spielgenre und kein kompletter Engine-Neubau.
- Keine Garantie perfekter Navigation auf beliebigen unbekannten Levels.
- Kein trainiertes Modell, Reinforcement Learning oder unbegrenztes Auto-Tuning.
- Keine grundlegende Aenderung von Scoring oder Turnierregeln.
- Keine vollstaendige Sicherheitsueberarbeitung der Worker-Sandbox; bestehende
  Beschraenkungen werden nicht als umfassende Isolation beliebigen Codes beworben.

## Im Design Festzulegen

- Konkrete Strategie-Schnittstelle und Bereitstellung des gemeinsamen Kerns.
- Testausfuehrung gegen die reale Spielphysik, reproduzierbare Startbedingungen,
  Navigations-Toleranzen und Umgang mit asynchroner Worker-Ausfuehrung.
- Messelevel, erforderliche Mechaniken und repraesentative Testszenarien.
- Maximales technisches Iterationsbudget und Abbruchbedingungen.
- Versionierung und Groessenbegrenzung erweiterter Diagnoseinformationen.

## Umsetzungsvorgabe

Nach Requirements-, Design- und Task-Freigabe erfolgt die Umsetzung testgetrieben:
zuerst reproduzierende beziehungsweise fehlschlagende Tests, dann der minimale
Produktivcode. Die Abnahme weist die oben genannten Kriterien einzeln nach;
nicht ausgefuehrte Live-Tests werden ausdruecklich als offen markiert.
