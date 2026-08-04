/**
 * Mountet die Phaser-Game-Instanz mit `RaceScene` – wiederverwendbare
 * Komponente, entkoppelt von `/dev`-spezifischer UI (US-8, siehe design.md).
 */
import Phaser from "phaser";
import { useEffect, useRef } from "react";
import type { RacerRuntimeState } from "./rules/racerState";
import { RaceScene } from "./scenes/RaceScene";

export interface ArenaViewProps {
  controlMode: "keyboard" | "bot";
  botSourceCode?: string;
  onStatusChange?: (status: { racer: RacerRuntimeState; pausedReason: string | null }) => void;
}

export function ArenaView({ controlMode, botSourceCode, onStatusChange }: ArenaViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  // Ref-Escape-Hatch: `onStatusChange` ist bei DevPage-Aufrufern typischerweise
  // eine neue Inline-Funktion pro Render. Als Effect-Dependency würde das bei
  // jedem Render das komplette Phaser.Game zerstören/neu erstellen. Der Ref
  // hält immer die aktuellste Funktion, ohne den Effect erneut auszulösen.
  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;

  useEffect(() => {
    if (!containerRef.current) return;

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      width: 800,
      height: 540,
      parent: containerRef.current,
      physics: { default: "arcade", arcade: { gravity: { x: 0, y: 900 }, debug: false } },
      scene: [RaceScene],
    });
    gameRef.current = game;

    game.scene.start("RaceScene", {
      controllerMode: controlMode,
      botSourceCode,
      onStatusChange: (status: Parameters<NonNullable<ArenaViewProps["onStatusChange"]>>[0]) =>
        onStatusChangeRef.current?.(status),
    });

    return () => {
      game.destroy(true);
      gameRef.current = null;
    };
  }, [controlMode, botSourceCode]);

  return <div ref={containerRef} />;
}
