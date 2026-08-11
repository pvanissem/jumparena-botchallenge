# Requirements: Level-Six-Frost

## Kontext

Bezug: `docs/06-level-design.md` (Level-Elemente und Struktur-Vorgaben),
`docs/08-hazards-und-utilities.md` (Hazard-/Utility-Registry, insb. Loderix `timed` und
Spikehead `trigger`), `docs/02-bot-api.md` (Bot-Sicht auf Hazards: `active`/`warning`-Flags in
`WorldSnapshot.hazards`/`BotState.hazards`).

Bestehende Specs mit Überschneidung (werden weiterverwendet, nicht ersetzt):

- `.features/level-one-arena/` – Datenmodell `LevelDef`, `level/tiles.ts`, Hazard-Registry
- `.features/level-two-background/` – `world/backgroundRegistry.ts`, prozedurale Hintergründe
- `.features/level-three-underground/` – `world/terrainStyleRegistry.ts`
- `.features/level-two-kaizo/` – Präzedenzfall für Spikehead-Einsatz und engere Timings
- `.features/level-four-redesign/` – Muster "Geometrie als Spielelement" inkl. exportierter
  Geometrie-Konstanten und Invarianten-Tests
- `.features/level-five-desert/` – direktes Vorbild für Ablauf, Test-Struktur
  (`levelFive.test.ts`) und das Muster "neues Theme + neues Struktur-Element ohne Bot-API-
  Erweiterung"
- `.features/hazard-destroyed-state-in-bot-vision/` – Referenz für `active`/Sichtbarkeits-
  Semantik von Hazards im `WorldSnapshot`

Aktuell existieren fünf Renn-Level plus ein Toolkit-Test-Level. Jedes bisherige Level bringt ein
eigenes visuelles Theme und meist 1-2 neue Struktur-Ideen mit, ohne `HazardKind`/`UtilityKind`
im `@arena/bot-contract` zu erweitern. Timed- (Loderix) und Trigger-Hazards (Spikehead) wurden
bisher immer **einzeln** und mit Standard- oder leicht entschärften Timings eingesetzt (siehe
Level 2/3/5) – nie so kombiniert, dass ein Bot mehrere Zeitfenster gleichzeitig im Blick behalten
und vorausplanen muss.

Level 6 führt deshalb ein bisher nicht vorhandenes Struktur-Element ein, ohne die Bot-API zu
erweitern: eine **"Frost-Gauntlet"-Zone**, in der zwei Loderix-Instanzen mit exakt
gegenläufigem Timing (nie beide gleichzeitig sicher, nie beide gleichzeitig gefährlich) plus ein
unmittelbar anschließender Spikehead ein zusammenhängendes Timing-Puzzle bilden.

Thematisch ist Level 6 ein Eis-/Schnee-Level. Der Schwierigkeitsgrad soll *mittel* liegen –
vergleichbar mit Level 4/5, spürbar fordernder als Level 1/3, aber ohne Kaizo-artige
Lücken-Präzision (Level 2).

Nutzer-Entscheidungen, die diesem Spec zugrunde liegen (bereits getroffen):

- Theme: Eis/Schnee (prozeduraler Hintergrund + Terrain-Tint, kein neues Tileset/Asset)
- Schwierigkeitsgrad: mittel
- Struktur-Alleinstellung: getimtes Hazard-Puzzle (Loderix-Duo im Gegentakt + nachgelagerter
  Spikehead), kein Pflicht-Abgrund und keine zweite volle Parallelroute wie in Level 5
- Keine Erweiterung von `HazardKind`/`UtilityKind` im `@arena/bot-contract`

## Relevante Bewegungswerte (Grundlage aller Geometrie-Kriterien)

Aus `client/src/game/movement/movement.ts` (`MOVEMENT_TUNING`), identisch zur Grundlage von
Level 5:

