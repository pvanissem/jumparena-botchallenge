# Requirements: tournament-stage-levels

## Kontext

Bezug: `docs/06-level-design.md` (Zeile 49: *"Soll es mehrere unterschiedliche
Level geben (z. B. eines pro Heat-Runde) …?"*), `docs/07-offene-punkte.md`
(offener Punkt *"Ein Level für alle Heats oder mehrere Level-Varianten über den
Tag verteilt?"* – wird durch dieses Feature entschieden),
`docs/09-bot-artefakt-und-turnier.md` (Single-Elimination, Bracket-Anzeige
"Runden → Matches → Ergebnis").

Heute hat ein Turnier genau **ein** Level für seine gesamte Laufzeit
(`TournamentState.levelId`, in `TournamentSetup.tsx` einmalig vor dem Start
gewählt). Jede Runde – von der Vorrunde bis zum Finale – läuft auf demselben
Level.

Gewünscht: Der Betreiber legt **vor Turnierstart** fest, welches Level in
welcher Runde ("Stage") gespielt wird – z. B. Runde 1 auf Level 1 (einfach,
viele Bots gleichzeitig), Runde 2 auf Level 2 (schwerer, weniger Bots übrig),
Finale auf Level 4. Zusätzlich soll im `/admin`-Bracket auf einen Blick
erkennbar sein, welches Level pro Runde gilt und **wo das Turnier gerade
steht**.

Wie viele Runden ein Single-Elimination-Turnier tatsächlich hat, hängt von
Teilnehmerzahl und Gruppengröße ab (siehe `.features/admin-match-group-size/`,
bereits umgesetzt) und kann durch Freilose von der reinen Zweier-/Vierer-Potenz
abweichen. Die Stage-Konfiguration muss daher robust gegenüber "mehr Runden als
konfigurierte Stages" sein, ohne das Turnier abzubrechen.

## User Stories

### US-1: Level pro Stage vorkonfigurieren

Als Betreiber am Stand möchte ich vor dem Aufstellen eines Turniers für jede
Runde ein eigenes Level auswählen können, damit der Schwierigkeitsgrad mit
fortschreitendem Turnier steigt (oder sich sonst wie über die Runden hinweg
unterscheidet).

Akzeptanzkriterien:

- WHEN das Turnier-Setup in `/admin` angezeigt wird SHALL DAS SYSTEM eine
  Liste konfigurierbarer Stages anzeigen, beginnend mit genau einer Stage
  (entspricht dem heutigen Ein-Level-Verhalten).
- WHEN der Betreiber eine weitere Stage hinzufügt SHALL DAS SYSTEM eine
  zusätzliche Level-Auswahl ans Ende der Liste anhängen, die unabhängig von
  den übrigen Stages ein Level aus der Level-Registrierung wählen lässt
  (dasselbe Level darf in mehreren Stages vorkommen).
- WHEN der Betreiber eine Stage entfernt, während mehr als eine Stage
  konfiguriert ist SHALL DAS SYSTEM diese Stage entfernen und die verbleibenden
  Stages in unveränderter relativer Reihenfolge weiterführen.
- WHEN nur eine Stage konfiguriert ist SHALL DAS SYSTEM das Entfernen dieser
  letzten Stage verhindern (mindestens eine Stage ist immer erforderlich).
- WHEN der Betreiber das Turnier mit "Turnier aufstellen" startet SHALL DAS
  SYSTEM die Liste der konfigurierten Stage-Level in derselben Reihenfolge an
  den Server übermitteln.

### US-2: Stage-Reihenfolge bequem anpassen

Als Betreiber möchte ich die Reihenfolge der Stages nachträglich ändern können,
ohne alles neu auswählen zu müssen, damit ich die Schwierigkeitskurve schnell
umstellen kann.

Akzeptanzkriterien:

- WHEN eine Stage nicht die erste in der Liste ist SHALL DAS SYSTEM eine
  Möglichkeit anbieten, sie um eine Position nach oben zu verschieben.
- WHEN eine Stage nicht die letzte in der Liste ist SHALL DAS SYSTEM eine
  Möglichkeit anbieten, sie um eine Position nach unten zu verschieben.
- WHEN eine Stage verschoben wird SHALL DAS SYSTEM ausschließlich sie und die
  Nachbarstage tauschen und alle übrigen Stages unverändert lassen.
- WHEN eine Stage die erste bzw. letzte der Liste ist SHALL DAS SYSTEM die
  jeweils nicht mögliche Verschieberichtung als nicht auswählbar darstellen.

### US-3: Stage-Level werden während des Turniers angewendet

Als Betreiber möchte ich, dass jede Runde automatisch auf dem für sie
konfigurierten Level läuft, ohne dass ich pro Match etwas umstellen muss.

Akzeptanzkriterien:

- WHEN die erste Runde eines Turniers gespielt wird SHALL DAS SYSTEM das Level
  der ersten konfigurierten Stage verwenden.
- WHEN eine Folgerunde (zweite, dritte, …) gespielt wird SHALL DAS SYSTEM das
  Level der jeweils entsprechenden konfigurierten Stage verwenden.
- WHEN eine Runde erreicht wird, für die keine eigene Stage konfiguriert wurde
  (mehr Runden als Stages) SHALL DAS SYSTEM das Level der zuletzt
  konfigurierten Stage weiterverwenden, statt das Turnier abzubrechen oder
  einen Fehler zu zeigen.
- WHEN ein Turnier mit genau einer Stage konfiguriert wurde SHALL DAS SYSTEM
  sich identisch zum heutigen Verhalten verhalten (ein Level für das gesamte
  Turnier).
- WHEN ein Match in `/present` läuft SHALL DAS SYSTEM das Level der Runde
  verwenden, zu der dieses Match gehört.

### US-4: Turnierfortschritt inkl. Level je Runde im Bracket sehen

Als Betreiber möchte ich im `/admin`-Turnierbaum auf einen Blick sehen, welches
Level in welcher Runde gilt und welche Runde gerade dran ist, damit ich den
Überblick über ein laufendes Turnier behalte.

Akzeptanzkriterien:

- WHEN der Turnierbaum in `/admin` angezeigt wird SHALL DAS SYSTEM zu jeder
  Runde den Anzeigenamen des für sie geltenden Levels anzeigen.
- WHEN eine Runde mindestens ein laufendes Match enthält SHALL DAS SYSTEM diese
  Runde als "läuft" kennzeichnen.
- WHEN eine Runde einige, aber nicht alle Matches abgeschlossen hat und kein
  Match gerade läuft SHALL DAS SYSTEM diese Runde ebenfalls als "läuft"
  kennzeichnen (die Runde ist angefangen, aber noch nicht durch).
- WHEN alle Matches einer Runde abgeschlossen sind SHALL DAS SYSTEM diese Runde
  als "abgeschlossen" kennzeichnen.
- WHEN kein einziges Match einer Runde begonnen oder abgeschlossen wurde SHALL
  DAS SYSTEM diese Runde als "ausstehend" kennzeichnen.
- WHEN mehr Runden entstehen als Stages konfiguriert wurden SHALL DAS SYSTEM
  für diese Runden den Anzeigenamen des gemäß US-3 wiederverwendeten Levels
  anzeigen – schlicht, ohne zusätzlichen Hinweis auf die Wiederverwendung.

### US-5: Erwartete Rundenzahl als Konfigurationshilfe

Als Betreiber möchte ich beim Konfigurieren sehen, wie viele Runden mein
Turnier voraussichtlich haben wird, damit ich weiß, wie viele Stages sinnvoll
sind.

Akzeptanzkriterien:

- WHEN im Turnier-Setup Teilnehmer ausgewählt sind SHALL DAS SYSTEM die aus
  Teilnehmerzahl und Gruppengröße zu erwartende Rundenzahl anzeigen.
- WHEN sich die Teilnehmerauswahl oder die Gruppengröße ändert SHALL DAS SYSTEM
  die angezeigte Rundenzahl entsprechend aktualisieren.
- WHEN weniger Stages konfiguriert sind als Runden zu erwarten sind SHALL DAS
  SYSTEM darauf hinweisen, dass die restlichen Runden das Level der letzten
  Stage verwenden.
- WHEN mehr Stages konfiguriert sind als Runden zu erwarten sind SHALL DAS
  SYSTEM darauf hinweisen, dass die überzähligen Stages voraussichtlich nicht
  gespielt werden.

### US-6: Ungültige Stage-Konfiguration wird abgelehnt

Als Betreiber möchte ich, dass der Server eine unsinnige Stage-Konfiguration
nicht akzeptiert, damit kein Turnier mit kaputter Level-Zuordnung entsteht und
die Präsentationsansicht nicht mitten in der Show abstürzt.

Akzeptanzkriterien:

- WHEN eine Turnier-Konfiguration mit einer leeren Stage-Liste beim Server
  eintrifft SHALL DAS SYSTEM die Konfiguration ablehnen und den bisherigen
  Turnierzustand unverändert lassen.
- WHEN eine Turnier-Konfiguration mit einer unbekannten Level-ID in mindestens
  einer Stage beim Server eintrifft SHALL DAS SYSTEM die Konfiguration
  ablehnen.
- WHEN eine Turnier-Konfiguration abgelehnt wird SHALL DAS SYSTEM den Grund wie
  bei den bestehenden Ablehnungen (zu wenige Teilnehmer, ungültige Leben,
  ungültige Gruppengröße) auf dem Server protokollieren.

## Nicht-Ziele

- Keine Änderung des Levels für eine bereits laufende oder abgeschlossene Runde
  – die Stage-Zuordnung gilt ab Turnieraufstellung und ist danach fix (analog
  zu `groupSize` und `livesPerRun`).
- Keine automatische Vorschlagslogik ("empfohlene Level-Reihenfolge") – der
  Betreiber wählt jede Stage bewusst selbst. US-5 zeigt nur Zahlen, es wird
  nichts automatisch geändert.
- Kein Drag&Drop zum Umsortieren – siehe `design.md`, Abschnitt "UX-Entscheidung":
  Hoch/Runter-Schaltflächen erfüllen US-2 ohne neue Abhängigkeit und sind
  tastaturbedienbar.
- Keine Änderung an der Scoring-Formel, an den Turnierregeln, an der
  Rangfolge-Logik, am Bracket-Aufbau selbst oder an der Gruppengröße pro Match.
- Keine Begrenzung der maximalen Stage-Anzahl.
- Keine Stage-Konfiguration oder -Übersicht in `/present` – dort läuft nur das
  jeweils aktuelle Match; die Übersicht ist ein `/admin`-Feature.
- Keine Rückwärtskompatibilität zum bisherigen Einzelfeld `levelId` in
  `TournamentConfigureMessage`/`TournamentState`. Turniere leben nur im
  Server-Speicher und werden pro Event neu aufgestellt; Client und Server
  werden gemeinsam ausgeliefert.

## Entschiedene Fragen

- **Hinweis bei wiederverwendetem Level:** Nein – schlichte Anzeige des
  Levelnamens (US-4). *(entschieden)*
- **Umsortieren:** Ja, mit guter UX. Umsetzung über Hoch/Runter-Schaltflächen
  statt Drag&Drop (Begründung im `design.md`). *(entschieden)*
- **Umsetzungszeitpunkt:** Dieses Feature wird jetzt nur geplant; die
  Implementierung erfolgt später, nach Abschluss der parallel laufenden
  Features. *(entschieden)*

## Offene Fragen

- US-5 ist eine Ergänzung, die sich aus dem Wunsch "gute UX" ergeben hat und in
  der ursprünglichen Beschreibung nicht enthalten war. Falls die
  Rundenzahl-Vorschau nicht gewünscht ist, kann US-5 ersatzlos entfallen – die
  übrigen User Stories sind davon unabhängig.
