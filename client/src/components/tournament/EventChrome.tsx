import type { TournamentShowPhase, TournamentShowState } from "@arena/shared";
import type { ReactNode } from "react";
import type { ConnectionStatus } from "../../ws/WebSocketClient";
import { ConnectionStatusBadge } from "../ConnectionStatusBadge";

const PHASE_LABELS: Record<TournamentShowPhase, string> = {
  ready: "Bereit",
  "matchup-intro": "Nächstes Match",
  countdown: "Countdown",
  "match-running": "Live",
  "match-result": "Ergebnis",
  "bracket-update": "Turnierstand",
  champion: "Champion",
};

interface EventChromeProps {
  show: TournamentShowState | null;
  connectionStatus: ConnectionStatus;
  children: ReactNode;
}

export function EventChrome({ show, connectionStatus, children }: EventChromeProps) {
  const presentUnavailable = show?.holds.includes("present-unavailable") ?? false;

  return (
    <main className="event-chrome">
      <header className="event-chrome__header">
        <div>
          <span className="event-chrome__eyebrow">Live Tournament</span>
          <h1>Coin Quest Arena</h1>
        </div>
        <div className="event-chrome__status">
          {show && <strong>{PHASE_LABELS[show.phase]}</strong>}
          <ConnectionStatusBadge status={connectionStatus} />
        </div>
      </header>

      {presentUnavailable && (
        <p className="event-chrome__hold" role="status">
          Present wird benötigt – der Show-Ablauf wartet auf eine verbundene Bühne.
        </p>
      )}

      <div className="event-chrome__stage">{children}</div>
    </main>
  );
}
