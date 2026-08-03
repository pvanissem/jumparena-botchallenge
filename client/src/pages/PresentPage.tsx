import { BroadcastFeed } from "../components/BroadcastFeed";
import { ConnectionStatusBadge } from "../components/ConnectionStatusBadge";
import { useWebSocketConnection } from "../ws/useWebSocketConnection";

export function PresentPage() {
  const { status, lastMessage } = useWebSocketConnection();

  return (
    <main>
      <h1>Präsentation</h1>
      <ConnectionStatusBadge status={status} />
      <BroadcastFeed lastMessage={lastMessage} />
    </main>
  );
}
