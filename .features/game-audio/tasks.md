# Tasks: Game-Audio (Hintergrundmusik + Jump/Collect-SFX + Lautstärke-UI)

Bezug: `requirements.md` (US-1 bis US-5), `design.md`. Arbeitsweise: strikt
Rot-Grün-Refactor (siehe `AGENTS.md`) – jeder Task mit fachlicher Logik beginnt
mit einem fehlschlagenden Test.

## 0. Assets & Registry

- [x] 0.1 Audio-Assets prüfen/verschieben (Bezug: Design "Repo-/Modulstruktur")
      Sicherstellen, dass `client/public/assets/Audio/{theme,jump,collect}.mp3`
      vorhanden sind (bereits der Fall). Kein Code, kein Test nötig.
- [x] 0.2 `game/assets/audio.ts` implementieren (Bezug: Design "assets/audio.ts")
      `AUDIO_KEYS`, `AudioKey`-Type, `AUDIO_SPECS` analog zu
      `STATIC_IMAGE_SPECS` in `spriteSheets.ts`. Reine Konstanten-Deklaration,
      kein Test nötig (Konsistenz mit bestehender Konvention).

## 1. Purer Audio-Settings-Store (US-4 Grundlage)

- [x] 1.1 Test: Default-State ohne `localStorage`-Eintrag (Bezug: US-4,
      Design "audioSettings.ts")
      `createAudioSettingsStore(mockStorage)` liefert `{ muted: false, volume: 0.6 }`,
      wenn `mockStorage.getItem` `null` zurückgibt (rot, Modul existiert noch nicht).
- [x] 1.2 `audioSettings.ts` Grundgerüst implementieren (grün)
      `AudioSettingsState`, `AudioSettingsStore`-Interface,
      `createAudioSettingsStore` mit `getState`, Default-Storage-Parameter
      (`safeLocalStorage()`-Helper, der `window.localStorage` defensiv liefert
      oder `null`). Test aus 1.1 grün.
- [x] 1.3 Test: `setVolume` clamped auf `[0,1]` (Bezug: US-4 AC4)
      Werte `-0.5` → `0`, `1.5` → `1`, `0.3` → `0.3` (rot).
- [x] 1.4 `setVolume` implementieren (grün)
- [x] 1.5 Test: `setMuted`/`toggleMute` verändern `muted` korrekt (Bezug: US-4
      AC2/AC3) (rot)
- [x] 1.6 `setMuted`/`toggleMute` implementieren (grün)
- [x] 1.7 Test: `getEffectiveVolume()` liefert `0` bei `muted`, sonst `volume`
      (Bezug: US-1 AC2, US-4 AC2/AC3) (rot)
- [x] 1.8 `getEffectiveVolume` implementieren (grün)
- [x] 1.9 Test: `subscribe`-Listener wird bei jeder Änderung genau einmal
      aufgerufen; zurückgegebene `unsubscribe`-Funktion stoppt weitere Aufrufe
      (Bezug: US-1 AC2) (rot)
- [x] 1.10 `subscribe`/Notify-Mechanismus implementieren (grün)
- [x] 1.11 Test: Persistenz – nach `setVolume`/`setMuted` steht der Wert unter
      `STORAGE_KEY` im übergebenen Mock-Storage; eine zweite, mit demselben
      Mock-Storage erzeugte Instanz liest ihn zurück (Bezug: US-4 AC5/AC6) (rot)
- [x] 1.12 Persistenz (Lesen beim Erzeugen + Schreiben bei jeder Änderung)
      implementieren (grün)
- [x] 1.13 Test: Mock-Storage, dessen `getItem`/`setItem` wirft → Store bleibt
      funktionsfähig, wirft selbst nicht (Bezug: Design "Fehlerbehandlung")
      (rot)
- [x] 1.14 Defensive try/catch um Storage-Zugriffe ergänzen (grün)
- [x] 1.15 `export const audioSettings = createAudioSettingsStore();` als
      Default-Singleton-Instanz ergänzen (kein zusätzlicher Test – reine
      Instanziierung).

## 2. React-Anbindung des Stores (US-4 UI-Grundlage)

- [x] 2.1 `useAudioSettings.ts` implementieren (Bezug: Design
      "useAudioSettings.ts")
      `useSyncExternalStore(audioSettings.subscribe, audioSettings.getState)`
      + `setVolume`/`toggleMute`-Passthrough. Dünner Adapter ohne eigene
      Logik – kein separater Unit-Test nötig (Verhalten wird über
      `AudioControls.test.tsx` in 3. abgedeckt).

## 3. `AudioControls`-Komponente (US-4)

- [x] 3.1 Test: Klick auf Mute-Button togglet den Store (Bezug: US-4 AC2/AC3)
      Mit `render(<AudioControls />)`, `fireEvent.click` auf den Button,
      Assertion auf `audioSettings.getState().muted` (rot, Komponente
      existiert noch nicht). Store vor/nach jedem Test über
      `createAudioSettingsStore`-Testinstanz oder Reset-Aufruf isolieren.
- [x] 3.2 `AudioControls.tsx` Grundgerüst + Mute-Button implementieren (grün)
- [x] 3.3 Test: Slider-Änderung ruft `setVolume` mit normalisiertem Wert
      (0..1) auf (Bezug: US-4 AC4) (rot)
- [x] 3.4 Slider implementieren (grün)
- [x] 3.5 Test: Komponente zeigt externe Store-Änderung korrekt an (Bezug:
      US-4 AC1) – Store extern ändern, Re-Render prüft aktualisierten
      Slider-Wert/Button-Label (rot)
- [x] 3.6 Sicherstellen, dass `useSyncExternalStore`-Anbindung dies bereits
      erfüllt (i.d.R. grün ohne Zusatzcode, ggf. Feinschliff).

