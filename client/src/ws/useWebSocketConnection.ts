import type { InboundMessage, OutboundMessage } from "@arena/shared";
import { useEffect, useRef, useState } from "react";
import { type ConnectionStatus, WebSocketClient } from "./WebSocketClient";

function resolveSocketUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}`;
}

export interface UseWebSocketConnectionResult {
  status: ConnectionStatus;
  lastMessage: OutboundMessage | null;
  send: (message: InboundMessage) => void;
}

/**
 * Thin React adapter around WebSocketClient - no reconnect/parsing logic of
 * its own (already covered by WebSocketClient's tests), just wires it into
 * React state.
 */
export function useWebSocketConnection(): UseWebSocketConnectionResult {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [lastMessage, setLastMessage] = useState<OutboundMessage | null>(null);
  const clientRef = useRef<WebSocketClient | null>(null);

  useEffect(() => {
    const client = new WebSocketClient(resolveSocketUrl());
    clientRef.current = client;
    const unsubscribeStatus = client.onStatusChange(setStatus);
    const unsubscribeMessage = client.onMessage(setLastMessage);
    client.connect();

    return () => {
      unsubscribeStatus();
      unsubscribeMessage();
      client.disconnect();
    };
  }, []);

  return {
    status,
    lastMessage,
    send: (message) => clientRef.current?.send(message),
  };
}