| Größe | Herleitung | Wert |
|---|---|---|
| Gravitation | `GRAVITY_Y` | 900 px/s² |
| Basis-/Sprint-Tempo | `BASE_MOVE_SPEED` / `SPRINT_MOVE_SPEED` | 200 / 320 px/s |
| Basis-/Sprint-Sprungkraft | `BASE_JUMP_VELOCITY` / `SPRINT_JUMP_VELOCITY` | −560 / −650 px/s |
| Max. Sprunghöhe (Basis/Sprint) | `560²/(2·900)` / `650²/(2·900)` | ≈ 174 / 235 px |
| Max. Sprungweite (Basis/Sprint) | `200·2·560/900` / `320·2·650/900` | ≈ 249 / 462 px |
| Boingo-Absprungkraft | `BOINGO_JUMP_VELOCITY` | −820 px/s |
| Boingo-Steighöhe | `820²/(2·900)` | ≈ 373 px |

Relevante Hazard-Timing-Semantik aus `client/src/game/hazards/behaviors.ts` /
`hazards/registry.ts` (`HAZARD_DEFAULTS`):

- `isTimedActive(def, elapsedMs)`: `cycleMs = onMs + offMs`; aktiv (gefährlich), wenn
  `(elapsedMs + phaseMs) % cycleMs < onMs`.
- `spikeheadState(def, msSinceTrigger)`: Phasenfolge `idle -> warning (ungefährlich) -> falling
  -> resting -> rising (alle drei gefährlich) -> idle`, Standard-Timings `warnMs=400, fallMs=200,
  restMs=600, riseMs=500` (`HAZARD_DEFAULTS.spikehead`).

Diese Werte werden im Level-Modul als exportierte Konstanten dokumentiert (Muster:
`levelFive.ts`, `CHAIN_Y`/`CHASM_MIN_X`) und sind Referenz für die Akzeptanzkriterien unten.

## User Stories

### US-1: Frost-Look

Als Messebesucher möchte ich, dass Level 6 auf den ersten Blick als Eis-/Schnee-Level erkennbar
ist, damit es sich thematisch klar von den bestehenden Leveln (Tag, SMB-1-1, Nacht, Untergrund,
Wüste) unterscheidet.

Akzeptanzkriterien:

- WHEN der Hintergrund von Level 6 gerendert wird
  SHALL DAS SYSTEM eine prozedural erzeugte Eis-/Schnee-Szenerie zeichnen (kühler Blau-Weiß-
  Himmelsverlauf, mindestens zwei gestaffelte verschneite Bergsilhouetten).
- WHEN Boden-, Plattform- und Deckentiles von Level 6 gerendert werden
  SHALL DAS SYSTEM sie mit einem hellen Eisblau-Ton einfärben, ohne ein neues Tileset zu laden.
- WHEN ein Level einen unbekannten `backgroundKey` oder `terrainStyleKey` referenziert
  SHALL DAS SYSTEM das bestehende Fail-Fast-/Default-Verhalten der jeweiligen Registry
  unverändert beibehalten.
- WHEN ein anderes Level als Level 6 gerendert wird
  SHALL DAS SYSTEM dessen Hintergrund und Terrain-Einfärbung unverändert lassen
  (Regressionsschutz für Level 1-5 und das Toolkit-Test-Level).

### US-2: Frost-Gauntlet – getimtes Hazard-Puzzle

Als Messebesucher möchte ich eine Zone, in der zwei Feuer-/Frost-Fallen (Loderix) im Gegentakt
laufen und direkt danach eine dritte, ausgelöste Falle (Spikehead) wartet, damit mein Bot
mehrere Zeitfenster gleichzeitig lesen und vorausschauend planen muss, statt nur auf den
nächstgelegenen Hazard zu reagieren.

Akzeptanzkriterien:

- WHEN Level 6 geladen wird
  SHALL DAS SYSTEM genau eine zusammenhängende, hindernisfreie Bodenpassage ("Frost-Gauntlet")
  enthalten, auf der ausschließlich zwei `loderix`-Instanzen und ein `spikehead` als Hazards
  liegen (keine zusätzliche Lücke, keine zusätzliche Plattform-Änderung innerhalb der Zone).