## 4. Shared Message-Typ `audio-settings` (US-5 Grundlage)

- [x] 4.1 Test: `isAudioSettingsMessage` true/false-Fälle (Bezug: US-5 AC1,
      Design "messages.ts Änderungen", analog zu
      `isPingBroadcastMessage`-Tests) (rot)
- [x] 4.2 `AudioSettingsMessage`-Interface, Union-Erweiterung
      (`InboundMessage`/`OutboundMessage`), `isAudioSettingsMessage`
      implementieren (grün)

## 5. Server-Relay verallgemeinern (US-5 AC2)

- [x] 5.1 Bestehenden Test `handlePingBroadcast.test.ts` nach
      `createBroadcastRelayHandler.test.ts` verschieben, Funktionsnamen im
      Test auf `createBroadcastRelayHandler` anpassen (Bezug: Design
      "Server-Wiring") – muss weiterhin grün sein (reines Rename, keine neue
      Fachlogik, siehe `AGENTS.md` Ausnahme "Bugfix/triviale Änderung" nur für
      den Rename-Schritt selbst; der Test bleibt inhaltlich identisch).
- [x] 5.2 `handlePingBroadcast.ts` nach `createBroadcastRelayHandler.ts`
      umbenennen, Funktion generisch auf `<T extends InboundMessage>`
      umstellen (grün, Test aus 5.1 bestätigt unverändertes Verhalten).
- [x] 5.3 Test: `parseInboundMessage` erkennt eine gültige
      `audio-settings`-Payload (Bezug: US-5 AC1, Design
      "Fehlerbehandlung/Server-Wiring") (rot)
- [x] 5.4 `parseMessage.ts` um `isAudioSettingsMessage`-Zweig ergänzen (grün)
- [x] 5.5 `server/src/index.ts` anpassen: Import auf
      `createBroadcastRelayHandler` umstellen, zusätzliche Registrierung
      `dispatcher.register("audio-settings", createBroadcastRelayHandler(broadcastRouter))`
      (Bezug: US-5 AC2). Kein neuer Test nötig (reine Wiring-Zeile, bestehende
      Server-Tests bleiben grün – Bezug: Design "Test-Strategie").

## 6. RaceScene-Wiring (US-1, US-2, US-3 – manuell verifiziert)

- [x] 6.1 `preload()`: `AUDIO_SPECS` laden (Bezug: US-1/US-2/US-3, Design
      "RaceScene.ts Änderungen").
- [x] 6.2 `create()`: `this.music` mit Loop erzeugen, `applyAudioVolume()`
      aufrufen, abspielen, `audioSettings.subscribe(...)` registrieren und
      Unsubscribe-Funktion in `this.unsubscribeAudio` merken (Bezug: US-1
      AC1/AC2).
- [x] 6.3 Private Helper `applyAudioVolume()` und `playSfx(key: AudioKey)`
      implementieren (Bezug: Design "RaceScene.ts Änderungen").
- [x] 6.4 Sprung-SFX in `applyKeyboardInput` beim `jump && onGround`-Zweig
      ergänzen (Bezug: US-2 AC1/AC3).
- [x] 6.5 Sprung-SFX in `applyBotAction` beim
      `action === "jump" && onGround`-Zweig ergänzen (Bezug: US-2 AC2/AC3).
- [x] 6.6 Collect-SFX in `onCoinOverlap` ergänzen (Bezug: US-3 AC1/AC2).
- [x] 6.7 `shutdown()`: `this.music?.stop()` und `this.unsubscribeAudio?.()`
      ergänzen (Bezug: US-1 AC3).
- [x] 6.8 Manuelle Verifikation auf `/dev` (Bezug: Design "Test-Strategie"):
      Musik-Loop hörbar beim Start, kein erneuter Sprung-Sound bei gehaltener
      Sprung-Taste in der Luft, Collect-Sound bei regulärer und aus Block
      ausgelöster Münze, Lautstärke/Mute wirken live ohne Szenen-Neustart.

## 7. UI-Einbindung (US-4)

- [x] 7.1 `<AudioControls />` in `DevPage.tsx` einbinden (Bezug: US-4 AC1).
- [x] 7.2 `<AudioControls />` in `AdminPage.tsx` einbinden (Bezug: US-4 AC1).

## 8. Admin→Present Sync (US-5)

- [x] 8.1 `AdminPage.tsx`: `useEffect` ergänzen, der `audioSettings.subscribe`
      abonniert und bei jeder Änderung
      `send({ type: "audio-settings", ...audioSettings.getState() })` sendet
      (Bezug: US-5 AC1, Design "AudioControls.tsx"-Abschnitt "Wiring über
      AdminPage").
- [x] 8.2 `PresentPage.tsx`: eingehende `audio-settings`-Nachrichten
      (`lastMessage` aus `useWebSocketConnection`) per `useEffect` in
      `audioSettings.setMuted`/`setVolume` übernehmen (Bezug: US-5 AC3).
- [x] 8.3 Manuelle Verifikation: zwei Browser-Tabs (`/admin` und `/present`)
      öffnen, Mute/Slider in Admin ändern, Übernahme in Present-Tab prüfen
      (kein Ton nötig, nur Store-Zustand/UI-Reflektion, sofern sichtbar).

## 9. Abschluss

- [x] 9.1 Vollständigen Testlauf ausführen: `client`, `packages/shared`,
      `server` (`npm test` je Package) – alle grün.
- [x] 9.2 Abgleich mit `requirements.md`: alle Akzeptanzkriterien (US-1 bis
      US-5) durchgehen und bestätigen, dass sie erfüllt sind.
