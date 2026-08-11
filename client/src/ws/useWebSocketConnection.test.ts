import type { OutboundMessage } from "@arena/shared";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useBotRegistry } from "../botRegistry/useBotRegistry";
import { useTournamentSession } from "../tournament/useTournamentSession";
import { useWebSocketConnection } from "./useWebSocketConnection";

const socket = vi.hoisted(() => ({
  emitMessage: (_message: OutboundMessage) => {},
  emitConnected: () => {},
}));

vi.mock("./WebSocketClient", () => ({
  WebSocketClient: class {
    onStatusChange(listener: (status: string) => void) {
      socket.emitConnected = () => listener("connected");
      return () => {};
    }

    onMessage(listener: (message: OutboundMessage) => void) {
      socket.emitMessage = listener;
      return () => {};
    }

    connect() {
      socket.emitConnected();
    }

    disconnect() {}
    send() {}
  },
}));

function sampleBot(id: string) {
  return {
    id,
    name: `Bot ${id}`,
    author: "Test",
    color: "#000000",
    sourceCode: "export function decide() {}",
    uploadedAt: "2026-08-11T00:00:00.000Z",
  };
}

describe("useWebSocketConnection", () => {
  it("delivers every message from a fast bot upload batch", () => {
    const { result } = renderHook(() => {
      const connection = useWebSocketConnection("admin");
      return {
        registry: useBotRegistry(connection.subscribe, connection.status),
        tournament: useTournamentSession(connection.subscribe),
      };
    });

    act(() => {
      socket.emitMessage({
        type: "tournament-state",
        state: {
          mode: "single-elimination",
          stageLevelIds: ["level-one"],
          livesPerRun: 3,
          groupSize: 2,
          rounds: [],
          status: "running",
          championBotId: null,
        },
        show: null,
        serverNowMs: Date.now(),
      });
      socket.emitMessage({ type: "bot-registry-snapshot", bots: [] });
      for (let index = 1; index <= 8; index += 1) {
        socket.emitMessage({ type: "bot-added", bot: sampleBot(`bot-${index}`) });
      }
    });

    expect(result.current.registry.bots).toHaveLength(8);
    expect(result.current.tournament.tournament?.groupSize).toBe(2);
  });
});
