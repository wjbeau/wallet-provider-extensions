import { describe, it, expect, vi, beforeEach } from "vitest";
import { Store } from "@tanstack/store";
import { WithIdentitiesKeystore } from "./extension.ts";
import type { KeyStoreState } from "@wjbeau/keystore";
import type { IdentityStoreState } from "@wjbeau/identities-store";

describe("WithIdentitiesKeystore Extension", () => {
  let keyStore: Store<KeyStoreState>;
  let identityStore: Store<IdentityStoreState>;
  let mockProvider: any;
  let mockOptions: any;

  beforeEach(() => {
    keyStore = new Store<KeyStoreState>({
      keys: [],
      status: "idle",
    });
    identityStore = new Store<IdentityStoreState>({
      identities: [],
    });

    mockProvider = {
      key: {
        store: {
          generate: vi.fn(),
          sign: vi.fn(),
        },
      },
      identity: {
        store: {
          addIdentity: vi.fn(),
          removeIdentity: vi.fn(),
          updateDidDocument: vi.fn(),
        },
      },
    };

    mockOptions = {
      keystore: { store: keyStore },
      identities: { store: identityStore },
    };
  });

  it("should throw if dependencies are missing", () => {
    expect(() => WithIdentitiesKeystore({} as any, mockOptions)).toThrow();
    expect(() => WithIdentitiesKeystore({ identity: {} } as any, mockOptions)).toThrow();
  });

  it("should initialize and subscribe to keystore", () => {
    const subscribeSpy = vi.spyOn(keyStore, "subscribe");
    WithIdentitiesKeystore(mockProvider, mockOptions);
    expect(subscribeSpy).toHaveBeenCalled();
  });

  it("should auto-populate identities from context 1 keys", async () => {
    const publicKey = new Uint8Array(32).fill(1);
    const mockKey = {
      id: "key1",
      type: "hd-derived-ed25519",
      publicKey,
      metadata: { context: 1 },
    };

    // Set keys in store before extension initialization
    keyStore.setState((s) => ({ ...s, keys: [mockKey], status: "ready" }));

    WithIdentitiesKeystore(mockProvider, mockOptions);

    // Wait for async processing
    await vi.waitFor(() => {
      expect(mockProvider.identity.store.addIdentity).toHaveBeenCalled();
    });

    const calledIdentity = mockProvider.identity.store.addIdentity.mock.calls[0][0];
    expect(calledIdentity.address).toBeDefined();
    expect(calledIdentity.metadata.keyId).toBe("key1");
  });

  it("should not populate from context 0 keys", async () => {
    const publicKey = new Uint8Array(32).fill(1);
    const mockKey = {
      id: "key1",
      type: "hd-derived-ed25519",
      publicKey,
      metadata: { context: 0 },
    };

    keyStore.setState((s) => ({ ...s, keys: [mockKey], status: "ready" }));

    WithIdentitiesKeystore(mockProvider, mockOptions);

    // Give it some time
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(mockProvider.identity.store.addIdentity).not.toHaveBeenCalled();
  });

  it("should remove identity when key is removed", async () => {
    const publicKey = new Uint8Array(32).fill(1);
    const mockKey = {
      id: "key1",
      type: "hd-derived-ed25519",
      publicKey,
      metadata: { context: 1 },
    };

    // Initialize with the key
    keyStore.setState((s) => ({ ...s, keys: [mockKey], status: "ready" }));
    WithIdentitiesKeystore(mockProvider, mockOptions);

    await vi.waitFor(() => {
      expect(mockProvider.identity.store.addIdentity).toHaveBeenCalled();
    });

    // Mock the identity being in the store
    const identity = mockProvider.identity.store.addIdentity.mock.calls[0][0];
    identityStore.setState((s) => ({ ...s, identities: [identity] }));

    // Remove key
    keyStore.setState((s) => ({ ...s, keys: [], status: "ready" }));

    await vi.waitFor(() => {
      expect(mockProvider.identity.store.removeIdentity).toHaveBeenCalledWith(identity.address);
    });
  });

  it("should provide restoreFromDidDocument in the extension shape", () => {
    const extension = WithIdentitiesKeystore(mockProvider, mockOptions);
    expect(extension.identity.store.restoreFromDidDocument).toBeDefined();
  });
});
