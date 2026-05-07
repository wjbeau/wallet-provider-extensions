import { describe, expect, it, vi } from "vitest";
import { isKeystoreAccount, WithAccountsKeystore } from "./extension.ts";
import { base64 } from "@scure/base";
import type { Account, AccountStoreState } from "@algorandfoundation/accounts-store";
import { Store } from "@tanstack/store";
import {
  type Key,
  type KeyStoreState,
  generateXHDRootKeyFromSeed,
  generateXHDFromParent,
  generateEd25519FromSeed,
} from "@algorandfoundation/keystore";
import type { KeystoreAccount } from "./types.ts";

describe("WithAccountsKeystore", () => {
  const FIXED_SEED = new Uint8Array(64).fill(1);

  async function getMockKey(id: string) {
    const rootKey = await generateXHDRootKeyFromSeed({
      id: "seed-1",
      type: "hd-seed",
      privateKey: FIXED_SEED,
      algorithm: "raw",
      extractable: true,
    } as any);

    const keyData = {
      id,
      type: "hd-derived-ed25519" as const,
      metadata: {
        context: 0,
        account: 0,
        index: parseInt(id.replace("key-", "")) || 0,
      },
    } as any;

    return generateXHDFromParent({
      key: keyData,
      parentKey: rootKey,
    }) as Promise<Key>;
  }

  async function getMockEd25519Key(id: string) {
    return (await generateEd25519FromSeed(
      {
        id: "seed-1",
        type: "hd-seed",
        privateKey: FIXED_SEED,
        algorithm: "raw",
        extractable: true,
      } as any,
      { id },
    )) as unknown as Key;
  }

  it("should populate accounts from keystore keys in provider", async () => {
    const mockKey = await getMockKey("key-1");

    const accountStore = new Store<AccountStoreState<KeystoreAccount>>({
      accounts: [],
    });
    const spySetState = vi.spyOn(accountStore, "setState");

    const keyStore = new Store<KeyStoreState>({
      keys: [mockKey],
      status: "idle",
    });

    const provider = {
      keys: [mockKey],
      status: "idle",
      account: {
        store: {
          addAccount: vi.fn(),
        },
      },
      key: {
        store: {
          hooks: {
            after: vi.fn(),
          },
        },
      },
    };

    const options = {
      accounts: {
        store: accountStore,
        keystore: { autoPopulate: true },
      },
      keystore: {
        store: keyStore,
      },
    };

    WithAccountsKeystore(provider as any, options as any);

    expect(spySetState).toHaveBeenCalled();
    expect(accountStore.state.accounts.length).toBe(1);
    const addedAccount: Account = accountStore.state.accounts[0];
    expect(isKeystoreAccount(addedAccount)).toBe(true);
    if (isKeystoreAccount(addedAccount)) {
      expect(addedAccount.address).toBe(base64.encode(mockKey.publicKey!));
      expect(addedAccount.metadata?.keyId).toBe(mockKey.id);
    }
  });

  it("should provide a sign method that calls keystore.sign", async () => {
    const mockKey = await getMockKey("key-1");
    const mockSign = vi.fn().mockResolvedValue(new Uint8Array([4, 5, 6]));

    const accountStore = new Store<AccountStoreState<KeystoreAccount>>({
      accounts: [],
    });

    const keyStore = new Store<KeyStoreState>({
      keys: [mockKey],
      status: "idle",
    });

    const provider = {
      keys: [mockKey],
      status: "idle",
      account: {
        store: {
          setState: vi.fn(),
        },
      },
      key: {
        store: {
          sign: mockSign,
          hooks: {
            after: vi.fn(),
          },
        },
      },
    };

    const options = {
      accounts: {
        store: accountStore,
        keystore: { autoPopulate: true },
      },
      keystore: {
        store: keyStore,
      },
    };

    WithAccountsKeystore(provider as any, options as any);

    const addedAccount: Account = accountStore.state.accounts[0];
    if (!isKeystoreAccount(addedAccount)) {
      throw new Error("Expected account to be a KeystoreAccount");
    }

    const txns = [new Uint8Array([1, 2, 3])];
    const signedTxns = await addedAccount.sign(txns);

    expect(mockSign).toHaveBeenCalledWith(mockKey.id, txns[0]);
    expect(signedTxns[0]).toEqual(new Uint8Array([4, 5, 6]));
  });

  it("should not add duplicate accounts if they already exist in account store", async () => {
    const mockKey = await getMockKey("key-1");
    const address = base64.encode(mockKey.publicKey!);

    const accountStore = new Store<AccountStoreState<KeystoreAccount>>({
      accounts: [{ address, metadata: { keyId: mockKey.id } } as any],
    });
    const spySetState = vi.spyOn(accountStore, "setState");

    const keyStore = new Store<KeyStoreState>({
      keys: [mockKey],
      status: "idle",
    });

    const provider = {
      keys: [mockKey],
      status: "idle",
      account: {
        store: {
          setState: vi.fn(),
        },
      },
      key: {
        store: {
          hooks: {
            after: vi.fn(),
          },
        },
      },
    };

    const options = {
      accounts: {
        store: accountStore,
        keystore: { autoPopulate: true },
      },
      keystore: {
        store: keyStore,
      },
    };

    WithAccountsKeystore(provider as any, options as any);

    // Initial population check - should NOT call setState because account already exists
    expect(spySetState).not.toHaveBeenCalled();
  });

  it("should add missing accounts when keystore state updates", async () => {
    const mockKey1 = await getMockKey("key-1");
    const mockKey2 = await getMockKey("key-2");

    const accountStore = new Store<AccountStoreState<KeystoreAccount>>({
      accounts: [
        { address: base64.encode(mockKey1.publicKey!), metadata: { keyId: mockKey1.id } } as any,
      ],
    });
    const spySetState = vi.spyOn(accountStore, "setState");

    const keyStore = new Store<KeyStoreState>({
      keys: [mockKey1],
      status: "idle",
    });

    const provider = {
      keys: [mockKey1],
      status: "idle",
      account: {
        store: {
          setState: vi.fn(),
        },
      },
      key: {
        store: {
          hooks: {
            after: vi.fn(),
          },
        },
      },
    };

    const options = {
      accounts: {
        store: accountStore,
        keystore: { autoPopulate: true },
      },
      keystore: {
        store: keyStore,
      },
    };

    WithAccountsKeystore(provider as any, options as any);

    // Initial population check
    expect(spySetState).not.toHaveBeenCalled();

    // Trigger subscribe with new key
    keyStore.setState((s) => ({
      ...s,
      status: "ready",
      keys: [mockKey1, mockKey2],
    }));

    // Wait for the async processUpdates
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(spySetState).toHaveBeenCalledTimes(1);
    expect(accountStore.state.accounts.length).toBe(2);

    const addedAccount = accountStore.state.accounts.find(
      (a) => a.address === base64.encode(mockKey2.publicKey!),
    );
    expect(addedAccount).toBeDefined();
    expect(isKeystoreAccount(addedAccount!)).toBe(true);
    if (isKeystoreAccount(addedAccount!)) {
      expect(addedAccount.metadata?.keyId).toBe(mockKey2.id);
    }
  });

  it("should populate an account for a standalone ed25519 key", async () => {
    const mockKey = await getMockEd25519Key("ed-1");

    const accountStore = new Store<AccountStoreState<KeystoreAccount>>({
      accounts: [],
    });

    const keyStore = new Store<KeyStoreState>({
      keys: [mockKey],
      status: "idle",
    });

    const provider = {
      keys: [mockKey],
      status: "idle",
      account: { store: { addAccount: vi.fn() } },
      key: { store: { hooks: { after: vi.fn() } } },
    };

    const options = {
      accounts: { store: accountStore, keystore: { autoPopulate: true } },
      keystore: { store: keyStore },
    };

    WithAccountsKeystore(provider as any, options as any);

    expect(accountStore.state.accounts.length).toBe(1);
    const addedAccount: Account = accountStore.state.accounts[0];
    expect(isKeystoreAccount(addedAccount)).toBe(true);
    if (isKeystoreAccount(addedAccount)) {
      expect(addedAccount.address).toBe(base64.encode(mockKey.publicKey!));
      expect(addedAccount.metadata?.keyId).toBe(mockKey.id);
      expect(addedAccount.metadata?.parentKeyId).toBe("seed-1");
    }
  });

  it("should remove the account when a standalone ed25519 key is removed", async () => {
    const mockKey = await getMockEd25519Key("ed-1");
    const address = base64.encode(mockKey.publicKey!);

    const accountStore = new Store<AccountStoreState<KeystoreAccount>>({
      accounts: [],
    });

    const keyStore = new Store<KeyStoreState>({
      keys: [mockKey],
      status: "idle",
    });

    const provider = {
      keys: [mockKey],
      status: "idle",
      account: { store: { addAccount: vi.fn() } },
      key: { store: { hooks: { after: vi.fn() } } },
    };

    const options = {
      accounts: { store: accountStore, keystore: { autoPopulate: true } },
      keystore: { store: keyStore },
    };

    WithAccountsKeystore(provider as any, options as any);
    expect(accountStore.state.accounts.length).toBe(1);

    keyStore.setState((s) => ({ ...s, status: "ready", keys: [] }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(accountStore.state.accounts.find((a) => a.address === address)).toBeUndefined();
  });

  it("should propagate the seed's scheme onto a standalone ed25519 account", async () => {
    const seedKey = {
      id: "seed-1",
      type: "hd-seed",
      privateKey: FIXED_SEED,
      algorithm: "raw",
      extractable: true,
      metadata: { scheme: "bip39" },
    } as unknown as Key;
    const mockKey = await getMockEd25519Key("ed-1");

    const accountStore = new Store<AccountStoreState<KeystoreAccount>>({
      accounts: [],
    });
    const keyStore = new Store<KeyStoreState>({
      keys: [seedKey, mockKey],
      status: "idle",
    });

    const provider = {
      keys: [seedKey, mockKey],
      status: "idle",
      account: { store: { addAccount: vi.fn() } },
      key: { store: { hooks: { after: vi.fn() } } },
    };
    const options = {
      accounts: { store: accountStore, keystore: { autoPopulate: true } },
      keystore: { store: keyStore },
    };

    WithAccountsKeystore(provider as any, options as any);

    const added = accountStore.state.accounts[0];
    expect(isKeystoreAccount(added)).toBe(true);
    if (isKeystoreAccount(added)) {
      expect(added.metadata?.seedScheme).toBe("bip39");
    }
  });

  it("should propagate the seed's scheme onto an XHD-derived ed25519 account", async () => {
    const seedKey = {
      id: "seed-1",
      type: "hd-seed",
      privateKey: FIXED_SEED,
      algorithm: "raw",
      extractable: true,
      metadata: { scheme: "algo25" },
    } as unknown as Key;
    const rootKey = {
      id: "root-1",
      type: "hd-root-key",
      metadata: { parentKeyId: "seed-1" },
    } as unknown as Key;
    // Build an XHD-derived child but rebind its parent to root-1 for the test.
    const child = await getMockKey("key-1");
    (child as any).metadata = {
      ...(child as any).metadata,
      parentKeyId: "root-1",
    };

    const accountStore = new Store<AccountStoreState<KeystoreAccount>>({
      accounts: [],
    });
    const keyStore = new Store<KeyStoreState>({
      keys: [seedKey, rootKey, child],
      status: "idle",
    });

    const provider = {
      keys: [seedKey, rootKey, child],
      status: "idle",
      account: { store: { addAccount: vi.fn() } },
      key: { store: { hooks: { after: vi.fn() } } },
    };
    const options = {
      accounts: { store: accountStore, keystore: { autoPopulate: true } },
      keystore: { store: keyStore },
    };

    WithAccountsKeystore(provider as any, options as any);

    const added = accountStore.state.accounts.find((a) => a.metadata?.keyId === "key-1");
    expect(added).toBeDefined();
    if (added && isKeystoreAccount(added)) {
      expect(added.metadata?.seedScheme).toBe("algo25");
    }
  });

  it("should omit seedScheme when the seed has no scheme metadata", async () => {
    const mockKey = await getMockEd25519Key("ed-1");
    // No seed key in the store → resolver returns undefined.

    const accountStore = new Store<AccountStoreState<KeystoreAccount>>({
      accounts: [],
    });
    const keyStore = new Store<KeyStoreState>({
      keys: [mockKey],
      status: "idle",
    });

    const provider = {
      keys: [mockKey],
      status: "idle",
      account: { store: { addAccount: vi.fn() } },
      key: { store: { hooks: { after: vi.fn() } } },
    };
    const options = {
      accounts: { store: accountStore, keystore: { autoPopulate: true } },
      keystore: { store: keyStore },
    };

    WithAccountsKeystore(provider as any, options as any);

    const added = accountStore.state.accounts[0];
    expect(isKeystoreAccount(added)).toBe(true);
    if (isKeystoreAccount(added)) {
      expect(added.metadata?.seedScheme).toBeUndefined();
    }
  });
});
