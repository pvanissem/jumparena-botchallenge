# Design: code-station-page

## Architektur-Überblick

Einordnung in `docs/03-architektur.md`: rein clientseitig, React-Router-Route zusätzlich zu
`/dev`, `/present`, `/admin`. Keine Server-, Protokoll- oder Sandbox-Änderung.

Die heutige `DevPage` wird zu einer wiederverwendbaren, varianten-gesteuerten Seite
`ArenaPage` umgebaut (DRY, Entscheidung aus der Requirements-Freigabe):

```
App.tsx
 ├── "/"      → <Navigate to="/code" replace/>
 ├── "/code"  → CodePage  → <ArenaPage showLevelSelect={false} physicsDebug={false}/>
 ├── "/dev"   → DevPage   → <ArenaPage showLevelSelect         physicsDebug/>
 ├── "/present"
 └── "/admin"
```

## Schnittstellen & Datenmodelle

```ts
// client/src/pages/ArenaPage.tsx
export interface ArenaPageProps {
  /** Blendet die Level-Auswahl ein (Entwickler-Ansicht /dev).
   *  Ohne Auswahl läuft immer DEFAULT_LEVEL_ID (Level 1). */
  showLevelSelect?: boolean;
  /** Arcade-Physik-Debug-Overlay (Hitboxen/Velocity) durchreichen. */
  physicsDebug?: boolean;
}
export function ArenaPage(props: ArenaPageProps): JSX.Element;

// client/src/game/ArenaView.tsx – neues Prop
export interface ArenaViewProps {
  // ...
  /** Arcade-Physik-Debug-Overlay. Default `false` (Messestand-Verhalten). */
  physicsDebug?: boolean;
}
```

- `DevPage` und `CodePage` bleiben dünne Wrapper (`client/src/pages/DevPage.tsx`,
  `client/src/pages/CodePage.tsx`) — so bleiben bestehende Imports/Tests stabil und die
  Route bleibt sprechend.
- `useArenaControls` bleibt unverändert: `levelId` startet auf `DEFAULT_LEVEL_ID`. Ohne
  Level-Auswahl-UI wird `setLevelId` schlicht nie aufgerufen → US-2 ist ohne Sonderlogik
  erfüllt.
- `physicsDebug` wird in `ArenaView` nur beim Mount ausgewertet (Phaser-Game-Config), analog
  zu `levelId`/`startingLives` — kein reaktives Umschalten zur Laufzeit nötig.

## Ablauf / Sequenz

1. Nutzer öffnet `/code` → Vite/Server liefert `index.html` (SPA-Fallback greift bereits
   pfad-unabhängig, siehe `createStaticServer.ts`/`createDevServer.ts`).
2. `App.tsx` matcht `/code` → `CodePage` → `ArenaPage` ohne `showLevelSelect`.
3. `ArenaPage` rendert die Toolbar ohne `<select className="pixel-select">`.
4. `ArenaView` erzeugt `new Phaser.Game({ physics: { arcade: { debug: false } } })` und
   startet `RaceScene` mit `levelId = DEFAULT_LEVEL_ID`.

## Fehlerbehandlung & Edge Cases

- Unbekannte Level-ID kann auf `/code` nicht mehr entstehen (keine Eingabe) —
  `getLevelById` fail-fast bleibt als Sicherung bestehen.
- Der `key`-Remount-Neustart (`↻ Neu`, FinishOverlay) funktioniert unverändert, da `restart()`
  unabhängig von der Level-Auswahl ist.

## Test-Strategie

Vitest + Testing Library (`client/vitest.config.ts`, jsdom). `ArenaView` wird in den
Seiten-Tests gemockt (Phaser läuft nicht in jsdom) und gibt seine Props als `data-*`-Attribute
aus, damit `levelId`/`physicsDebug` assertierbar sind.

- `client/src/pages/CodePage.test.tsx`: keine Level-Auswahl (`pixel-select`), Modus-Umschalter
  und Neu-Button vorhanden, `ArenaView` erhält `levelId = DEFAULT_LEVEL_ID` und
  `physicsDebug = false`.
- `client/src/pages/DevPage.test.tsx`: Level-Auswahl vorhanden, `physicsDebug = true`
  (Regressions-Schutz).
- `client/src/App.test.tsx`: `/code` rendert CodePage, `/` redirected auf `/code`.
- `server/src/http/createStaticServer.test.ts`: SPA-Fallback auch für `/code`.

## Auswirkungen auf bestehenden Code

- neu: `client/src/pages/ArenaPage.tsx`, `client/src/pages/CodePage.tsx` (+ Tests)
- geändert: `client/src/pages/DevPage.tsx` (wird Wrapper), `client/src/App.tsx` (Route +
  Redirect), `client/src/game/ArenaView.tsx` (`physicsDebug`-Prop)
- unverändert: `useArenaControls`, `RaceScene`, `MatchView`, `/present`, `/admin`, Server-Code
