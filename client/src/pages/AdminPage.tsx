import { useState } from "react";
import { ConnectionStatusBadge } from "../components/ConnectionStatusBadge";
import { useWebSocketConnection } from "../ws/useWebSocketConnection";

export function AdminPage() {
  const { status, send } = useWebSocketConnection();
  const [lastSentAt, setLastSentAt] = useState<string | null>(null);

  const handlePing = () => {
    const sentAt = new Date().toISOString();
    send({ type: "ping-broadcast", sentAt, text: "Ping von Admin" });
    setLastSentAt(sentAt);
  };

  return (
    <main>
      <h1>Admin</h1>
      <ConnectionStatusBadge status={status} />
      <button type="button" onClick={handlePing}>
        Ping
      </button>
      {lastSentAt && <p>Gesendet um {lastSentAt}</p>}
    </main>
  );
}
