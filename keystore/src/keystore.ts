import { Store } from "@tanstack/store";
import Hook, { type HookCollection } from "before-after-hook";
import type { KeyStoreBackend, KeyId } from "./types/index.ts";
import type { Provider, Extension } from "@algorandfoundation/wallet-provider";

type KeyStoreState = {
	keys: string[];
	status: string
};

const keyStore = new Store<KeyStoreState>({ keys: [], status: 'idle'})

// TODO: add object for consumers to have introspection at consumption
export type KeyStoreExtension = {
	keys: KeyId[]
	keystore: KeyStoreBackend & {
		hooks: HookCollection<any>;
	};
};

export const WithKeystore: Extension<KeyStoreExtension> = (
	provider: Provider<any>,
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
		return hooks(operation, async () => {
			keyStore.setState((state) => ({ ...state, status: operation }));
			try {
				const result = await fn();
				if (shouldUpdateKeys) {
					await updateKeys();
				}
				// TODO: strip any key material from the result, this can be done in the implementation wrapper bellow.
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
			generate: (options) => wrap("generating", () => api.generate(options), true),
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
				? (id, data, algorithm) =>
						wrap("encrypting", () => api.encryptWithKey!(id, data, algorithm))
				: undefined,

			decryptWithKey: api.decryptWithKey
				? (id, data, algorithm) =>
						wrap("decrypting", () => api.decryptWithKey!(id, data, algorithm))
				: undefined,

			deriveSharedSecret: api.deriveSharedSecret
				? (id, publicKey, meFirst, algorithm) =>
						wrap("deriving", () =>
							api.deriveSharedSecret!(id, publicKey, meFirst, algorithm),
						)
				: undefined,

			importSeed: api.importSeed
				? (seed, options) =>
						wrap("importing seed", () => api.importSeed!(seed, options), true)
				: undefined,

			deriveFromSeed: api.deriveFromSeed
				? (seedId, path, options) =>
						wrap("deriving", () => api.deriveFromSeed!(seedId, path, options), true)
				: undefined,

			encryptData: api.encryptData
				? (data, passphrase) =>
						wrap("encrypting", () => api.encryptData!(data, passphrase))
				: undefined,

			decryptData: api.decryptData
				? (data, passphrase) =>
						wrap("decrypting", () => api.decryptData!(data, passphrase))
				: undefined,

			logAuditEvent: api.logAuditEvent
				? (event) => wrap("logging audit event", () => api.logAuditEvent!(event))
				: undefined,

			getAuditLogs: api.getAuditLogs
				? (filter) => wrap("getting audit logs", () => api.getAuditLogs!(filter))
				: undefined,

			batchSign: api.batchSign
				? (ids, data) => wrap("batch signing", () => api.batchSign!(ids, data))
				: undefined,
			hooks,
		},
	};
};