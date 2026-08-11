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

  it("returns only ready present clients in stable insertion order", () => {
    const registry = new ClientRegistry();
    const presentA = createFakeClient("present-a");
    const presentB = createFakeClient("present-b");
    const admin = createFakeClient("admin");
    registry.add(presentA);
    registry.add(presentB);
    registry.add(admin);
    registry.registerRole("present-a", "present");
    registry.registerRole("present-b", "present");
    registry.registerRole("admin", "admin");

    registry.setPresentReady("present-b", true);
    registry.setPresentReady("present-a", true);

    expect(registry.getReadyPresentClients().map((client) => client.id)).toEqual([
      "present-a",
      "present-b",
    ]);
    expect(registry.roleOf("admin")).toBe("admin");
  });

  it("removes role and readiness metadata together with the client", () => {
    const registry = new ClientRegistry();
    const present = createFakeClient("present");
    registry.add(present);
    registry.registerRole("present", "present");
    registry.setPresentReady("present", true);

    registry.remove("present");
    registry.remove("present");

    expect(registry.roleOf("present")).toBeNull();
    expect(registry.getReadyPresentClients()).toEqual([]);
  });

  it("ignores metadata updates for unknown clients", () => {
    const registry = new ClientRegistry();

    registry.registerRole("missing", "present");
    registry.setPresentReady("missing", true);

    expect(registry.roleOf("missing")).toBeNull();
    expect(registry.getReadyPresentClients()).toEqual([]);
  });
});
