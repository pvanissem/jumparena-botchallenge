import { BroadcastFeed } from "../components/BroadcastFeed";
import { ConnectionStatusBadge } from "../components/ConnectionStatusBadge";
import { useWebSocketConnection } from "../ws/useWebSocketConnection";

export function DevPage() {
  const { status, lastMessage } = useWebSocketConnection();

  return (
    <main>
      <h1>Bot-Entwicklung</h1>
      <p>
        Die Bot-Entwicklung selbst ist nicht Teil dieses Features. Diese Ansicht zeigt nur, dass der
        Broadcast-Kanal vom Server auch hier ankommt.
      </p>
      <ConnectionStatusBadge status={status} />
      <BroadcastFeed lastMessage={lastMessage} />
    </main>
  );
}
