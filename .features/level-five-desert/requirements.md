# Requirements: Level-Five-Desert

## Kontext

Bezug: `docs/06-level-design.md` (Level-Elemente und Struktur-Vorgaben),
`docs/08-hazards-und-utilities.md` (Hazard-/Utility-Registry),
`docs/05-scoring-und-heats.md` (Scoring: Zeit vs. Früchte),
`docs/02-bot-api.md` (Bot-Sicht `nearbyTiles`, `hazards`, `utilities`).

Bestehende Specs mit Überschneidung (werden weiterverwendet, nicht ersetzt):

- `.features/level-one-arena/` – Datenmodell `LevelDef`, `level/tiles.ts`, Hazard-Registry
- `.features/level-two-background/` – `world/backgroundRegistry.ts`, prozedurale Hintergründe
- `.features/level-three-underground/` – `world/terrainStyleRegistry.ts`
- `.features/level-four-redesign/` – Muster "Geometrie als Spielelement" inkl. exportierter
  Clearance-Konstanten und geometrischer Invarianten-Tests
- `.features/movement-sprint-and-variable-jump/` – Bewegungswerte (`movement/movement.ts`)

Aktuell existieren vier Renn-Level plus ein Toolkit-Test-Level. Level 1, 2 und 3 sind
strukturell dieselbe Bauform (eine Bodenroute mit Lücken, Schwebeplattformen als Bonus),
Level 4 variiert das über eine spielrelevante Decke. Allen gemeinsam ist: **es gibt genau
einen sinnvollen Weg**, und jeder Abgrund ist per (Sprint-)Sprung überwindbar. Das Trampolin
(`boingo`) ist bisher überall nur optionale Deko-Abkürzung.

Level 5 führt deshalb zwei bisher nicht vorhandene Struktur-Elemente ein, ohne die Bot-API zu
erweitern:

1. eine **zwingend** über eine Trampolin-Kette zu überwindende Abgrund-Passage,
2. eine **echte Routenwahl** (sichere Bodenroute vs. ertragreiche Hochroute).

Thematisch ist Level 5 ein Wüsten-Level. Der Schwierigkeitsgrad soll *leicht bis mittel*
liegen – zugänglicher als Level 2 ("Kaizo"), vergleichbar mit oder leichter als Level 1.

Nutzer-Entscheidungen, die diesem Spec zugrunde liegen (bereits getroffen):

- Struktur-Alleinstellung: Boingo-Kette über Großabgrund **und** zwei parallele Routen
- Keine Erweiterung von `HazardKind`/`UtilityKind` im `@arena/bot-contract`
- Theming: prozeduraler Wüsten-Hintergrund + Terrain-Tint (kein neues Tileset/Asset)
- Schwierigkeitsgrad: leicht bis mittel

## Relevante Bewegungswerte (Grundlage aller Geometrie-Kriterien)

Aus `client/src/game/movement/movement.ts` und `client/src/game/scenes/RaceScene.ts`:

| Größe | Herleitung | Wert |
|---|---|---|
| Gravitation | `MOVEMENT_TUNING.GRAVITY_Y` | 900 px/s² |
| Basis-/Sprint-Tempo | `BASE_MOVE_SPEED` / `SPRINT_MOVE_SPEED` | 200 / 320 px/s |
| Basis-/Sprint-Sprungkraft | `BASE_JUMP_VELOCITY` / `SPRINT_JUMP_VELOCITY` | −560 / −650 px/s |
| **Max. Sprunghöhe (Sprint)** | `650² / (2·900)` | **≈ 235 px** |
| Max. Sprungweite (Sprint) | `320 · 2·650/900` | ≈ 462 px |
| Boingo-Absprungkraft | `BOINGO_JUMP_VELOCITY` (`RaceScene.ts`) | −820 px/s |
| **Boingo-Steighöhe** | `820² / (2·900)` | **≈ 373 px** |
| Boingo-Reichweite horiz. (Sprint) | `320 · 2·820/900` | ≈ 583 px |

Diese Werte werden im Level-Modul als exportierte Konstanten dokumentiert (Muster:
`levelFour.ts`, `CLEARANCE_*`) und sind Referenz für die Akzeptanzkriterien unten.

## User Stories

### US-1: Wüsten-Look

Als Messebesucher möchte ich, dass Level 5 auf den ersten Blick als Wüsten-Level erkennbar ist,
damit es sich thematisch klar von den bestehenden Leveln (Tag, SMB-1-1, Nacht, Untergrund)
unterscheidet.

Akzeptanzkriterien:

