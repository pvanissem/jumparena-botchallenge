# Requirements: Level-Four-Redesign

## Kontext

Bezug: `docs/06-level-design.md` (Level-Elemente), `docs/08-hazards-und-utilities.md`
(Hazard-/Utility-Registry), `docs/02-bot-api.md` (Bot-Sicht `nearbyTiles`) sowie das
bestehende Spec `.features/level-four-underground/` (Ursprungs-Feature von `LEVEL_FOUR`).

Level 4 ("Underground") wurde in `.features/level-four-underground/` bewusst als *primär
thematisches* Level spezifiziert: identische Lücken-Logik wie Level 3, reduzierte Hazard-Anzahl,
keine Schwierigkeitssteigerung. Das Ergebnis (`client/src/game/level/levelFour.ts`) ist deshalb
strukturell eine Kopie von `LEVEL_THREE`:

- identische Boden-Segmente (`x = 0/448/832/1248/1648/2096`, gleiche `tilesWide`),
- identische Coin-, Hidden-Block- und Checkpoint-Koordinaten,
- nahezu identische Hazards (2× Schnetzler, 2× Stachlinger, 1× Loderix, gleiche Timings/Positionen),
- die Decke ist auf konstanten 224px reine Deko ohne Gameplay-Wirkung.

Zusätzlich trifft das aktuelle Farbschema den Super-Mario-Bros.-Untergrund-Look nicht:

- Hintergrund (`world/proceduralBackgrounds.ts`): schwarzer Grund + **grünliches**
  Backstein-Raster (`0x2a7a3a`) – im NES-Vorbild (SMB 1-2) ist der Hintergrund **komplett
  schwarz**, es gibt dort gar kein Mauerwerk im Background.
- Terrain (`world/terrainStyleRegistry.ts`): **graue** Stein-Tiles ohne Einfärbung – im Vorbild
  sind Boden/Decke **blau** (Cyan-Blau-Palette).

Dieses Feature plant Level 4 um: eigenständiges Layout mit der Decke als Spielelement und ein
SMB-1-2-treues Farbschema. Es ersetzt die Layout- und Farb-Entscheidungen aus
`.features/level-four-underground/`; die dort eingeführten *Mechanismen*
(`PlatformDef.kind: "ceiling"`, Terrain-Frame-Sets, prozeduraler Underground-Hintergrund)
bleiben bestehen und werden weiterverwendet.

## User Stories

### US-1: SMB-1-2-treues Farbschema

Als Messebesucher möchte ich, dass Level 4 auf den ersten Blick wie ein Untergrund-Level aus
Super Mario Bros. aussieht, damit das Level thematisch klar von den anderen Leveln unterscheidbar
ist und den nostalgischen Wiedererkennungswert bietet.

Akzeptanzkriterien:

- WHEN der Hintergrund von Level 4 gerendert wird
  SHALL DAS SYSTEM eine durchgehend schwarze Fläche zeichnen, ohne Backstein-, Mauerwerk- oder
  sonstiges Musterelement.
- WHEN Boden-, Decken- und Plattform-Tiles von Level 4 gerendert werden
  SHALL DAS SYSTEM sie in einem blauen Farbton einfärben (NES-Untergrund-Palette), statt sie
  grau/uneingefärbt zu lassen.
- WHEN ein anderes Level als Level 4 gerendert wird
  SHALL DAS SYSTEM dessen Hintergrund und Terrain-Einfärbung unverändert lassen
  (Regressionsschutz für Level 1-3 und das Toolkit-Test-Level).

### US-2: Eigenständiges Layout (kein Level-3-Klon)

Als Messebesucher möchte ich, dass sich Level 4 spürbar anders spielt als Level 1-3, damit sich
das Durchspielen mehrerer Level lohnt und mein Bot nicht mit derselben Strategie überall
durchkommt.

Akzeptanzkriterien:

- WHEN die Boden-Segment-Geometrie von Level 4 mit der von Level 3 verglichen wird
  SHALL DAS SYSTEM eine abweichende Segmentierung aufweisen (nicht dieselbe Folge aus
  `x`/`tilesWide`).
