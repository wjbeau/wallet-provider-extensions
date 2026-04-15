import type { Account, AccountStoreOptions } from "@algorandfoundation/accounts-store";
import type { ExtensionOptions } from "@algorandfoundation/wallet-provider";
import type { KeyStoreOptions } from "@algorandfoundation/keystore";

/**
 * Represents an account that is backed by the keystore for signing.
 */
export interface KeystoreAccount extends Account {
  type: "keystore-account";
  /**
   * A method to sign a transaction or a set of transactions.
   *
   * @param txns - The transactions to sign.
   * @returns The signed transactions.
   */
  sign: (txns: Uint8Array[]) => Promise<Uint8Array[]>;
}

/**
 * Options for the AccountsKeystore extension.
 */
export interface AccountsKeystoreExtensionOptions
  extends ExtensionOptions, AccountStoreOptions<KeystoreAccount>, KeyStoreOptions {
  accounts: AccountStoreOptions<KeystoreAccount>["accounts"] & {
    keystore: {
      /**
       * Whether to automatically add accounts for all compatible keys in the keystore.
       * Defaults to true.
       */
      autoPopulate?: boolean;
    };
  };
}
