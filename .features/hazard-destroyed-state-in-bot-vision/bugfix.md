# Bugfix: Gestompte Ninjafrogs (und andere gestompte Hazards) bleiben im Bot-State sichtbar

## Aktuelles Verhalten (Bug)
Wird ein `stompable`-Hazard (aktuell nur `ninjafrog`, siehe
`client/src/game/hazards/registry.ts`) von einem Racer gestompt, passiert in
`RaceScene.onHazardOverlap` (`client/src/game/scenes/RaceScene.ts:722-745`)
Folgendes:

```ts
if (contact === "stomped") {
  body.setVelocityY(STOMP_BOUNCE_VELOCITY);
  this.playVanishEffect(hazard.x, hazard.y);
  hazard.destroy();               // Zeile 734
  this.playSfx(AUDIO_KEYS.DAMAGED);
  return;
}
```

`hazard.destroy()` entfernt nur das **Phaser-Sprite** aus der Szene/Physics-Group.
Der zugehörige `HazardInstanceDef`-Eintrag in `this.level.hazards` (statische,
beim Level-Laden einmal erzeugte Liste) bleibt unverändert bestehen.

`RaceScene.buildSnapshot()` (`client/src/game/scenes/RaceScene.ts:441-483`) baut
`WorldSnapshot.hazards` aber genau aus dieser statischen Liste:

```ts
hazards: this.level.hazards.map((h) => {
  ...
  return {
    id: h.id,
    kind: h.kind,
    x: pos,
    y,
    active: dynamic.activeHazardIds.has(h.id),   // Zeile 475
    warning: this.isHazardWarning(h),
    vx: velocity.vx,
    vy: velocity.vy,
  };
}),
```

`dynamic.activeHazardIds` (`buildDynamicTileState`, `client/src/game/level/tiles.ts:34-49`)
ist ausschließlich für **zeitbasierte** An/Aus-Hazards (`loderix`, `spikehead`)
gedacht (`isHazardActive`, `tiles.ts:52-63`). Für `ninjafrog` – keinen
zeitbasierten Hazard – liefert dieses Set unabhängig vom Stomp-Zustand
weiterhin `active: true`.

`botStateBuilder.buildBotState` (`client/src/game/state/botStateBuilder.ts:67-80`)
übernimmt `snapshot.hazards` unverändert (nur gefiltert nach Sichtradius via
`toVisibleList`/`withinViewRadius`), ohne zu prüfen, ob der Hazard tatsächlich
noch existiert:

```ts
const hazards = toVisibleList(
  position,
  snapshot.hazards,
  (hazard, dx, dy): VisibleHazard => ({
    dx, dy,
    kind: hazard.kind,
    active: hazard.active,   // bleibt true, auch nach dem Stomp
    warning: hazard.warning,
    stompable: HAZARD_REGISTRY[hazard.kind].stompable,
    vx: hazard.vx ?? 0,
    vy: hazard.vy ?? 0,
  })
);
```

**Konsequenz:** Ein Bot sieht ein bereits gestomptes Ninjafrog (visuell längst
verschwunden) dauerhaft weiter als `active: true` in `state.hazards`, solange
es im Sichtradius liegt – der Bot reagiert also fälschlich auf einen nicht
mehr existenten Gegner.

## Erwartetes Verhalten
WENN ein `stompable`-Hazard (z. B. `ninjafrog`) gestompt wird,
SOLL DAS SYSTEM diesen Hazard ab sofort in keinem folgenden `WorldSnapshot`
bzw. Bot-`state.hazards` mehr als sichtbares/aktives Objekt melden – analog
zum bestehenden Muster für eingesammelte Coins (`racer.collectedCoinIds`,
gefiltert in `RaceScene.buildSnapshot()` Zeile 464).

## Was bleibt unverändert (Regressions-Schutz)
- Zeitbasierte Hazards (`loderix`, `spikehead`) und ihr `activeHazardIds`
  On/Off-Verhalten (`isHazardActive`, `tiles.ts`) bleiben unangetastet.
- Das visuelle Stomp-Verhalten (`STOMP_BOUNCE_VELOCITY`, `playVanishEffect`,
  `hazard.destroy()`, SFX) bleibt unverändert.
- `HAZARD_REGISTRY`/`stompable`-Flag bleibt unverändert.
- Nicht-gestompte bzw. nicht-`stompable` Hazards verhalten sich exakt wie
  bisher.
- Kein Effekt auf Coins/Utilities-Handling.

## Root Cause
`hazard.destroy()` in `RaceScene.onHazardOverlap` mutiert nur den
Laufzeit-Sprite-Zustand von Phaser, nicht aber das racer-/level-bezogene
Datenmodell (`RacerRuntimeState` bzw. `level.hazards`), aus dem
`buildSnapshot()` liest. Es existiert kein Set/Flag, das gestompte Hazard-IDs
persistiert – im Gegensatz zu `collectedCoinIds`, das genau dieses Muster für
Coins bereits korrekt implementiert.

## Fix-Ansatz
1. `RacerRuntimeState` (`client/src/game/rules/racerState.ts:16ff.`) um ein
   neues Feld erweitern, analog zu `collectedCoinIds`:
   ```ts
   destroyedHazardIds: ReadonlySet<string>;
   ```
   inkl. Initialisierung als leeres `Set<string>()` im Default-State
   (`racerState.ts:59ff.`).
2. In `RaceScene.onHazardOverlap` im `contact === "stomped"`-Zweig
   (`RaceScene.ts:730-736`) zusätzlich zu `hazard.destroy()` die Hazard-ID in
   `this.racer.destroyedHazardIds` aufnehmen (Set ist `readonly` typisiert,
   Racer-State wird wie bei `collectedCoinIds` über eine neue Menge ersetzt
   bzw. per mutablem internen Set gepflegt – Umsetzung entsprechend dem
   bestehenden Muster für `collectedCoinIds`, siehe
   `RaceScene.ts:635`/Coin-Collect-Stelle).
3. `RaceScene.buildSnapshot()` (Zeile 466) analog zum Coins-Filter
   (Zeile 464) erweitern:
   ```ts
   hazards: this.level.hazards
     .filter((h) => !this.racer.destroyedHazardIds.has(h.id))
     .map((h) => { ... }),
   ```
4. Kein Fix in `botStateBuilder.ts` nötig, da dieser bereits korrekt nur
   `snapshot.hazards` konsumiert – sobald zerstörte Hazards dort nicht mehr
   auftauchen, verschwinden sie automatisch auch aus `state.hazards` für den
   Bot.
5. Test-Erwartung (TDD, siehe AGENTS.md): Neuer/angepasster Test in
   `botStateBuilder.test.ts` bzw. ein Szenen-/Snapshot-Test, der sicherstellt,
   dass ein Hazard mit ID in `racer.destroyedHazardIds` nicht mehr in
   `snapshot.hazards`/`state.hazards` erscheint, auch wenn er innerhalb des
   Sichtradius liegt.