- WHEN die Timing-Parameter (`onMs`, `offMs`, `phaseMs`) der beiden Loderix-Instanzen der
  Frost-Gauntlet-Zone ausgewertet werden
  SHALL DAS SYSTEM `onMs = offMs` für beide Instanzen setzen und `phaseMs` der zweiten Instanz
  um genau eine halbe Zykluslänge (`(onMs + offMs) / 2`) gegenüber der ersten verschieben.
- WHEN die Aktivität (`isTimedActive`) beider Loderix-Instanzen der Frost-Gauntlet-Zone zu einem
  beliebigen Zeitpunkt `t` verglichen wird
  SHALL DAS SYSTEM sicherstellen, dass zu jedem Zeitpunkt genau eine der beiden Instanzen aktiv
  (gefährlich) und die andere inaktiv (sicher) ist – nie beide gleichzeitig aktiv, nie beide
  gleichzeitig inaktiv.
- WHEN der horizontale Abstand zwischen den beiden Loderix-Instanzen der Frost-Gauntlet-Zone
  geprüft wird
  SHALL DAS SYSTEM ihn so bemessen, dass ein durchgehend mit Sprint-Tempo (320 px/s) laufender
  Bot, der die erste Instanz exakt beim Wechsel von aktiv zu inaktiv passiert, die zweite Instanz
  ebenfalls während ihres inaktiven Fensters erreicht (kein Halt in der Zone erforderlich, wenn
  perfekt getimt).
- WHEN die Trigger-Zone des Spikehead der Frost-Gauntlet-Zone geprüft wird
  SHALL DAS SYSTEM sie unmittelbar hinter der zweiten Loderix-Instanz beginnen lassen (Abstand
  Loderix-2 zu `triggerMinX` höchstens 40 px), sodass der Bot die Loderix-Passage und den
  Spikehead-Trigger nicht unabhängig voneinander, sondern als einen zusammenhängenden Vorgang
  planen muss.
- WHEN der Spikehead der Frost-Gauntlet-Zone auf `fallToY` fällt
  SHALL DAS SYSTEM `fallToY` auf Bodenniveau der Gauntlet-Passage (`GROUND_Y - 16`) setzen, ohne
  eine zusätzliche Landeplattform einzuführen.
- WHEN unmittelbar vor der Frost-Gauntlet-Zone nach einem Checkpoint gesucht wird
  SHALL DAS SYSTEM dort einen Checkpoint bereitstellen.
- WHEN unmittelbar nach der Frost-Gauntlet-Zone (nach dem Spikehead) nach einem Checkpoint
  gesucht wird
  SHALL DAS SYSTEM dort ebenfalls einen Checkpoint bereitstellen, sodass ein Fehlversuch
  innerhalb der Zone nicht zu einem Respawn weit davor führt.
- WHEN ein Bot innerhalb der Frost-Gauntlet-Zone einen Hazard berührt
  SHALL DAS SYSTEM das bestehende Hazard-Kontakt-Verhalten (Leben abziehen, Respawn am letzten
  Checkpoint) unverändert anwenden.

### US-3: Einhaltung der Level-Struktur-Vorgaben

Als Entwickler möchte ich, dass Level 6 dieselben Struktur-Konventionen erfüllt wie Level 1-5,
damit Scoring, Bot-Sicht und HUD ohne Sonderfälle funktionieren.

Akzeptanzkriterien:

- WHEN Level 6 geladen wird
  SHALL DAS SYSTEM 10-15 sichtbare Früchte, 3-5 versteckte Coin-Blöcke, mindestens 3
  Checkpoints, genau einen Spawn und genau ein Ziel bereitstellen (Vorgabe
  `docs/06-level-design.md`).