- WHEN der Hintergrund von Level 5 gerendert wird
  SHALL DAS SYSTEM eine prozedural erzeugte Wüsten-Szenerie zeichnen (warmer Gelb-/Orange-
  Himmelsverlauf, Sonnenscheibe, mindestens zwei gestaffelte Dünen-Silhouetten).
- WHEN Boden-, Plattform- und Decken-Tiles von Level 5 gerendert werden
  SHALL DAS SYSTEM sie mit einem Sandton einfärben, ohne ein neues Tileset zu laden.
- WHEN ein Level einen unbekannten `backgroundKey` oder `terrainStyleKey` referenziert
  SHALL DAS SYSTEM das bestehende Fail-Fast-/Default-Verhalten der jeweiligen Registry
  unverändert beibehalten.
- WHEN ein anderes Level als Level 5 gerendert wird
  SHALL DAS SYSTEM dessen Hintergrund und Terrain-Einfärbung unverändert lassen
  (Regressionsschutz für Level 1-4 und das Toolkit-Test-Level).

### US-2: Trampolin-Kette über den Großen Graben

Als Messebesucher möchte ich einen Abgrund, den mein Bot nur über eine Kette von Trampolinen
überwinden kann, damit das Trampolin erstmals eine echte Pflicht-Mechanik ist und mein Bot
gezielt darauf reagieren muss.

Akzeptanzkriterien:

- WHEN Level 5 geladen wird
  SHALL DAS SYSTEM genau eine zusammenhängende Abgrund-Passage ("Großer Graben") von
  mindestens 1000 px Breite enthalten, in der zwischen den beiden Bodensegmenten keine
  Bodenplattform liegt.
- WHEN die Plattformen des Großen Grabens ausgewertet werden
  SHALL DAS SYSTEM mindestens drei `float`-Plattformen ("Kettenplattformen") innerhalb der
  Grabenbreite enthalten, die den Graben in Teilstrecken unterteilen.
- WHEN die Höhe einer Kettenplattform gegenüber dem Bodenniveau (`groundY`) geprüft wird
  SHALL DAS SYSTEM einen Höhenunterschied von mehr als 235 px (max. Sprint-Sprunghöhe)
  aufweisen, sodass keine Kettenplattform vom Boden aus per Sprung erreichbar ist.
- WHEN die Höhe einer Kettenplattform gegenüber dem Bodenniveau geprüft wird
  SHALL DAS SYSTEM einen Höhenunterschied von höchstens 340 px aufweisen (Sicherheitsmarge von
  mindestens 30 px zur Boingo-Steighöhe von 373 px), sodass sie per Trampolin erreichbar bleibt.
- WHEN der Trampolin-Sprung von einem Ketten-Trampolin zur nächsten Kettenplattform ausgewertet
  wird
  SHALL DAS SYSTEM die Zielplattform so dimensionieren, dass sie das gesamte Landefenster
  zwischen Basistempo (200 px/s) und Sprinttempo (320 px/s) abdeckt, sodass der Sprung
  unabhängig von der Anlaufgeschwindigkeit gelingt.
- WHEN eine Kettenplattform ausgewertet wird, von der aus ein weiterer Ketten-Hop nötig ist
  SHALL DAS SYSTEM genau ein `boingo`-Utility darauf platziert haben, dessen `y` der in den
  Bestandsleveln etablierten Konvention `plattformY - 14` entspricht.
- WHEN die letzte Kettenplattform ausgewertet wird
  SHALL DAS SYSTEM sie ohne Trampolin ausstatten und so positionieren, dass der Bot durch
  einfaches Herunterlaufen ein Bodensegment hinter dem Großen Graben erreicht (unabhängig von
  Basis- oder Sprinttempo).
- WHEN das Bodensegment vor dem Großen Graben ausgewertet wird
  SHALL DAS SYSTEM dort ein `boingo`-Utility als Einstieg in die Kette enthalten.
- WHEN ein Bot in den Großen Graben fällt
  SHALL DAS SYSTEM das bestehende Abgrund-Verhalten (Leben abziehen, Respawn am letzten
  Checkpoint) unverändert anwenden.
- WHEN unmittelbar vor dem Großen Graben nach einem Checkpoint gesucht wird
  SHALL DAS SYSTEM dort einen Checkpoint bereitstellen, sodass ein Absturz nicht zu einem
  Respawn weit vor der Passage führt.

### US-3: Zwei parallele Routen mit Zielkonflikt

Als Messebesucher möchte ich, dass mein Bot zwischen einer schnellen sicheren und einer
langsameren ertragreichen Route wählen muss, damit die Scoring-Formel (Zeit vs. Früchte) zu
einer echten Strategieentscheidung im `decide(state)` führt.

Akzeptanzkriterien:

