import type { AccountStoreExtension } from "@algorandfoundation/accounts-store";
import type { KeyStoreExtension } from "@algorandfoundation/keystore";
import type { ExtensionOptions } from "@algorandfoundation/wallet-provider";

/**
 * Options for the AccountsKeystore extension.
 */
export interface AccountsKeystoreExtensionOptions extends ExtensionOptions {
	accounts?: {
		keystore: {
			/**
			 * Whether to automatically add accounts for all compatible keys in the keystore.
			 * Defaults to true.
			 */
			autoPopulate?: boolean;
		}
	};
}

/**
 * The interface exposed by the Accounts Keystore Extension.
 *
 * This extension bridges the Accounts Store and the Keystore,
 * providing accounts that are backed by the keystore for signing.
 */
export interface AccountsKeystoreExtension
	extends AccountStoreExtension,
		KeyStoreExtension {}