- WHEN die Boden-Lücken von Level 4 ausgewertet werden
  SHALL DAS SYSTEM mindestens drei unterschiedliche Lückenbreiten enthalten (kein gleichförmiger
  128px-Takt wie in Level 3).
- WHEN die Hazard-Positionen von Level 4 mit denen von Level 3 verglichen werden
  SHALL DAS SYSTEM keine identische Hazard-Position übernehmen.
- WHEN Level 4 gebaut wird
  SHALL DAS SYSTEM mindestens einen `ninjafrog` (stompbarer Gegner) enthalten, der in keinem
  anderen Level vorkommt.
- WHEN Level 4 gebaut wird
  SHALL DAS SYSTEM mindestens einen `spikehead` enthalten, dessen Ruheposition an der Decke liegt
  (Stalaktit) statt frei in der Luft.
- WHEN Level 4 gebaut wird
  SHALL DAS SYSTEM keinen `kugelblitz` enthalten.

### US-3: Die Decke als Spielelement (Kriechpassagen)

Als Bot-Bauer möchte ich in Level 4 auf eine Situation treffen, die sich nicht durch Springen
lösen lässt, damit ich meine `decide()`-Logik über das aus Level 1-3 bekannte Muster hinaus
erweitern muss.

Akzeptanzkriterien:

- WHEN die Korridorhöhe über die Levellänge ausgewertet wird
  SHALL DAS SYSTEM mindestens drei verschiedene Deckenhöhen verwenden: eine niedrige (Sprung
  physisch unmöglich), eine normale (regulärer Sprung möglich) und eine hohe (Boingo-Schacht).
- WHEN die Decken-Segmente von Level 4 ausgewertet werden
  SHALL DAS SYSTEM den Bereich von `x = 0` bis `x = worldWidth` lückenlos und überlappungsfrei
  abdecken (durchgehend geschlossener Korridor).
- WHEN sich der Bot in einer Zone mit niedriger Decke befindet
  SHALL DAS SYSTEM diese Zone ohne jeden Sprung passierbar halten (keine Boden-Lücke, keine
  Schwebeplattform und kein Hazard, der nur durch Überspringen zu umgehen wäre).
- WHEN in einer Zone mit niedriger Decke ein Hazard platziert ist
  SHALL DAS SYSTEM ausschließlich zeitgesteuerte Hazards (`loderix`) zulassen, deren
  "Aus"-Phase ein sprungfreies Durchlaufen erlaubt.
- WHEN eine normale Deckenhöhe verwendet wird
  SHALL DAS SYSTEM einen lichten Abstand von mindestens 200px zum Boden einhalten (max.
  Sprunghöhe ≈174px + Spieler-Hitbox 32px), damit reguläre Sprünge ohne zwingenden Kopfstoß
  möglich bleiben.

### US-4: Angemessene Schwierigkeit

Als Messebesucher möchte ich, dass Level 4 anspruchsvoller ist als Level 3, aber nicht so
fordernd wie das Kaizo-Level 2, damit die Levelreihenfolge eine sinnvolle Steigerung ergibt.

Akzeptanzkriterien:

- WHEN die Boden-Lücken von Level 4 ausgewertet werden
  SHALL DAS SYSTEM keine Lücke breiter als 170px enthalten (Level-2-Lücken sind 176-208px breit).
- WHEN die Anzahl der Hazards von Level 4 ausgewertet wird
  SHALL DAS SYSTEM mehr Hazards enthalten als Level 3, aber höchstens so viele wie Level 2.
- WHEN Level 4 gebaut wird
  SHALL DAS SYSTEM mindestens 3 Checkpoints enthalten, sodass ein Fehlschlag nicht zum Neustart
  des gesamten Levels führt.

### US-5: Bestehende Level-Konventionen bleiben eingehalten

Als Entwickler möchte ich, dass Level 4 dieselben strukturellen Regeln erfüllt wie alle anderen
Level, damit Scoring, Heats und Bot-Sicht unverändert funktionieren.

