import type { CSSProperties, ReactNode } from "react";

const PIXELS = Array.from({ length: 24 }, (_, index) => ({
  id: index,
  style: {
    left: `${8 + ((index * 37) % 84)}%`,
    "--pixel-drift": `${((index * 53) % 240) - 120}px`,
    "--pixel-turn": `${index % 2 === 0 ? 540 : -540}deg`,
    animationDelay: `${(index % 6) * 90}ms`,
    backgroundColor: ["var(--neon-cyan)", "var(--neon-pink)", "var(--neon-yellow)"][index % 3],
  } as CSSProperties,
}));

export function PresentCelebration({ children }: { children: ReactNode }) {
  return (
    <div className="present-celebration">
      <div className="present-celebration__confetti" aria-hidden="true">
        {PIXELS.map((pixel) => (
          <span key={pixel.id} style={pixel.style} />
        ))}
      </div>
      {children}
    </div>
  );
}