- WHEN das Layout von Level 5 außerhalb des Großen Grabens ausgewertet wird
  SHALL DAS SYSTEM einen durchgehend begehbaren Bodenweg ("Bodenroute") und einen parallel
  darüber liegenden Weg aus `float`-Plattformen ("Hochroute") enthalten.
- WHEN die Hochroute ausgewertet wird
  SHALL DAS SYSTEM sie über mindestens 600 px horizontal parallel zur Bodenroute verlaufen
  lassen und sie vor dem Ziel wieder in die Bodenroute münden lassen.
- WHEN der Einstieg in die Hochroute geprüft wird
  SHALL DAS SYSTEM ihn von der Bodenroute aus per Sprung erreichbar machen (Höhenunterschied
  höchstens 200 px, also innerhalb der Sprint-Sprunghöhe von 235 px inkl. Marge).
- WHEN der Fruchtwert der Hochroute mit dem der parallel verlaufenden Bodenroute verglichen wird
  SHALL DAS SYSTEM auf der Hochroute den höheren Gesamtwert (Summe gemäß `FRUIT_VALUES`)
  platzieren.
- WHEN die Hazard-Verteilung beider Routen verglichen wird
  SHALL DAS SYSTEM auf der Hochroute mindestens so viele Hazards platzieren wie auf dem
  parallelen Abschnitt der Bodenroute, damit der höhere Ertrag mit höherem Risiko erkauft wird.
- WHEN ein Bot ausschließlich der Bodenroute folgt
  SHALL DAS SYSTEM ihn das Ziel erreichen lassen, ohne die Hochroute zu betreten
  (die Hochroute ist optional, der Große Graben nicht).

### US-4: Einhaltung der Level-Struktur-Vorgaben

Als Entwickler möchte ich, dass Level 5 dieselben Struktur-Konventionen erfüllt wie Level 1-4,
damit Scoring, Bot-Sicht und HUD ohne Sonderfälle funktionieren.

Akzeptanzkriterien:

- WHEN Level 5 geladen wird
  SHALL DAS SYSTEM 10-15 sichtbare Früchte, 3-5 versteckte Coin-Blöcke, mindestens 3
  Checkpoints, genau einen Spawn und genau ein Ziel bereitstellen (Vorgabe
  `docs/06-level-design.md`).
- WHEN die Welt-Abmessungen von Level 5 geprüft werden
  SHALL DAS SYSTEM `worldHeight = 540` und `groundY = 500` verwenden (kein vertikales Scrollen,
  konsistent zu Level 1-4).
- WHEN alle Entitäts-IDs von Level 5 (Früchte, versteckte Blöcke, Checkpoints, Hazards,
  Utilities) gesammelt werden
  SHALL DAS SYSTEM ausschließlich paarweise verschiedene IDs enthalten.
- WHEN die Hazards von Level 5 ausgewertet werden
  SHALL DAS SYSTEM ausschließlich bereits registrierte `HazardKind`-Werte verwenden und keinen
  neuen Typ einführen.
- WHEN Bodenlücken außerhalb des Großen Grabens gemessen werden
  SHALL DAS SYSTEM keine Lücke breiter als 160 px enthalten (Schwierigkeitsgrad leicht-mittel).
- WHEN die Hazard-Zusammenstellung von Level 5 mit Level 2 verglichen wird
  SHALL DAS SYSTEM keinen Mehrfach-Gauntlet gleichartiger Hazards und höchstens einen
  `spikehead` mit entschärften Timings enthalten.

### US-5: Auswählbarkeit in allen Betriebsmodi

Als Standbetreuer möchte ich Level 5 überall dort auswählen können, wo bereits Level 1-4
auswählbar sind, damit ich es in Dev-Station, Präsentation und Turnier einsetzen kann.

Akzeptanzkriterien:

- WHEN die Level-Registry im Client ausgewertet wird
  SHALL DAS SYSTEM einen Eintrag mit der ID `level-five` und einem sprechenden Label enthalten.
- WHEN die Level-IDs aus `@arena/shared` mit den IDs der Client-Registry verglichen werden
  SHALL DAS SYSTEM beide Mengen als identisch ausweisen (Zwei-Wege-Konsistenz).
- WHEN der Server eine Level-ID `level-five` validiert
  SHALL DAS SYSTEM sie als gültig akzeptieren.
- WHEN die Level-Auswahl in Dev-Station, Präsentationsmodus und Turnier-Stage-Editor gerendert
  wird
  SHALL DAS SYSTEM Level 5 als Option anbieten, ohne dass dafür weitere Code-Änderungen an
  diesen Komponenten nötig sind (sie speisen sich aus der Registry).
