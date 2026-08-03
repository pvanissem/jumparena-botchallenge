import type { OutboundMessage } from "@arena/shared";

export function BroadcastFeed({ lastMessage }: { lastMessage: OutboundMessage | null }) {
  if (!lastMessage) {
    return <p data-testid="broadcast-feed">Noch keine Nachricht empfangen.</p>;
  }

  return (
    <p data-testid="broadcast-feed">
      [{lastMessage.sentAt}] {lastMessage.text}
    </p>
  );
}