Akzeptanzkriterien:

- WHEN Level 4 gebaut wird
  SHALL DAS SYSTEM 10-15 sichtbare Münzen, 3-5 versteckte Blöcke und eine `worldWidth` zwischen
  2400px und 3000px aufweisen (wie Level 1-3, siehe `docs/06-level-design.md`).
- WHEN die IDs aller Münzen, versteckten Blöcke, Checkpoints, Hazards und Utilities von Level 4
  gesammelt werden
  SHALL DAS SYSTEM ausschließlich eindeutige IDs liefern.
- WHEN eine Münze, ein versteckter Block, ein Checkpoint oder eine Utility platziert wird
  SHALL DAS SYSTEM sicherstellen, dass sich darunter ein Boden-Segment befindet (Ausnahme:
  Elemente, die bewusst auf einer Schwebeplattform oder in einer Decken-Alkove liegen und dort
  erreichbar sind).
- WHEN Level 4 Hazards enthält
  SHALL DAS SYSTEM ausschließlich bereits existierende Hazard-Kinds verwenden (kein neuer
  Hazard-Typ).

## Nicht-Ziele

- **Keine Änderung am Bot-Contract** (`docs/02-bot-api.md`): Sichtfeldgröße, State-/Action-Format
  und Hazard-Kinds bleiben unverändert.
- **Kein neuer Hazard- oder Utility-Typ**: Es werden ausschließlich bestehende Kinds
  (`schnetzler`, `ninjafrog`, `stachlinger`, `loderix`, `spikehead`, `boingo`) verwendet.
- **Kein `kugelblitz` in Level 4** (bewusste Entscheidung, siehe US-2).
- **Keine Änderung an Level 1-3** oder am Toolkit-Test-Level.
- **Keine Änderung an Scoring, Heats oder Turniermodus.**
- **Keine neuen Bild-Assets**: Das Farbschema wird über das vorhandene Tileset (Frame-Set + Tint)
  und den prozeduralen Hintergrund realisiert.
- **Keine physikalischen Änderungen** an `MOVE_SPEED`, `JUMP_VELOCITY` oder Gravitation.

## Offene Fragen

1. **Bot-Sicht vs. Kriechpassagen (wichtigste offene Frage).**
   `level/tiles.ts#buildNearbyTiles` liefert ein 7×5-Raster um den Bot, also nur 2 Tile-Reihen
   (32px) oberhalb der Spielermitte. Eine Decke auf ~96px Höhe ist für den Bot damit **nicht
   wahrnehmbar** – er kann eine Kriechpassage nicht "sehen", sondern nur an ihr anstoßen.

   Entscheidung für dieses Feature: Das Sichtfeld wird **nicht** verändert (Bot-Contract-Eingriff,
   eigenes Feature). Stattdessen wird die Fairness über das Level-Design sichergestellt (US-3):
   Ein "falscher" Sprung in einer Kriechpassage kostet nur Zeit, nie direkt ein Leben, weil dort
   ausschließlich zeitgesteuerte Hazards stehen, deren korrekte Strategie ("Aus-Phase abwarten,
   dann durchlaufen") allein aus dem Hazard-Zustand im Bot-State ableitbar ist.

   Offen bleibt, ob langfristig eine Sichtfeld-Erweiterung nach oben sinnvoll ist – zu klären in
   einem separaten Feature, ggf. als Ergänzung zu `docs/07-offene-punkte.md`.

2. **Erreichbarkeit von Decken-Alkoven.** Der geplante Boingo-Schacht führt in eine hohe Kammer
   mit Bonus-Früchten. Zu klären im Design: Reicht ein Boingo-Sprung sicher bis zur Alkove, und
   wie wird verhindert, dass der Bot dort "hängenbleibt"?

3. **Anzahl der Kriechpassagen.** Eine (als Lern-Situation) oder zwei (als Wiederholung/
   Bestätigung)? Vorschlag fürs Design: zwei, die zweite mit engerem Timing.
