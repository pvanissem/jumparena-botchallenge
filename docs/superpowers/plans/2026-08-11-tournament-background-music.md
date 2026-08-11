# Tournament Background Music Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/present` spielt über eine persistente Phaser-Audio-Scene `end.mp3` in Intermissions und rundenabhängige Musik während laufender Matches.

**Architecture:** Eine pure Selektor-Funktion bestimmt den Track aus Tournament- und Show-State. Ein persistentes, headless Phaser-Game besitzt die Musik unabhängig vom kurzlebigen Match-Canvas; `MatchBootScene` lädt weiter die Arena-Assets, startet aber keine zweite Hintergrundmusik.

**Tech Stack:** React 18, TypeScript, Phaser 3, Vitest, Testing Library

## Global Constraints

- Ausschließlich `/present` erhält die neue Turniermusik; `/admin` und `/dev` bleiben unverändert.
- Alle Tracks laufen geloopt und verwenden `audioSettings` sowie `getSharedAudioContext()`.
- `boingo.mp3` und `complete.mp3` bleiben als einmalige Show-Cues erhalten.
- Keine Crossfades, Beat-Synchronisation oder Server-Protokolländerungen.
- Produktivcode entsteht ausschließlich nach einem passenden fehlgeschlagenen Test.

---

### Task 1: Trackauswahl und Asset-Registry

**Files:**
- Create: `client/src/game/audio/tournamentMusic.ts`
- Create: `client/src/game/audio/tournamentMusic.test.ts`
- Modify: `client/src/game/assets/audio.ts`

**Interfaces:**
- Consumes: `TournamentState`, `TournamentShowState` aus `@arena/shared`.
- Produces: `type TournamentMusicKey` und `selectTournamentMusicKey(tournament, show): TournamentMusicKey | null`.

- [ ] **Step 1: Failing Tests für Musikzuordnung schreiben**

Die Tabelle muss `null` ohne gestarteten Turnierkontext, `end` in jeder Nicht-Live-Phase sowie
`theme`, `theme2`, `theme3`, `epic` anhand von `rounds.length - 1 - activeRoundIndex` prüfen.

```ts
expect(selectTournamentMusicKey(tournamentWithRounds(4), runningAt(0))).toBe(AUDIO_KEYS.THEME);
expect(selectTournamentMusicKey(tournamentWithRounds(4), runningAt(1))).toBe(AUDIO_KEYS.THEME_2);
expect(selectTournamentMusicKey(tournamentWithRounds(4), runningAt(2))).toBe(AUDIO_KEYS.THEME_3);
expect(selectTournamentMusicKey(tournamentWithRounds(4), runningAt(3))).toBe(AUDIO_KEYS.EPIC);
expect(selectTournamentMusicKey(tournamentWithRounds(4), showAt("match-result"))).toBe(
  AUDIO_KEYS.END
);
```

- [ ] **Step 2: Red verifizieren**

Run: `npm test -w @arena/client -- src/game/audio/tournamentMusic.test.ts`

Expected: FAIL, weil `tournamentMusic.ts` und die neuen Keys fehlen.

- [ ] **Step 3: Registry und pure Auswahl minimal implementieren**

`AUDIO_KEYS` erhält `THEME_2`, `THEME_3`, `EPIC`, `END`; `AUDIO_SPECS` erhält die vier vorhandenen
MP3-Pfade. `selectTournamentMusicKey` liefert außerhalb von `match-running` bei vorhandenem Show-
und Turnier-State `END`; laufende Matches nutzen die Distanz-Tabelle und fallen bei ungültigem
`activeRoundIndex` auf `THEME` zurück.

- [ ] **Step 4: Green verifizieren**

Run: `npm test -w @arena/client -- src/game/audio/tournamentMusic.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/game/assets/audio.ts client/src/game/audio/tournamentMusic.ts client/src/game/audio/tournamentMusic.test.ts
git commit -m "feat(audio): select tournament music by round"
```

---

### Task 2: Persistente Phaser-Musiksteuerung

**Files:**
- Create: `client/src/game/audio/TournamentMusicScene.ts`
- Create: `client/src/game/audio/TournamentMusicScene.test.ts`
- Create: `client/src/game/audio/useTournamentMusic.ts`
- Create: `client/src/game/audio/useTournamentMusic.test.ts`

**Interfaces:**
- Consumes: `TournamentMusicKey`, `audioSettings`, `getSharedAudioContext()`.
- Produces: `TournamentMusicScene#setTrack(key: TournamentMusicKey | null): void` und `useTournamentMusic(tournament, show): void`.

- [ ] **Step 1: Failing Scene-Lifecycle-Tests schreiben**

Mit schmalen Sound-Doubles wird geprüft: erster Track startet geloopt, derselbe Key startet nicht
erneut, ein anderer Key stoppt den alten Sound, Volume/Mute setzt `setVolume`, `null` stoppt Musik,
und `shutdown()` meldet sich vom Store ab.

```ts
scene.setTrack(AUDIO_KEYS.END);
scene.setTrack(AUDIO_KEYS.END);
expect(sound.add).toHaveBeenCalledTimes(1);
scene.setTrack(AUDIO_KEYS.EPIC);
expect(endSound.stop).toHaveBeenCalledOnce();
expect(epicSound.play).toHaveBeenCalledOnce();
```

- [ ] **Step 2: Red verifizieren**

Run: `npm test -w @arena/client -- src/game/audio/TournamentMusicScene.test.ts`

Expected: FAIL, weil die Scene fehlt.

- [ ] **Step 3: Scene minimal implementieren**

