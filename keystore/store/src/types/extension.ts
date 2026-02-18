import type { ExtensionOptions } from "@algorandfoundation/wallet-provider";
import type { Store } from "@tanstack/store";
import type { HookCollection } from "before-after-hook";

import type { KeyStoreAPI } from "./backend.ts";
import type { EncryptionConfig, Key, KeyId } from "./core.ts";

/**
 * Configuration for the keystore extension.
 */
export interface KeyStoreExtOptions extends ExtensionOptions {
	/** API configuration */
	api?: {
		/** The {@link KeyStoreAPI} backend implementation to use */
		keystore?: KeyStoreAPI;
	};
	/** Keystore-specific settings */
	keystore: {
		extension: { store: Store<KeyStoreState>; hooks: HookCollection<any> };
		// Note: Other options will be available in specific contexts like ReactNative
		//extension: {vault: ReactNativeVault, store: Store<KeyStoreState>, hooks: HookCollection<any>}
		/** Whether to enable audit logging */
		enableAudit?: boolean;
		/** Data encryption settings. See {@link EncryptionConfig} */
		encryption?: EncryptionConfig;
	};
}

/**
 * Represents the state of the keystore extension.
 *
 * This state is intentionally UI-safe: it only contains metadata (like key IDs)
 * and status flags. It NEVER contains private key material.
 *
 * @remarks
 * Consumers can subscribe to state changes using TanStack Store selectors.
 * See {@link https://tanstack.com/store/latest docs} for details.
 */
export interface KeyStoreState {
	/** Array of available {@link KeyId}s currently stored by the backend */
	keys: Key[];
	/**
	 * Current status of the keystore operation lifecycle.
	 *
	 * Typical values include:
	 * - `"idle"` — no operation in progress
	 * - `"generating"` — creating a new key/seed
	 * - `"importing"` — importing an existing key
	 * - `"deriving"` — deriving a key from a seed
	 * - `"signing"` — signing data/transactions
	 * - `"encrypting"` / `"decrypting"` — performing crypto on payloads
	 */
	status: string;
}

/**
 * The interface exposed by the Keystore Extension when added to a Provider.
 */
export interface KeyStoreExtension extends KeyStoreState {
	/** The keystore backend with added support for hooks */
	keystore: KeyStoreAPI & {
		/**
		 * Hook collection for intercepting keystore operations.
		 *
		 * Supported operation ids include (non-exhaustive):
		 * `"generating"`, `"importing"`, `"exporting"`, `"removing"`,
		 * `"listing"`, `"getting metadata"`, `"signing"`, `"verifying"`,
		 * `"encrypting"`, `"decrypting"`, `"deriving"`, `"importing seed"`,
		 * `"logging audit event"`, `"getting audit logs"`, `"batch signing"`.
		 *
		 * Powered by {@link https://github.com/gr2m/before-after-hook before-after-hook}.
		 */
		hooks: HookCollection<any>;
	};
}
