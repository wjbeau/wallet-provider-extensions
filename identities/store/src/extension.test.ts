import { describe, it, expect, vi } from "vitest";
import { WithIdentityStore } from "./extension.ts";
import type { Identity } from "./types.ts";

describe("Identity Store Extension", () => {
  const mockProvider = {} as any;

  it("should initialize with default store and hooks", () => {
    const extension = WithIdentityStore(mockProvider, {});
    expect(extension.identities).toEqual([]);
    expect(extension.identity.store).toBeDefined();
    expect(extension.identity.store.hooks).toBeDefined();
  });

  it("should add an identity via extension API", async () => {
    const extension = WithIdentityStore(mockProvider, {});
    const mockIdentity: Identity = { address: "addr1", type: "xhd" };

    const result = await extension.identity.store.addIdentity(mockIdentity);
    expect(result).toEqual(mockIdentity);
    expect(extension.identities).toContainEqual(mockIdentity);
  });

  it("should remove an identity via extension API", async () => {
    const extension = WithIdentityStore(mockProvider, {});
    const mockIdentity: Identity = { address: "addr1", type: "xhd" };

    await extension.identity.store.addIdentity(mockIdentity);
    await extension.identity.store.removeIdentity("addr1");
    expect(extension.identities).toEqual([]);
  });

  it("should trigger hooks", async () => {
    const extension = WithIdentityStore(mockProvider, {});
    const beforeHook = vi.fn();
    extension.identity.store.hooks.before("add", beforeHook);

    const mockIdentity: Identity = { address: "addr1", type: "xhd" };
    await extension.identity.store.addIdentity(mockIdentity);

    expect(beforeHook).toHaveBeenCalled();
  });
});