- WHEN die Welt-Abmessungen von Level 6 geprüft werden
  SHALL DAS SYSTEM `worldHeight = 540` und `groundY = 500` verwenden (kein vertikales Scrollen,
  konsistent zu Level 1-5).
- WHEN alle Entitäts-IDs von Level 6 (Früchte, versteckte Blöcke, Checkpoints, Hazards,
  Utilities) gesammelt werden
  SHALL DAS SYSTEM ausschließlich paarweise verschiedene IDs enthalten.
- WHEN die Hazards von Level 6 ausgewertet werden
  SHALL DAS SYSTEM ausschließlich bereits registrierte `HazardKind`-Werte verwenden (kein neuer
  Typ) und dabei alle sechs bestehenden Kinds mindestens einmal über die Level-1-6-Gesamtheit
  hinweg nicht erneut einführen müssen – konkret: `ninjafrog` (Patrouille), `stachlinger`
  (statisch), `kugelblitz` (Pendel), `loderix` (getaktet, 2×) und `spikehead` (Trigger) je
  mindestens einmal.
- WHEN Bodenlücken außerhalb der Frost-Gauntlet-Zone gemessen werden
  SHALL DAS SYSTEM keine Lücke breiter als 190 px enthalten (per Basis-Sprung von ≈249 px ohne
  Sprint überwindbar, Sicherheitsmarge für Schwierigkeitsgrad "mittel").
- WHEN ein optionales `boingo`-Utility außerhalb der Frost-Gauntlet-Zone platziert wird
  SHALL DAS SYSTEM es ausschließlich als Zugang zu einer Bonus-Alkove mit hochwertiger Frucht
  einsetzen, deren Erreichen für das Levelziel nicht erforderlich ist.

### US-4: Auswählbarkeit in allen Betriebsmodi

Als Standbetreuer möchte ich Level 6 überall dort auswählen können, wo bereits Level 1-5
auswählbar sind, damit ich es in Dev-Station, Präsentation und Turnier einsetzen kann.

Akzeptanzkriterien:

- WHEN die Level-Registry im Client ausgewertet wird
  SHALL DAS SYSTEM einen Eintrag mit der ID `level-six` und einem sprechenden Label enthalten.
- WHEN die Level-IDs aus `@arena/shared` mit den IDs der Client-Registry verglichen werden
  SHALL DAS SYSTEM beide Mengen als identisch ausweisen (Zwei-Wege-Konsistenz).
- WHEN der Server eine Level-ID `level-six` validiert
  SHALL DAS SYSTEM sie als gültig akzeptieren.
- WHEN die Level-Auswahl in Dev-Station, Präsentationsmodus und Turnier-Stage-Editor gerendert
  wird
  SHALL DAS SYSTEM Level 6 als Option anbieten, ohne dass dafür weitere Code-Änderungen an
  diesen Komponenten nötig sind (sie speisen sich aus der Registry).
- WHEN eine bestehende Turnier-Konfiguration ohne Level 6 geladen wird
  SHALL DAS SYSTEM sie unverändert weiterverwenden (Level 6 ist verfügbar, aber keine
  Voreinstellung).

## Nicht-Ziele

- Keine Erweiterung von `HazardKind` oder `UtilityKind` im `@arena/bot-contract`; insbesondere
  kein "Eis rutscht"-Bewegungsmechanik-Eingriff (keine Änderung an `movement/movement.ts`).
- Keine Änderung an der Bot-API (`docs/02-bot-api.md`), am State-Builder oder an der Sandbox.
- Kein neues Terrain-Tileset und kein neues Bild-Asset; der Eis-Look entsteht ausschließlich aus
  prozeduraler Hintergrund-Textur und Tint auf einem bereits geladenen Frameset des bestehenden
  Terrain-Tilesets (siehe „Nachträgliche Korrektur" unten – nicht mehr `TERRAIN_TILES`, sondern
  wie `underground` das `STONE_TERRAIN_TILES`-Frameset).
