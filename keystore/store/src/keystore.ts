import type { Extension, Provider } from "@algorandfoundation/wallet-provider";
import { Store } from "@tanstack/store";
import Hook, { type HookCollection } from "before-after-hook";
import type { KeyId, KeyStoreBackend } from "./types/index.ts";

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
export type KeyStoreState = {
	/** Array of available {@link KeyId}s currently stored by the backend */
	keys: string[];
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
};

/**
 * Shared TanStack Store instance used by the keystore extension to expose
 * reactive, UI-safe state.
 *
 * @example
 * ```ts
 * import { keyStore } from "@algorandfoundation/keystore/extension";
 * import { useStore } from "@tanstack/react-store";
 *
 * const status = useStore(keyStore, (s) => s.status);
 * const keys = useStore(keyStore, (s) => s.keys);
 * ```
 */
export const keyStore: Store<
	KeyStoreState,
	(cb: KeyStoreState) => KeyStoreState
> = new Store<KeyStoreState>({ keys: [], status: "idle" });

/**
 * The interface exposed by the Keystore Extension when added to a Provider.
 */
export type KeyStoreExtension = {
	/** Reactive list of key identifiers currently in the keystore */
	keys: KeyId[];
	/** The keystore backend with added support for hooks */
	keystore: KeyStoreBackend & {
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
};

/**
 * Wallet Provider Extension that adds Keystore functionality.
 *
 * It wraps a {@link KeyStoreBackend} to provide reactive state for keys and status,
 * and adds a hook system for intercepting operations.
 *
 * @param _provider - The host {@link Provider} instance (unused here but part of the Extension signature)
 * @param options - Extension options
 * @param options.api.keystore - The concrete {@link KeyStoreBackend} implementation to wrap
 *
 * @returns The {@link KeyStoreExtension} surface with reactive `keys` and an augmented `keystore` API.
 *
 * @example
 * ```typescript
 * const ProviderWithKeystore = Provider.withExtensions([WithKeyStore]);
 * const provider = new ProviderWithKeystore({
 *   api: { keystore: myKeystoreBackend }
 * });
 *
 * // Add hooks
 * provider.keystore.hooks.before("signing", ({ id }) => {
 *   console.log("About to sign with", id)
 * })
 * ```
 */
export const WithKeyStore: Extension<KeyStoreExtension> = (
	_provider: Provider<any>,
	options: { api: { keystore: KeyStoreBackend } },
) => {
	const { keystore: api } = options.api;
	const hooks = new Hook.Collection();

	const updateKeys = async () => {
		const metadata = await api.list();
		keyStore.setState((state) => ({
			...state,
			keys: metadata.map((m) => m.id),
		}));
	};

	const wrap = async <T>(
		operation: string,
		fn: () => Promise<T>,
		shouldUpdateKeys = false,
	): Promise<T> => {
		// Remove any chance of hooks accessing private data, just run the method
		if (
			operation.startsWith("export") ||
			operation.startsWith("import") ||
			operation.startsWith("decrypt") ||
			operation.startsWith("encrypt")
		) {
			return fn();
		}
		return hooks(operation, async () => {
			keyStore.setState((state) => ({ ...state, status: operation }));
			try {
				const result = await fn();
				if (shouldUpdateKeys) {
					await updateKeys();
				}
				return result;
			} finally {
				keyStore.setState((state) => ({ ...state, status: "idle" }));
			}
		});
	};

	return {
		get keys() {
			return keyStore.state.keys;
		},
		keystore: {
			generate: (options) =>
				wrap("generating", () => api.generate(options), true),
			import: (data, format) =>
				wrap("importing", () => api.import(data, format), true),
			export: (id, options) => wrap("exporting", () => api.export(id, options)),
			remove: (id) => wrap("removing", () => api.remove(id), true),
			list: () => wrap("listing", () => api.list()),
			getMetadata: (id) => wrap("getting metadata", () => api.getMetadata(id)),
			sign: (id, data, algorithm) =>
				wrap("signing", () => api.sign(id, data, algorithm)),
			verify: (id, data, signature, algorithm) =>
				wrap("verifying", () => api.verify(id, data, signature, algorithm)),

			encryptWithKey: api.encryptWithKey
				? (id, data, algorithm) => {
						const method = api.encryptWithKey;
						if (!method) return Promise.reject(new Error("Method not found"));
						return wrap("encrypting", () => method(id, data, algorithm));
					}
				: undefined,

			decryptWithKey: api.decryptWithKey
				? (id, data, algorithm) => {
						const method = api.decryptWithKey;
						if (!method) return Promise.reject(new Error("Method not found"));
						return wrap("decrypting", () => method(id, data, algorithm));
					}
				: undefined,

			deriveSharedSecret: api.deriveSharedSecret
				? (id, publicKey, meFirst, algorithm) => {
						const method = api.deriveSharedSecret;
						if (!method) return Promise.reject(new Error("Method not found"));
						return wrap("deriving", () =>
							method(id, publicKey, meFirst, algorithm),
						);
					}
				: undefined,

			importSeed: api.importSeed
				? (seed, options) => {
						const method = api.importSeed;
						if (!method) return Promise.reject(new Error("Method not found"));
						return wrap("importing seed", () => method(seed, options), true);
					}
				: undefined,

			deriveFromSeed: api.deriveFromSeed
				? (seedId, path, options) => {
						const method = api.deriveFromSeed;
						if (!method) return Promise.reject(new Error("Method not found"));
						return wrap(
							"deriving",
							() => method(seedId, path, options),
							true,
						) as Promise<string>;
					}
				: undefined,

			encryptData: api.encryptData
				? (data, passphrase) => {
						const method = api.encryptData;
						if (!method) return Promise.reject(new Error("Method not found"));
						return wrap("encrypting", () => method(data, passphrase));
					}
				: undefined,

			decryptData: api.decryptData
				? (data, passphrase) => {
						const method = api.decryptData;
						if (!method) return Promise.reject(new Error("Method not found"));
						return wrap("decrypting", () => method(data, passphrase));
					}
				: undefined,

			logAuditEvent: api.logAuditEvent
				? (event) => {
						const method = api.logAuditEvent;
						if (!method) return Promise.reject(new Error("Method not found"));
						return wrap("logging audit event", () => method(event));
					}
				: undefined,

			getAuditLogs: api.getAuditLogs
				? (filter) => {
						const method = api.getAuditLogs;
						if (!method) return Promise.reject(new Error("Method not found"));
						return wrap("getting audit logs", () => method(filter));
					}
				: undefined,

			batchSign: api.batchSign
				? (ids, data) => {
						const method = api.batchSign;
						if (!method) return Promise.reject(new Error("Method not found"));
						return wrap("batch signing", () => method(ids, data));
					}
				: undefined,
			hooks,
		},
	};
};
