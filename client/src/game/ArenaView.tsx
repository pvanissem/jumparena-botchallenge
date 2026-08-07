/**
 * Mountet die Phaser-Game-Instanz mit `RaceScene` – wiederverwendbare
 * Komponente, entkoppelt von `/dev`-spezifischer UI (US-8, siehe design.md).
 */
import Phaser from "phaser";
import { useEffect, useRef } from "react";
import type { BotRunnerPauseReasonKind } from "../sandbox/BotRunner";
import { getSharedAudioContext } from "./audio/sharedAudioContext";
import { installKeyboardCaptureGuard } from "./input/keyboardCaptureGuard";
import { MOVEMENT_TUNING } from "./movement/movement";
import type { RacerRuntimeState } from "./rules/racerState";
import { RaceScene, type RaceSceneInitData } from "./scenes/RaceScene";

export interface ArenaViewStatus {
  racer: RacerRuntimeState;
  pausedReason: string | null;
  pausedReasonKind: BotRunnerPauseReasonKind | null;
  lastRuntimeError: string | null;
  consecutiveFailureCount: number;
}

export interface ArenaViewProps {
  controlMode: "keyboard" | "bot";
  /** Level-ID aus `LEVEL_REGISTRY` (siehe `level/levelRegistry.ts`). Nur
   *  beim Mount relevant (siehe Mount-Effect unten) - ein Levelwechsel
   *  während des laufenden Spiels läuft über den `key`-Remount-Mechanismus
   *  des Aufrufers (z.B. `DevPage`), nicht über einen reaktiven Effect. */
  levelId: string;
  botSourceCode?: string;
  /** Start-Leben für diesen Lauf (siehe `RaceSceneInitData.startingLives`).
   *  Nur beim (Neu-)Start eines Laufs relevant, kein Live-Umschalten
   *  während des Betriebs nötig - daher bewusst nicht Teil des reaktiven
   *  zweiten Effects unten (analog zu `controlMode` beim Mount). */
  startingLives?: number;
  onStatusChange?: (status: ArenaViewStatus) => void;
}

export function ArenaView({
  controlMode,
  levelId,
  botSourceCode,
  startingLives,
  onStatusChange,
}: ArenaViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  // Ref-Escape-Hatch: `onStatusChange` ist bei DevPage-Aufrufern typischerweise
  // eine neue Inline-Funktion pro Render. Als Effect-Dependency würde das bei
  // jedem Render das komplette Phaser.Game zerstören/neu erstellen. Der Ref
  // hält immer die aktuellste Funktion, ohne den Effect erneut auszulösen.
  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;

  // Referenz auf die laufende Szene, sobald `create()` durchgelaufen ist
  // (siehe `RaceSceneInitData.onReady`). Vor Bereitschaft eingehende
  // Moduswechsel werden gepuffert und einmalig nachgeholt, sobald die Szene
  // bereit ist (vermeidet eine Race Condition mit dem asynchronen
  // preload()/create()-Lifecycle von Phaser).
  const sceneRef = useRef<RaceScene | null>(null);
  const pendingModeRef = useRef<{ mode: "keyboard" | "bot"; botSourceCode?: string } | null>(null);
  // Cleanup-Funktion des Keyboard-Guards, der erst in `onReady` installiert
  // wird (Reihenfolge gegenüber Phasers KeyboardManager, siehe dort).
  const uninstallKeyboardGuardRef = useRef<(() => void) | null>(null);

  // Mount-Effect: Das Phaser.Game wird bewusst nur EINMAL erzeugt (leeres
  // Dependency-Array) - ein Moduswechsel (Tastatur <-> Bot) soll die Arena
  // NICHT zurücksetzen (siehe `.features/dev-station-mode/`, Rückfrage im
  // Chat). Ein echter Neustart (neues Level/frischer Racer-State) läuft
  // weiterhin über den `key`-Remount-Mechanismus in `DevPage` ("Neu starten").
  // Änderungen an controlMode/botSourceCode werden vom zweiten Effect (unten)
  // behandelt.
  // biome-ignore lint/correctness/useExhaustiveDependencies: bewusst nur beim Mount ausführen, siehe Kommentar oben
  useEffect(() => {
    if (!containerRef.current) return;

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      width: 800,
      height: 540,
      parent: containerRef.current,
      // Geteilter AudioContext über alle Neu-Mounts hinweg (siehe
      // `sharedAudioContext.ts`) - verhindert, dass jeder Level-Wechsel/
      // Neustart einen frischen, erneut zu entsperrenden AudioContext
      // erzeugt.
      audio: { context: getSharedAudioContext() },
      physics: {
        default: "arcade",
        arcade: { gravity: { x: 0, y: MOVEMENT_TUNING.GRAVITY_Y }, debug: true },
      },
      // Explizite Capture-Liste, statt implizit auf `createCursorKeys()` zu
      // vertrauen - deckt die unmodifizierten Tastendrücke ab, den Rest
      // übernimmt der Guard oben.
      input: {
        keyboard: {
          capture: [
            Phaser.Input.Keyboard.KeyCodes.LEFT,
            Phaser.Input.Keyboard.KeyCodes.RIGHT,
            Phaser.Input.Keyboard.KeyCodes.UP,
            Phaser.Input.Keyboard.KeyCodes.DOWN,
            Phaser.Input.Keyboard.KeyCodes.SPACE,
            Phaser.Input.Keyboard.KeyCodes.SHIFT,
          ],
        },
      },
      scene: [RaceScene],
    });
    gameRef.current = game;

    game.scene.start("RaceScene", {
      controllerMode: controlMode,
      levelId,
      botSourceCode,
      startingLives,
      onStatusChange: (status: Parameters<NonNullable<ArenaViewProps["onStatusChange"]>>[0]) =>
        onStatusChangeRef.current?.(status),
      onReady: () => {
        sceneRef.current = game.scene.getScene("RaceScene") as RaceScene;

        // Schluckt die Spieltasten auf DOM-Ebene (siehe
        // `.features/keyboard-input-capture/bugfix.md`). Phasers eigenes
        // Capture greift bei Modifier-Kombis wie Sprint (Shift + Pfeil) nicht.
        // Bewusst ERST hier: Der Guard muss nach Phasers KeyboardManager
        // registriert werden, sonst sieht Phaser die Events als bereits
        // `defaultPrevented` und ignoriert sie komplett.
        uninstallKeyboardGuardRef.current?.();
        uninstallKeyboardGuardRef.current = installKeyboardCaptureGuard();

        if (pendingModeRef.current) {
          sceneRef.current.setControllerMode(
            pendingModeRef.current.mode,
            pendingModeRef.current.botSourceCode
          );
          pendingModeRef.current = null;
        }
      },
    } satisfies RaceSceneInitData);

    return () => {
      uninstallKeyboardGuardRef.current?.();
      uninstallKeyboardGuardRef.current = null;
      sceneRef.current = null;
      game.destroy(true);
      gameRef.current = null;
    };
  }, []);

  // Reaktions-Effect: leitet Moduswechsel an die bereits laufende Szene
  // weiter, statt das Spiel neu zu erzeugen. Läuft absichtlich auch beim
  // allerersten Mount mit (identisch zu den initialen Werten oben) - das ist
  // unschädlich, da `setControllerMode` bei unverändertem Modus ein No-op ist.
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.setControllerMode(controlMode, botSourceCode);
    } else {
      pendingModeRef.current = { mode: controlMode, botSourceCode };
    }
  }, [controlMode, botSourceCode]);

  return <div ref={containerRef} />;
}
