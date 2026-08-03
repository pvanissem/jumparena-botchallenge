import type { ConnectionStatus } from "../ws/WebSocketClient";

const LABELS: Record<ConnectionStatus, string> = {
  connecting: "Verbinde…",
  connected: "Verbunden",
  disconnected: "Getrennt",
};

export function ConnectionStatusBadge({ status }: { status: ConnectionStatus }) {
  return <span data-testid="connection-status">{LABELS[status]}</span>;
}
