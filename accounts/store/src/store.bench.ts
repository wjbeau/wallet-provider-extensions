import { Store } from "@tanstack/store";
import { bench, describe } from "vitest";
import { addAccount, getAccount, removeAccount } from "./store.ts";
import type { Account, AccountStoreState } from "./types.ts";

describe("Account Store Benchmarks", () => {
  const store = new Store<AccountStoreState>({
    accounts: [],
  });
  const baseAccount: Account = {
    address: "A".repeat(58),
    type: "ed25519",
    balance: BigInt(0),
    assets: [],
  };

  bench("addAccount", () => {
    addAccount({
      store,
      account: { ...baseAccount, address: Math.random().toString(36) },
    });
  });

  bench("getAccount", () => {
    getAccount({ store, address: baseAccount.address });
  });

  bench("removeAccount", () => {
    removeAccount({ store, address: baseAccount.address });
  });
});
