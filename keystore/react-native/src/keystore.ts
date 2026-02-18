import type {Extension, Provider} from "@algorandfoundation/wallet-provider";
import {
    type KeyStoreExtension,
    type KeyStoreExtOptions,
    type KeyStoreAPI,
    type KeyData, clearKeyData, encrypt, verify, sign, type XHDPasskey,
    type XHDDerivedKeyData, type KeyId, signWithKeyData, KeyNotFoundError, decrypt
} from "@algorandfoundation/keystore";
import * as store from "./store.ts";
import {fetchSecret} from "./storage/state.ts";

/**
 * Wallet Provider Extension that adds Keystore functionality.
 *
 * It wraps a {@link KeyStoreAPI} to provide reactive state for keys and status,
 * and adds a hook system for intercepting operations.
 *
 * @param _provider - The host {@link Provider} instance (unused here but part of the Extension signature)
 * @param options - Extension options
 * @param options.keystore.extension - The {@link KeyStoreAPI} extension configuration
 * @param options.api.keystore - The concrete {@link KeyStoreAPI} implementation to wrap
 *
 * @returns The {@link KeyStoreExtension} surface with reactive `keys` and an augmented `keystore` API.
 *
 * @example
 * ```typescript
 * const ProviderWithKeystore = Provider.withExtensions([WithKeyStore]);
 * const provider = new ProviderWithKeystore({
 *   api: { keystore: myKeystoreAPI }
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
    options: KeyStoreExtOptions,
) => {
    const keyStore = options.keystore.extension.store
    const keyStoreHooks = options.keystore.extension.hooks
    // Implement the extension surface with hooks
    return {
        /** Reactive state of all keys in the keystore */
        get keys() {
            return keyStore.state.keys;
        },
        /** Reactive status of the keystore (e.g., 'idle', 'commiting') */
        get status() {
            return keyStore.state.status;
        },
        /**
         * The Keystore API for performing cryptographic operations.
         * Maps to the underlying {@link KeyStoreAPI} implementation.
         */
        keystore: options?.api?.keystore || {
            /** Generates a new key pair and stores it */
            generate: (options): Promise<KeyId> => keyStoreHooks('generate', store.generateKey, {store: keyStore, ...options}),
            /** Imports an existing key into the keystore */
            import: (data, _format): Promise<KeyId> => store.importKey({store: keyStore, keyData: data}),
            /** Exports public key data for a given key ID */
            export: (id, options): Promise<KeyData> => store.exportKey({store: keyStore, id, options}),
            /** Removes a key from the keystore */
            remove: (id) => keyStoreHooks('remove', async function handleRemove({keyId}) {
                await store.removeKey({store: keyStore, keyId})
            }, {keyId: id}),
            /** Clears all keys from the keystore */
            clear: () => keyStoreHooks('clear', async function handleClear() {
                await store.clear({store: keyStore})
            }, {}),
            /** Signs data using the private key associated with the ID */
            sign: (id, data): Promise<Uint8Array<ArrayBufferLike>> =>
                keyStoreHooks('sign', async function handleSign({id, data} : {
                id: string,
                data: Uint8Array<ArrayBufferLike>
            }) {
                let key, parentKey;
                try {
                    key = await fetchSecret<KeyData>({keyId: id})
                    if(!key) {
                        throw new KeyNotFoundError(id)
                    }
                    // We can assume if it has a parent key that it is an HD key
                    if (typeof key?.metadata !== 'undefined' && typeof key?.metadata?.rootKeyId !== 'undefined') {
                        parentKey = await fetchSecret<KeyData>({keyId: (key as XHDDerivedKeyData | XHDPasskey).metadata.rootKeyId})
                        if(!parentKey) throw new KeyNotFoundError((key as XHDDerivedKeyData | XHDPasskey).metadata.rootKeyId)
                    }
                    return sign({store: keyStore, key, parentKey, data})
                } finally {
                    clearKeyData(key)
                    clearKeyData(parentKey)
                }
            }, {id, data}),
            /** Verifies a signature against data */
            verify: (id, data, signature, algorithm): Promise<boolean> => keyStoreHooks('verify', async () => {
                let key;
                try {
                    // Fetch the key from storage
                    key = await fetchSecret<KeyData>({keyId: id})
                    if(!key) throw new KeyNotFoundError(id)
                    // Verify the signature
                    return verify({store: keyStore, key, data, signature, algorithm})
                } finally {
                    clearKeyData(key)
                }
            }),
            /** Imports a raw seed for HD wallet derivation */
            importSeed: (seed): Promise<KeyId> => store.importKey({
                store: keyStore,
                keyData: {
                    type: 'hd-seed',
                    algorithm: 'raw',
                    format: 'bytes',
                    extractable: true,
                    privateKey: seed,
                },
            }),
            /** Derives a new key from a stored seed using a path */
            deriveFromSeed: (seedId, path, options): Promise<KeyId> => keyStoreHooks('deriveFromSeed', store.deriveFromSeed, {
                store: keyStore,
                seedId,
                path,
                options
            }),
            /** Encrypts data using the key associated with the ID */
            encryptWithKey: (id, data, algorithm): Promise<Uint8Array<ArrayBufferLike>> => keyStoreHooks('encryptWithKey', async () => {
                let key;
                try {
                    key = await fetchSecret<KeyData>({keyId: id})
                    if(!key) throw new KeyNotFoundError(id)
                    return encrypt({
                        store: keyStore,
                        key,
                        data,
                        algorithm
                    })
                } finally {
                    clearKeyData(key)
                }

            }),
            /** Decrypts data using the key associated with the ID */
            decryptWithKey: (id, data, algorithm): Promise<Uint8Array<ArrayBufferLike>> => keyStoreHooks('decryptWithKey', async ()=>{
                let key;
                try {
                    key = await fetchSecret<KeyData>({keyId: id})
                    if(!key) throw new KeyNotFoundError(id)
                    return decrypt({store: keyStore, key, data, algorithm})
                }finally {
                    clearKeyData(key)
                }

            }, {
                store: keyStore,
                id,
                data,
                algorithm
            }),
            /** Signs multiple data items using multiple key IDs */
            batchSign: (ids, data): Promise<Uint8Array<ArrayBufferLike>[]> => keyStoreHooks('batchSign', async ({ids, data}:{ids: KeyId[], data: Uint8Array<ArrayBufferLike>[] })=>{
                let keys:(KeyData|null)[] = []
                let parentKeys: (KeyData|null)[] = [];
                try {
                    keys = await Promise.all(ids.map((id) => fetchSecret<KeyData>({keyId: id})))
                    parentKeys = await Promise.all(keys.map((key) => fetchSecret<KeyData>({keyId: (key as XHDDerivedKeyData | XHDPasskey).metadata.rootKeyId})))
                    return Promise.all(keys.map((key, i) => {
                        return key ? signWithKeyData({key, data: data[i] as Uint8Array<ArrayBufferLike>, parentKey: parentKeys[i] as KeyData}) : null
                    }));

                } finally {
                    keys.map(clearKeyData)
                    parentKeys.map(clearKeyData)
                }
            }, {
                ids,
                data
            }),
            // Add more methods as needed, mapping to functional store
        },
    } as KeyStoreExtension;
};