Die Scene lädt nur die fünf Musik-Specs, puffert den gewünschten Key vor `create()`, wartet bei
gesperrtem Phaser-Sound auf `UNLOCKED`, besitzt höchstens einen `BaseSound` und synchronisiert
`audioSettings.getEffectiveVolume()` ohne Trackneustart.

- [ ] **Step 4: Scene-Tests grün ausführen**

Run: `npm test -w @arena/client -- src/game/audio/TournamentMusicScene.test.ts`

Expected: PASS.

- [ ] **Step 5: Failing Hook-Test schreiben**

Die Phaser-Game-Erzeugung wird als injizierbare Factory getestet: genau eine Instanz pro Mount,
Trackweitergabe bei fachlichem Wechsel und `destroy(true)` beim Unmount.

```ts
const { rerender, unmount } = renderHook(({ show }) => useTournamentMusic(tournament, show, factory));
rerender({ show: runningAt(finalRound) });
expect(scene.setTrack).toHaveBeenLastCalledWith(AUDIO_KEYS.EPIC);
unmount();
expect(game.destroy).toHaveBeenCalledWith(true);
```

- [ ] **Step 6: Red verifizieren**

Run: `npm test -w @arena/client -- src/game/audio/useTournamentMusic.test.ts`

Expected: FAIL, weil der Hook fehlt.

- [ ] **Step 7: Hook minimal implementieren**

Beim Mount wird ein `Phaser.Game` mit `type: Phaser.HEADLESS`, `scene: [scene]` und
`audio.context: getSharedAudioContext()` erstellt. Ein separater Effect ruft für den selektierten
Key `scene.setTrack()` auf. Cleanup zerstört das Game.

- [ ] **Step 8: Task-Tests gemeinsam ausführen**

Run: `npm test -w @arena/client -- src/game/audio/TournamentMusicScene.test.ts src/game/audio/useTournamentMusic.test.ts`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add client/src/game/audio/TournamentMusicScene.ts client/src/game/audio/TournamentMusicScene.test.ts client/src/game/audio/useTournamentMusic.ts client/src/game/audio/useTournamentMusic.test.ts
git commit -m "feat(audio): add persistent Phaser tournament music"
```

---

### Task 3: `/present` integrieren und doppelte Match-Musik entfernen

**Files:**
- Modify: `client/src/pages/PresentPage.tsx`
- Modify: `client/src/pages/PresentPage.test.tsx`
- Modify: `client/src/match/MatchBootScene.ts`
- Create: `client/src/match/MatchBootScene.test.ts`

**Interfaces:**
- Consumes: `useTournamentMusic(tournament, show)` aus Task 2.
- Produces: genau einen Hintergrundmusik-Besitzer im Turniermodus.

- [ ] **Step 1: Failing Present-Integrationstest schreiben**

`useTournamentMusic` wird am externen Audio-Rand gemockt; der Test prüft, dass `PresentPage` den
aktuellen Tournament- und Show-State an den Hook übergibt.

```ts
expect(useTournamentMusic).toHaveBeenCalledWith(tournament, show);
```

- [ ] **Step 2: Failing MatchBoot-Regressionstest schreiben**

Der Test ruft `create()` mit Phaser-Doubles auf und beweist, dass `MATCH_ASSETS_READY` emittiert wird,
aber weder `sound.add` noch `sound.play` für Hintergrundmusik aufgerufen werden.

- [ ] **Step 3: Red verifizieren**

Run: `npm test -w @arena/client -- src/pages/PresentPage.test.tsx src/match/MatchBootScene.test.ts`

Expected: FAIL wegen fehlender Hook-Integration und aktueller MatchBoot-Musik.

- [ ] **Step 4: Minimal integrieren**

`PresentPage` ruft den Hook nach dem Laden von Tournament/Show auf. Aus `MatchBootScene` werden nur
Musikzustand, Audio-Settings-Abonnement und Start/Stop-Methoden entfernt; Asset-Preload,
`assetsReady` und `MATCH_ASSETS_READY` bleiben unverändert.

- [ ] **Step 5: Green und Regressionen verifizieren**

Run: `npm test -w @arena/client -- src/pages/PresentPage.test.tsx src/match/MatchBootScene.test.ts`

Expected: PASS.

- [ ] **Step 6: Vollständige Verifikation**

```bash
npm test -w @arena/client
npm run build -w @arena/client
npx biome check client/src/game/assets/audio.ts client/src/game/audio/tournamentMusic.ts client/src/game/audio/tournamentMusic.test.ts client/src/game/audio/TournamentMusicScene.ts client/src/game/audio/TournamentMusicScene.test.ts client/src/game/audio/useTournamentMusic.ts client/src/game/audio/useTournamentMusic.test.ts client/src/pages/PresentPage.tsx client/src/pages/PresentPage.test.tsx client/src/match/MatchBootScene.ts client/src/match/MatchBootScene.test.ts
```

Expected: alle Tests, TypeScript-Build und Biome-Checks erfolgreich.

- [ ] **Step 7: Manueller Browser-Test**

Auf `/present` nacheinander Intermission, laufendes Match, Ergebnis und eine spätere Runde prüfen.
Browser-Konsole muss ohne neue Audio-/Assetfehler bleiben; pro Phase darf nur ein Hintergrundtrack
laufen.

- [ ] **Step 8: Commit**

```bash
git add client/src/pages/PresentPage.tsx client/src/pages/PresentPage.test.tsx client/src/match/MatchBootScene.ts client/src/match/MatchBootScene.test.ts
git commit -m "feat(present): switch tournament music by show phase"
```
