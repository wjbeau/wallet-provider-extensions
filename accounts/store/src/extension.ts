import type { ExtensionOptions, Provider } from "@algorandfoundation/wallet-provider";
import { Store } from "@tanstack/store";
import Hook from "before-after-hook";
import { addAccount, clearAccounts, getAccount, removeAccount } from "./store.ts";
import type {
  Account,
  AccountStoreExtension,
  AccountStoreOptions,
  AccountStoreState,
} from "./types.ts";

/**
 * Extension that adds account management capabilities to a Provider.
 *
 * @param provider - The provider instance being extended.
 * @param options - Configuration options for the extension.
 * @returns The account store extension.
 */
export const WithAccountStore = <T extends Account>(
  provider: Provider<any> & AccountStoreExtension<T>,
  options: ExtensionOptions & AccountStoreOptions<T>,
): AccountStoreExtension<T> => {
  const store = options?.accounts?.store ?? new Store<AccountStoreState<T>>({ accounts: [] });
  const hooks = options?.accounts?.hooks ?? new Hook.Collection<any>();

  return {
    get accounts() {
      return store.state.accounts;
    },
    account: {
      store: provider.account?.store || {
        async addAccount(account: T): Promise<T> {
          return hooks("add", addAccount<T>, { store, account });
        },
        async removeAccount(address: string): Promise<void> {
          return hooks("remove", removeAccount<T>, { store, address });
        },
        async getAccount(address: string): Promise<T | undefined> {
          return hooks("get", getAccount<T>, { store, address });
        },
        async clear(): Promise<void> {
          return hooks("clear", clearAccounts<T>, { store });
        },
        hooks,
      },
    },
  } as AccountStoreExtension<T>;
};
