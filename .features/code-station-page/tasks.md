# Tasks: code-station-page

- [x] 1. Test für `physicsDebug`-Prop an `ArenaView` (rot) (Bezug: US-3, Design
      "Schnittstellen")
      Seiten-Tests mit gemocktem `ArenaView`, der seine Props als `data-*` ausgibt.
- [x] 2. `physicsDebug`-Prop in `ArenaView` implementieren (grün) (Bezug: US-3)
      Default `false`, wird in die Phaser-Arcade-Config gereicht.
- [x] 3. Test für `ArenaPage`/`CodePage` ohne Level-Auswahl (rot) (Bezug: US-2)
      `client/src/pages/CodePage.test.tsx`: kein `.pixel-select`, `levelId` =
      `DEFAULT_LEVEL_ID`, `physicsDebug=false`; Toolbar-Rest vorhanden.
- [x] 4. Test für `DevPage` als Regressions-Schutz (rot) (Bezug: US-1)
      Level-Auswahl vorhanden, `physicsDebug=true`.
- [x] 5. `ArenaPage` extrahieren, `DevPage`/`CodePage` als Wrapper (grün) (Bezug: US-1, US-2,
      Design "Architektur-Überblick")
- [x] 6. Routing-Test `/code` + Redirect `/` → `/code` (rot) und `App.tsx` anpassen (grün)
      (Bezug: US-1, Geklärte Fragen)
- [x] 7. Server-SPA-Fallback-Test für `/code` (rot/grün) (Bezug: US-1)
      `server/src/http/createStaticServer.test.ts` erweitern.
- [x] 8. Refactor + Gesamtlauf: Lint/Typecheck/Tests grün, Abgleich gegen
      `requirements.md`.
