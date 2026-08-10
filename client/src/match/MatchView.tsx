import type { MatchDef, MatchProgressMessage, MatchResult } from "@arena/shared";
import Phaser from "phaser";
import { useEffect, useRef, useState } from "react";
import { RacerTileOverlay } from "../components/RacerTileOverlay";
import { MatchBootScene } from "./MatchBootScene";
import { MatchRunner, type MatchTiles } from "./MatchRunner";
import { computeTileOverlays } from "./tileOverlays";

interface MatchViewProps {
  match: MatchDef;
  levelId: string;
  livesPerRun: number;
  sourceById: ReadonlyMap<string, string>;
  onProgress: (entries: MatchProgressMessage["entries"]) => void;
  onFinished: (result: MatchResult) => void;
  className?: string;
}

/**
 * Phaser-Host für `/present`. Zeigt alle Racer eines Matches in einem Grid an.
 * Die Hintergrundmusik und das einmalige Laden der Assets verantwortet
 * `MatchBootScene`; die einzelnen Racer-Szenen laufen stumm (siehe
 * `MatchRunner`).
 */
export function MatchView({
  match,
  levelId,
  livesPerRun,
  sourceById,
  onProgress,
  onFinished,
  className,
}: MatchViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const runnerRef = useRef<MatchRunner | null>(null);
  const [tiles, setTiles] = useState<MatchTiles | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: container,
      width: container.clientWidth || 960,
      height: container.clientHeight || 540,
      backgroundColor: "#1a1a26",
      physics: {
        default: "arcade",
        arcade: {
          gravity: { x: 0, y: 900 },
          debug: false,
        },
      },
      scene: [MatchBootScene],
    });

    gameRef.current = game;

    const resizeObserver = new ResizeObserver(() => {
      if (container.clientWidth > 0 && container.clientHeight > 0) {
        game.scale.resize(container.clientWidth, container.clientHeight);
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      runnerRef.current?.stop();
      runnerRef.current = null;
      game.destroy(true);
      gameRef.current = null;
    };
  }, []);

  useEffect(() => {
    const game = gameRef.current;
    if (!game) return;

    runnerRef.current?.stop();
    const runner = new MatchRunner(game, onProgress, onFinished, (nextTiles) => {
      setTiles(nextTiles);
    });
    runnerRef.current = runner;
    runner.start({ match, levelId, livesPerRun, sourceById });

    return () => {
      runner.stop();
    };
  }, [match, levelId, livesPerRun, sourceById, onProgress, onFinished]);

  const descriptors = tiles ? computeTileOverlays(tiles) : [];

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: "relative", width: "100%", height: "70vh" }}
    >
      <div className="match-view__overlays">
        {descriptors.map((descriptor) => (
          <RacerTileOverlay key={descriptor.botId} descriptor={descriptor} />
        ))}
      </div>
    </div>
  );
}
