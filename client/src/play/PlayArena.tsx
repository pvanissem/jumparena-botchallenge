/**
 * Phaser-Host des `/play`-Modus – siehe `.features/play-mode/design.md`,
 * Abschnitt "Phaser-Host". EIN Game/Canvas für beide Stationen; die einzelnen
 * Racer-Szenen verwaltet `StationSceneHost` (Muster: `MatchView`).
 */
import Phaser from "phaser";
import { useEffect, useRef } from "react";
import { getSharedAudioContext } from "../game/audio/sharedAudioContext";
import { MOVEMENT_TUNING } from "../game/movement/movement";
import { PlayBootScene } from "./PlayBootScene";

interface PlayArenaProps {
  /** Wird einmalig mit der erzeugten Phaser-Instanz aufgerufen. */
  onReady: (game: Phaser.Game) => void;
  className?: string;
}

export function PlayArena({ onReady, className }: PlayArenaProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: container,
      width: container.clientWidth || 1280,
      height: container.clientHeight || 640,
      backgroundColor: "#0f1020",
      // Geteilter AudioContext über alle Mounts hinweg (siehe
      // `sharedAudioContext.ts`).
      audio: { context: getSharedAudioContext() },
      physics: {
        default: "arcade",
        // Anders als `/dev`: Am Messestand wird gespielt, nicht debuggt.
        arcade: { gravity: { x: 0, y: MOVEMENT_TUNING.GRAVITY_Y }, debug: false },
      },
      scene: [PlayBootScene],
    });

    onReadyRef.current(game);

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            if (container.clientWidth > 0 && container.clientHeight > 0) {
              game.scale?.resize(container.clientWidth, container.clientHeight);
            }
          });
    resizeObserver?.observe(container);

    return () => {
      resizeObserver?.disconnect();
      game.destroy(true);
    };
  }, []);

  return <div ref={containerRef} className={className} />;
}
