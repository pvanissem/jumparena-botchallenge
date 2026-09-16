# 06 – Level-Design

## Grundidee

Ein einfaches, Super-Mario-Bros-artiges 2D-Sidescroller-Level (Tilemap-basiert), das für alle
Bots eines Matches identisch ist, mit getrennten Welten je Bot.

## Besucherlevel und Strategien

`/code` verwendet das urspruengliche Level 1 (`level-one`). Die Verbesserung
des Bot-Baus veraendert weder Levelgeometrie noch die verfuegbaren Levels.

| Referenz | Gewuenschte unterscheidbare Wahl |
| --- | --- |
| Sprinter | Ziel-Fortschritt pro Zeit, kein gezielter Sammelumweg |
| Sammler | Erreichbare Fruechte pro Zusatzzeit, bis 320 px Umweg; Endspurt ab 65 s bzw. letztem Leben |
| Vorsichtiger | Geringes Risiko, grosse Landepuffer, keine explizite Stomp-Wahl |

Strategien stehen als komplette Ein-Datei-Bots unter `examples/strategies/`.
Sie bewerten angebotene Ziele/Routen statt fest codierter Levelkoordinaten.
`local-progress` garantiert keinen Weg durch unsichtbares Gelaende; auch
Zielnaehe ersetzt keinen Landungsnachweis. Versteckte Bloecke sind zunaechst
Hindernisse, keine Sammelziele. Ausgeloeste Bloecke bleiben solide; freigelegte
Fruechte werden erst dann als sichtbare Ziele beruecksichtigt.

## Nachweisgrenzen

Unit-Tests der Levelgeometrie und Strategieauswahl beweisen keine Phaser-
Erreichbarkeit. Zum Ausprobieren die bestehende Vorschau `/code` verwenden:
Bot-Datei speichern, automatischen Reload abwarten und den Lauf ansehen.
Vorhandene Versuchstraces unter `client/src/bot/runs/` helfen, die beobachtete
Routenwahl zu erklaeren. Ein einzelner Lauf ist kein allgemeiner Leistungsnachweis;
nicht ausgefuehrte Browser- und Lastpruefungen bleiben offen.
Der alte `toolkit-test` mit unerreichbarem Ziel bleibt ein Negativfall,
kein Anlass fuer einen erzwungenen blinden Sprung.

## Level-Elemente

| Element | Verhalten |
|---|---|
| **Boden/Plattformen** | Solide Tiles, Bot kann darauf laufen/springen |
| **Lücken/Abgründe** | Bot verliert ein Leben bei Absturz, Reset an Checkpoint |
| **Sichtbare Münzen** | Frei auf dem Level verteilt, werden bei Kontakt eingesammelt |
| **Versteckte Münzen (Blöcke)** | Klassische "Fragezeichen-Blöcke" – Münze wird erst sichtbar/einsammelbar, wenn der Bot den Block von unten "trifft" (also aktiv danach sucht/springt) |
| **Hazards/Gegner** | Einfache, deterministische Gegner mit festem Bewegungsmuster (z.B. auf/ab oder links/rechts patrouillierend) – bei Kontakt Lebensverlust |
| **Checkpoints** | Definierte Punkte, an denen ein Bot nach Lebensverlust respawnt (kein kompletter Neustart am Level-Anfang, um Frust/Langeweile zu vermeiden) |
| **Ziel** | Endpunkt des Levels, definiert `timeElapsedMs` bei Erreichen |

## Warum versteckte Münzen in Blöcken?

Das schafft einen echten Strategie-Trade-off für die Bot-Logik (und damit für das, was der
Nutzer devkcode "erzählt"):
- **Speed-Strategie:** Ziel direkt anlaufen, sichtbare Münzen nur "im Vorbeigehen" mitnehmen.
- **Sammel-Strategie:** Aktiv nach Blöcken suchen/springen, auch wenn das Zeit kostet.

Das macht unterschiedliche Bot-"Persönlichkeiten" sichtbar und sorgt für interessantere
Vergleiche im Leaderboard (schnellster Bot ≠ zwangsläufig Sieger).

## Level-Länge & Komplexität (Vorschlag für MVP)

- Ein Level, ca. 1–2 Bildschirmbreiten lang (nicht zu lang, damit Heats in ~60–90 Sekunden
  durchlaufen und die Wartezeit am Stand überschaubar bleibt).
- Überschaubare Anzahl an Elementen: z.B. 10–15 sichtbare Münzen, 3–5 versteckte Blockmünzen,
  2–3 einfache Gegner, 1–2 Sprung-Passagen über Abgründe.
- Kein vertikales Scrollen nötig (reines horizontales Sidescroll-Level, wie in klassischen
  Mario-Leveln) – einfacher für Kamera-/Grid-Rendering mit 16 gleichzeitigen Ansichten.