- WHEN eine bestehende Turnier-Konfiguration ohne Level 5 geladen wird
  SHALL DAS SYSTEM sie unverändert weiterverwenden (Level 5 ist verfügbar, aber keine
  Voreinstellung).

## Nicht-Ziele

- Keine Erweiterung von `HazardKind` oder `UtilityKind` im `@arena/bot-contract`; insbesondere
  **kein** Treibsand-, Sand-, Fan- oder Pfeil-Hazard (das ungenutzte Asset-Set
  `Traps/Sand Mud Ice/` bleibt ungenutzt).
- Keine Änderung an der Bot-API (`docs/02-bot-api.md`), am State-Builder oder an der Sandbox.
- Kein neues Terrain-Tileset und kein neues Bild-Asset; der Wüsten-Look entsteht ausschließlich
  aus prozeduraler Hintergrund-Textur und Tint auf dem bestehenden `TERRAIN_TILES`-Frameset.
- Keine Änderung an `worldBuilder.ts`, `level/tiles.ts`, `hazards/*` oder an den
  Bewegungswerten in `movement/movement.ts`.
- Keine Änderung an Level 1-4 oder am Toolkit-Test-Level.
- Kein vertikales Scrollen, keine Änderung der Kamera-Logik.
- Keine Änderung der Scoring-Formel; die Routenwahl wirkt allein über die vorhandene
  Zeit-/Frucht-Gewichtung.
- Level 5 wird nicht als Default-Stage einer Turnierrunde gesetzt.

## Offene Fragen

Alle offenen Fragen wurden bei der Freigabe der Requirements gemäß den jeweiligen Vorschlägen
entschieden (Status: **geklärt**):

1. **Label in der Registry:** ✅ `"Level 5 – Desert"` (englisch, konsistent zu
   `"Level 3 – Night"` / `"Level 4 – Underground"`).
2. **Deckensegmente:** ✅ Level 5 bleibt deckenfrei (keine `kind: "ceiling"`-Segmente), um sich
   klar von Level 4 abzugrenzen.
3. **Verhalten bei verpasster Kette:** ✅ Nur ein Checkpoint vor dem Großen Graben, keiner auf
   den Kettenplattformen – die Passage muss als Ganzes gemeistert werden.
4. **Frucht-Budget:** ✅ Früchte auf den Kettenplattformen bilden einen eigenen Bereich und sind
   vom Routen-Vergleich in US-3 ausgenommen.

## Nachträgliche Korrektur (nach Design-Vorprüfung)

Bei der Durchrechnung der Geometrie für `design.md` hat sich ein ursprüngliches
Akzeptanzkriterium aus US-2 als **physikalisch unerfüllbar** erwiesen; es wurde oben ersetzt
(dokumentiert gemäß AGENTS.md: Korrektur in den Requirements statt stillem Übergehen im Design).

**Ursprüngliche Fassung:** „Jede Kettenplattform liegt mehr als 235 px über der nächstniedrigeren
erreichbaren Standfläche (Bodensegment **oder vorhergehende Kettenplattform**)."

**Problem:** Die Welt ist nur 540 px hoch, das Bodenniveau liegt bei `groundY = 500`. Die erste
Kettenplattform muss bereits ≈ 300 px über dem Boden liegen (also bei y ≈ 200), damit sie per
Sprung unerreichbar bleibt. Eine zweite Kettenplattform müsste dann nochmals > 235 px höher
liegen, also bei y < −35 – außerhalb der Welt. Eine aufsteigende Kette ist damit unmöglich.

**Ebenfalls verworfen:** die Alternative, jeden einzelnen Hop über die *horizontale* Distanz zu
erzwingen (Hop > 462 px Sprint-Sprungweite). Das lässt bei einer Boingo-Reichweite von 583 px nur
ein Landefenster für Anlaufgeschwindigkeiten von ca. 264–320 px/s – eine Präzisionsanforderung,
die dem festgelegten Schwierigkeitsgrad „leicht bis mittel" widerspricht.

**Neue Fassung (oben eingearbeitet):** Das Trampolin ist zwingend für den **Einstieg** in die
Kette (300 px Höhenunterschied, per Sprung nicht überwindbar) und ist für die Hops der
*verlässliche* Weg: die Zielplattformen decken das gesamte Landefenster von Basis- bis
Sprinttempo ab, sodass der Hop geschwindigkeitsunabhängig gelingt. Dass ein perfekt getimter
Sprint-Sprung einen einzelnen Hop ebenfalls schaffen kann, ist als Experten-Linie akzeptiert –
die Passage als Ganzes bleibt ohne Trampolin unpassierbar.
