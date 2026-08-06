# 06 – Level-Design

## Grundidee

Ein einfaches, Super-Mario-Bros-artiges 2D-Sidescroller-Level (Tilemap-basiert), das für alle
Bots eines Heats identisch ist.

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
  **Update:** Es gibt inzwischen zwei Level mit steigendem Schwierigkeitsgrad (`LEVEL_ONE`,
  `LEVEL_TWO` – siehe `.features/level-two-kaizo/`), auswählbar über eine zentrale
  `LEVEL_REGISTRY` (`client/src/game/level/levelRegistry.ts`). Level 2 ("Kaizo Light") setzt
  spürbar engere Sprungdistanzen, ein Gegner-Gauntlet sowie einen neuen Hazard (Spikehead,
  siehe `docs/08`) ein. Die Frage, ob/wie mehrere Level auch im Turniermodus (`docs/09`)
  eingesetzt werden, bleibt weiterhin offen.
- Wie wird das Level technisch erstellt (Tiled-Editor-Export als JSON, oder handgeschriebene
  Tilemap-Daten für den MVP)?
- Reicht ein einziges Level für die ganze Konferenz, oder braucht es eine "Schwierigkeitskurve"
  über den Tag hinweg?