- Hazard-Sprites bleiben unverändert (global pro `HazardKind` fix, siehe
  `hazards/registry.ts`) – die "Eiszapfen"-Interpretation von Spikehead/Stachlinger/Kugelblitz
  ist rein erzählerisch/dokumentarisch, kein neuer Tint oder neue Textur.
- Keine zweite vollständige Parallelroute wie in Level 5; Level 6 bleibt ein einzelner
  Hauptpfad mit einer optionalen kurzen Boingo-Bonus-Alkove.
- Keine Änderung an `worldBuilder.ts`, `level/tiles.ts`, `hazards/registry.ts`,
  `hazards/behaviors.ts`, `hazards/factory.ts`.
- Keine Änderung an Level 1-5 oder am Toolkit-Test-Level.
- Kein vertikales Scrollen, keine Änderung der Kamera-Logik.
- Keine Änderung der Scoring-Formel.
- Level 6 wird nicht als Default-Stage einer Turnierrunde gesetzt.

## Offene Fragen

1. **Label in der Registry:** Vorschlag `"Level 6 – Frost"` (englisch/deutsch-neutral,
   konsistent zu `"Level 3 – Night"` / `"Level 5 – Desert"`). Bitte bei Freigabe bestätigen oder
   Alternative nennen.
2. **Exakter Eisblau-Tint-Wert:** Wird als konkreter Hex-Wert erst in `design.md` festgelegt
   (Vorschlag: helles Zyan-Blau, deutlich kühler/heller als der `underground`-Tint
   `0x4a8cff`). Kein Blocker für die Requirements-Freigabe.
3. **Genaue Sekundenwerte für das Loderix-Duo/Spikehead** (`onMs`/`offMs`/Abstände in px) werden
   in `design.md` durchgerechnet und ggf. wie bei Level 5 nachträglich korrigiert, falls sich ein
   Kriterium als physikalisch/timing-technisch unerfüllbar erweist. Die obigen Akzeptanzkriterien
   sind bewusst als Verhältnis-/Invarianten-Aussagen (z.B. "genau eine der beiden aktiv")
   formuliert, nicht als feste Zahlenwerte, um diese Freiheit zu erhalten.

## Nachträgliche Korrektur (nach manueller Abnahme am Dev-Stand)

Bei der manuellen Abnahme (Task 11) hat sich gezeigt, dass ein reiner Farb-Tint auf dem
Standard-`TERRAIN_TILES`-Frameset (Gras/Erde) optisch **nicht ausreicht**: Phasers `setTint`
wirkt multiplikativ und kann eine gesättigte Grün-/Braun-Textur nur abdunkeln, nie neutralisieren
– das Terrain "sah weiterhin nach Wiese aus" statt nach Schnee/Eis, unabhängig davon, wie hell/
weiß der gewählte Tint-Wert war.

**Ursprüngliche Fassung (US-1, Nicht-Ziele):** Eis-Look ausschließlich per Tint auf dem
bestehenden `TERRAIN_TILES`-Frameset, explizit **ohne** alternatives Frameset (Abgrenzung zu
`underground`).

**Neue Fassung:** Level 6 verwendet wie `underground` das bereits vorhandene, neutral-graue
`STONE_TERRAIN_TILES`-Frameset (kein neues Bild-Asset, kein neues Tileset – dieselbe bereits
geladene `Terrain (16x16).png`-Textur, nur ein anderer Frame-Ausschnitt daraus), eingefärbt mit
einem sehr blassen, nahezu weißen Eis-Tint. Neutral-graue Ausgangsfarben nehmen einen Tint sauber
an (siehe Begründung bei `underground` in `terrainStyleRegistry.ts`), wodurch ein echter
Schnee-/Eis-Boden statt eingefärbtem Gras entsteht. Alle übrigen Anforderungen (kein neues Asset,
keine Änderung an `worldBuilder.ts`) bleiben unverändert erfüllt.
