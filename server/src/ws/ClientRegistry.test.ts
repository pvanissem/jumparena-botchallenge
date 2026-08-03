import { describe, expect, it, vi } from "vitest";
import { ClientRegistry } from "./ClientRegistry";
import type { ConnectedClient } from "./ConnectedClient";

function createFakeClient(id: string): ConnectedClient {
  return { id, send: vi.fn() };
}

describe("ClientRegistry", () => {
  it("returns other connected clients but not the sender itself", () => {
    const registry = new ClientRegistry();
    const a = createFakeClient("a");
    const b = createFakeClient("b");
    const c = createFakeClient("c");

    registry.add(a);
    registry.add(b);
    registry.add(c);

    const others = registry.getOthers("a");

    expect(others).toHaveLength(2);
    expect(others.map((client) => client.id).sort()).toEqual(["b", "c"]);
  });

  it("no longer returns a client after it has been removed", () => {
    const registry = new ClientRegistry();
    const a = createFakeClient("a");
    const b = createFakeClient("b");

    registry.add(a);
    registry.add(b);
    registry.remove("b");

    expect(registry.getOthers("a")).toHaveLength(0);
  });

  it("returns an empty list when no other clients are connected", () => {
    const registry = new ClientRegistry();
    registry.add(createFakeClient("a"));

    expect(registry.getOthers("a")).toEqual([]);
  });
});