## Hazard-Verhalten (Vorschlag)

- Rein deterministisch, kein Zufall – gleiche Bedingungen für alle Bots eines Heats.
- Einfache Muster: z.B. "läuft zwischen Punkt A und B hin und her", "bewegt sich synchron zur
  globalen Uhr" (damit ein Bot theoretisch das Timing lernen/vorhersagen könnte – spannend,
  falls die KI das aus der Nutzerbeschreibung ableiten soll, z.B. "warte kurz, bevor du
  springst").

## Offene Punkte

- Soll es mehrere unterschiedliche Level geben (z.B. eines pro Heat-Runde, damit es nicht
  langweilig wird für Zuschauer), oder bewusst immer dasselbe Level für Vergleichbarkeit?
  **Update:** Es gibt inzwischen vier Level mit unterschiedlichem Schwierigkeitsgrad/Thema
  (`LEVEL_ONE`-`LEVEL_FOUR` – siehe `.features/level-two-kaizo/`,
  `.features/level-three-underground/`, `.features/level-four-underground/`), auswählbar über
  eine zentrale `LEVEL_REGISTRY` (`client/src/game/level/levelRegistry.ts`). Level 2
  ("Kaizo Light") setzt spürbar engere Sprungdistanzen, ein Gegner-Gauntlet sowie einen neuen
  Hazard (Spikehead, siehe `docs/08`) ein. Level 3 ("Night") ist an den Hindernissen von Level 2
  angelehnt, aber bewusst leichter (komfortablere Sprungdistanzen wie Level 1, keine
  Gegner-Gauntlets, entschärfte Hazard-Timings), zusätzlich mit dunklem, prozedural generiertem
  Höhlen-Hintergrund und per Tint eingefärbtem Terrain (siehe `world/backgroundRegistry.ts`,
  `world/terrainStyleRegistry.ts`).

  **Update Level 4 ("Underground", Redesign):** Das ursprünglich thematische Level wurde zu
  einem eigenständigen Layout umgebaut (siehe `.features/level-four-redesign/`). Die Decke ist
  jetzt ein echtes Spielelement mit drei unterschiedlichen Korridorhöhen: zwei Kriechgänge
  (niedrige Decke, Springen physisch wirkungslos), reguläre Passagen mit genug Kopffreiheit
  für Sprint-Sprünge, und ein hoher Boingo-Schacht mit einer schwer erreichbaren Alkove.
  Das Farbschema ist nun SMB-1-2-treu: schwarzer Hintergrund ohne Muster und blau getönte
  Stein-Tiles. Die Schwierigkeit liegt klar über Level 3 (mehr Hazards, variable Lückenbreiten)
  und deutlich unter Level 2 (keine Kaizo-Lücken, kein Kugelblitz).

  **Update Level 5 ("Desert"):** Ein neues, leicht bis mittel schweres Level mit Wüsten-Theming
  (prozeduraler Warmverlauf, Sonne, Dünen, Sandton-Terrain). Zwei strukturelle Neuheiten:
  eine zwingend per Trampolin-Kette zu überwindende Abgrund-Passage ("Großer Graben") und
  eine echte Routenwahl zwischen sicherer Bodenroute und ertragreicher, riskanter Hochroute.
  Siehe `.features/level-five-desert/`.

  **Update Level 6 ("Frost"):** Ein neues, mittelschweres Level mit Eis-/Schnee-Theming
  (prozeduraler Kaltverlauf, blasse Wintersonne, verschneite Berge, Eisblau-Terrain).
  Strukturelle Neuheit: die "Frost-Gauntlet"-Zone, in der zwei Loderix-Hazards exakt
  gegenphasig getaktet sind (zu jedem Zeitpunkt ist genau eine der beiden aktiv) und ein
  direkt anschließender Spikehead ein zusammenhängendes Timing-Puzzle bildet – Bots müssen
  beide Zeitfenster vorausschauend planen statt nur auf den nächsten Hazard zu reagieren.
  Siehe `.features/level-six-frost/`.

  **Update Stage-Level:** Im Turniermodus kann der Betreiber vor Aufstellen pro Runde
  («Stage») ein Level wählen; Runden ohne eigene Stage verwenden automatisch das Level der
  letzten konfigurierten Stage. Siehe `.features/tournament-stage-levels/` und
  `docs/09-bot-artefakt-und-turnier.md`.
- Wie wird das Level technisch erstellt (Tiled-Editor-Export als JSON, oder handgeschriebene
  Tilemap-Daten für den MVP)?
- Reicht ein einziges Level für die ganze Konferenz, oder braucht es eine "Schwierigkeitskurve"
  über den Tag hinweg?
  **Update:** Durch Stage-Level wird die Schwierigkeitskurve manuell konfigurierbar; der
  Betreiber wählt je Runde ein Level. Es gibt keine automatische Empfehlung.
