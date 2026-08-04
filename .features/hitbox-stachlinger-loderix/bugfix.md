# Bugfix: Hitbox von Stachlinger und Loderix zu breit (horizontal)

## Aktuelles Verhalten (Bug)
In `client/src/game/hazards/registry.ts` sind die Hitboxen wie folgt definiert:

- `stachlinger`: `{ width: 16, height: 10, offsetX: 0, offsetY: 6 }`
  (Sprite `Traps/Spikes/Idle.png`, 16×16 px)
- `loderix`: `{ width: 12, height: 22, offsetX: 2, offsetY: 10 }`
  (Sprite `Traps/Fire/On (16x32).png`, Frame 16×32 px)

Pixel-genaue Analyse der Assets zeigt:

- Stachlinger: Die Spitzen sind oben deutlich schmaler (x≈3–11 bei y=9) als
  unten am Sockel (x≈0–14 bei y=14). Die aktuelle Hitbox nutzt aber über die
  komplette Höhe die volle Sockelbreite (0–16) → im oberen/mittleren Bereich
  der Spikes (dort, wo ein Bot seitlich vorbeiläuft) ragt die Hitbox sichtbar
  über die Spitzen hinaus.
- Loderix: Die Flamme selbst ist schmal (x≈3–12 von 16), das Kohlebecken
  darunter ist breiter (x≈0–15). Die aktuelle Hitbox (2–14) liegt zwischen
  beiden, wirkt aber im Flammenbereich (die eigentliche Gefahrenzone) immer
  noch zu breit im Vergleich zur sichtbaren Flamme.

## Erwartetes Verhalten
Die Hitboxen sollen horizontal enger an das sichtbare Asset angelehnt werden,
sodass ein Bot nicht getroffen wird, wenn er seitlich am Hindernis vorbeiläuft,
ohne die Grafik optisch zu berühren.

## Was bleibt unverändert (Regressions-Schutz)
- Höhe (`height`) und vertikaler Offset (`offsetY`) bleiben unverändert – die
  Meldung bezieht sich explizit nur auf die horizontale Ausdehnung.
- `stompable`, `behavior`, Texturen/Animationen bleiben unverändert.
- Keine Änderung an `factory.ts`/`behaviors.ts` (reine Konstanten-Anpassung in
  `registry.ts`).

## Root Cause
Die Hitbox-Breite wurde ursprünglich an der breitesten Stelle des Sprites
(Sockel bei Stachlinger, Kohlebecken bei Loderix) ausgerichtet, nicht an der
für Kollisionen relevanten schmaleren Kontur (Spitzen bzw. Flamme).

## Fix-Ansatz
Werte in `HAZARD_REGISTRY` (`client/src/game/hazards/registry.ts`) anpassen:

| Kind        | Alt (width/offsetX) | Neu (width/offsetX) |
|-------------|----------------------|----------------------|
| stachlinger | 16 / 0               | 10 / 3               |
| loderix     | 12 / 2               | 10 / 3               |

Damit verschiebt sich die Hitbox jeweils 3 px vom linken Rand nach innen und
wird 6 px schmaler (bzw. 2 px schmaler bei Loderix), bleibt aber horizontal
zentriert im 16 px breiten Sprite.
