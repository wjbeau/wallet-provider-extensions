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
});
