import type { ArenaClientRole, InboundMessage, OutboundMessage } from "@arena/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { type ConnectionStatus, WebSocketClient } from "./WebSocketClient";

function resolveSocketUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}`;
}

export interface UseWebSocketConnectionResult {
  status: ConnectionStatus;
  clientId: string | null;
  lastMessage: OutboundMessage | null;
  send: (message: InboundMessage) => void;
}

/**
 * Thin React adapter around WebSocketClient - no reconnect/parsing logic of
 * its own (already covered by WebSocketClient's tests), just wires it into
 * React state.
 */
export function useWebSocketConnection(role: ArenaClientRole): UseWebSocketConnectionResult {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [clientId, setClientId] = useState<string | null>(null);
  const [lastMessage, setLastMessage] = useState<OutboundMessage | null>(null);
  const clientRef = useRef<WebSocketClient | null>(null);

  useEffect(() => {
    const client = new WebSocketClient(resolveSocketUrl(), { role });
    clientRef.current = client;
    const unsubscribeStatus = client.onStatusChange((nextStatus) => {
      setStatus(nextStatus);
      if (nextStatus !== "connected") setClientId(null);
    });
    const unsubscribeMessage = client.onMessage((message) => {
      if (message.type === "client-registered" && message.role === role) {
        setClientId(message.clientId);
      }
      setLastMessage(message);
    });
    client.connect();

    return () => {
      unsubscribeStatus();
      unsubscribeMessage();
      client.disconnect();
    };
  }, [role]);

  const send = useCallback((message: InboundMessage) => clientRef.current?.send(message), []);

  return {
    status,
    clientId,
    lastMessage,
    send,
  };
}
