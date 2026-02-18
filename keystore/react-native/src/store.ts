import type {BufferLike, EncryptDecryptParams, SubtleAlgorithm} from 'react-native-quick-crypto'
import {CryptoKey } from "react-native-quick-crypto";

import {
    type Algorithm,
    generateId, setStatus, InvalidKeyDataError,
    type KeyData,
    type KeyId,
    type KeyStoreState, InvalidKeyFormatError,
    clearBuffer, type XHDPasskey, type SeedData, type DeriveOptions, type XHDRootKey,
    KeyNotFoundError, clearKeyData, type XHDDerivedKeyData
} from "@algorandfoundation/keystore";

import { Store } from "@tanstack/store";
import { DeterministicP256 } from "@algorandfoundation/dp256";
import {
    BIP32DerivationType,
    KeyContext,
    XHDWalletAPI,
} from "@algorandfoundation/xhd-wallet-api";
import {
    crypto_generichash,
    crypto_secretbox_open_easy,
} from "@algorandfoundation/xhd-wallet-api/dist/sumo.facade.js";
import {DecodingError} from "./errors.ts";
import {commit, fetchSecret, storage} from "./storage/state.ts";
import {generateSeedData, generateXHDFromParent} from "./generate.ts";

const api = new XHDWalletAPI();
const dp256 = new DeterministicP256();

/**
 * Removes a key from the reactive store and persistent storage.
 * @param params.store - The reactive store instance
 * @param params.keyId - The ID of the key to remove
 */
export async function removeKey({store, keyId}: {store: Store<KeyStoreState>, keyId: string}): Promise<void> {
    // Remove the key from storage
    storage.remove(keyId)
    store.setState((state) => ({keys: state.keys.filter((key) => key.id !== keyId), status: 'idle'}))
}

/**
 * Clears all keys from the reactive store and persistent storage.
 * @param params.store - The reactive store instance
 */
export async function clear({store}: {store: Store<KeyStoreState>}): Promise<void> {
    store.setState(() => ({keys: [], status: 'idle'}))
    storage.clearAll()
}

/**
 * Generates a new key pair, stores it, and updates the reactive store.
 * Supports various algorithm types via options.
 * @param params.store - The reactive store instance
 * @param params.algorithm - The algorithm to use for generation
 * @param params.extractable - Whether the private key can be exported
 * @param params.keyUsages - Intended usages for the key
 * @returns The generated KeyId
 */
export async function generateKey({store, algorithm, extractable = false, keyUsages = ['sign']}: {
    store: Store<KeyStoreState>,
    algorithm: Algorithm,
    extractable: boolean,
    keyUsages: KeyUsage[]
}): Promise<KeyId> {
    console.log('ReactNativeKeystore - generateKey')
    // Signal that we are generating a key
    setStatus({store, status: 'computing'})

    try{
        const id = generateId();

        let keyData: Partial<KeyData> = {
            algorithm,
            extractable,
            metadata: {
                createdAt: new Date(),
                usage: keyUsages
            }
        }
        switch(algorithm){
            case "raw": {
                keyData = {
                    ...keyData,
                    ...(await generateSeedData()),
                    id,
                }
                break;
            }
            case "EdDSA": {
                keyData = {
                    ...keyData,
                    ...(await generateSeedData()),
                    id,
                }
                break;
            }
        }

        await commit({store, keyData: keyData as KeyData})

        return id
    }finally {
        setStatus({store, status: 'idle'})
    }

}


export async function importSeed({store, keyData}: {store: Store<KeyStoreState>, keyData: Omit<SeedData, 'id'>}): Promise<KeyId> {
    setStatus({store, status: 'importing'})
    const id = generateId();

    if(keyData.type !== "hd-seed" && keyData.format !== "raw"){
        throw new InvalidKeyDataError("Only supports importing raw seeds");
    }

    if(typeof keyData.privateKey === 'undefined'){
        throw new InvalidKeyDataError("Seed is required");
    }
    console.log(keyData.extractable)
    try {
        await commit({store, keyData: {
                id,
                ...keyData,
                type: "hd-seed",
            } as any});
    } finally {
        setStatus({store, status: 'idle'})
    }

    return id;
}

export function parsePath(path: string): number[] {
    return path
        .replace(/^m\/?/, "")
        .split("/")
        .map((part) => {
            const hardened = part.endsWith("'") || part.endsWith("h");
            const index = parseInt(part.replace(/['h]$/, ""), 10);
            return hardened ? index + 0x80000000 : index;
        });
}

/**
 * Derives a new key from an existing seed in the keystore.
 * @param params.store - The reactive store instance
 * @param params.seedId - The ID of the seed to derive from
 * @param params.path - The derivation path
 * @param params.options - Optional derivation settings
 * @returns The ID of the derived key
 */
export async function deriveFromSeed({store, seedId, path, options}: {store: Store<KeyStoreState>, seedId: KeyId, path: string, options?: DeriveOptions}): Promise<KeyId> {
    setStatus({store, status: 'deriving'})

    let rootKey: XHDRootKey | null = null;
    let derivedKey: KeyData | XHDDerivedKeyData | XHDPasskey | null = null;
    try {
        rootKey = await fetchSecret<XHDRootKey>({keyId: seedId})
        if(!rootKey) throw new KeyNotFoundError(seedId)
        if (rootKey.type !== 'hd-root-key') throw new InvalidKeyDataError('Not a root key')
        if(typeof rootKey.privateKey === 'undefined'){
            throw new InvalidKeyDataError("Could find root key material")
        }
        const isP256 = options?.curve === "secp256r1" || options?.algorithm === "ES256";

        if (isP256) {
            derivedKey = await generateXHDFromParent({
                key: {
                    type: "hd-derived-passkey",
                    algorithm: options?.algorithm ?? "ES256",
                    format: "raw",
                    metadata: {
                        origin: options?.origin ?? "default",
                        userHandle: options?.userHandle ?? "default",
                        counter: options?.counter ?? 0,
                        rootKeyId: seedId,
                    }

                },
                parentKey: rootKey,
            });

            await commit({store, keyData: derivedKey});

            return derivedKey.id;
        } else {
            const derivationPath = parsePath(path);
            const derivationType = options?.mode === "standard"
                ? BIP32DerivationType.Khovratovich
                : BIP32DerivationType.Peikert;

            const context = derivationPath[1] === 0x8000011b
                ? KeyContext.Address
                : KeyContext.Identity;
            const account = (derivationPath[2] ?? 0x80000000) & 0x7fffffff;
            const keyIndex = (derivationPath[4] ?? 0) & 0x7fffffff;

            const derivedPublic = await api.keyGen(
                rootKey.privateKey,
                context,
                account,
                keyIndex,
                derivationType,
            );

            const id = options?.id ?? generateId();
            const keyData: KeyData = {
                id,
                type: "hd-derived-ed25519",
                algorithm: "EdDSA",
                extractable: false,
                publicKey: derivedPublic,
                metadata: {
                    ...options?.metadata,
                    derivationPath: path,
                    seedId: seedId,
                    context,
                    account,
                    keyIndex,
                }
            } as any;

            await commit({store, keyData});
            return id;
        }
    } finally {
        clearKeyData(rootKey)
        clearKeyData(derivedKey)
        setStatus({store, status: 'idle'})
    }




}

export async function importEd25519Key({store, keyData, seed}: {store: Store<KeyStoreState>, keyData: KeyData, seed?: SeedData}): Promise<KeyId> {
    setStatus({store, status: 'importing'})

    try {
        let isHD = typeof keyData.publicKey === 'undefined' && typeof keyData.privateKey === 'undefined';

        let publicKey = keyData.publicKey;

        // For Ed25519: derive public key from private key if not provided
        // The private key format is 64 bytes: [32 bytes seed || 32 bytes public key]
        if (!isHD && !publicKey && keyData.privateKey) {
            if (keyData.privateKey.length !== 64) {
                throw new InvalidKeyDataError(
                    "Ed25519 import requires publicKey or 64-byte combined key",
                );
            }
            publicKey = keyData.privateKey.slice(32);
        }

        if (!isHD && !publicKey) {
            throw new InvalidKeyDataError("Could not derive public key");
        }

        if(isHD && typeof seed?.privateKey === 'undefined'){
            throw new InvalidKeyDataError("XHD derived keys require a seed");
        } else {

        }

        await commit({store, keyData: {
                ...keyData,
                type: isHD ? "hd-derived-ed25519" : "ecc",
                publicKey,
                metadata: isHD ? {...keyData.metadata, rootKeyId: keyData.metadata?.rootKeyId ?? undefined} : keyData.metadata
            }});
        return keyData.id;

    } finally {
        clearBuffer(keyData.privateKey);
        delete keyData.privateKey;
        setStatus({store, status: 'idle'})
    }


}
export async function importPasskey({store, keyData}: {store: Store<KeyStoreState>, keyData: Omit<XHDPasskey, 'id'>}): Promise<KeyId> {
    if(keyData.algorithm !== "P-256"){
        throw new InvalidKeyDataError("Only P-256 derived keys are currently supported");
    }
    if(typeof keyData?.metadata?.rootKeyId === 'undefined'){
        throw new InvalidKeyDataError("XHD derived keys require a rootKeyId, please upload it first using importSeed()");
    }

    setStatus({store, status: 'importing'})

    let key = {
        id: generateId(),
        ...keyData,
        metadata: {
            ...keyData.metadata,
        }
    }

    try {
        // Get the seed from the root key ID
        let openKey = await fetchSecret<XHDRootKey>({keyId: keyData.metadata.rootKeyId})
        if(!openKey) throw new KeyNotFoundError(keyData.metadata.rootKeyId)
        // Check for the correct type
        if(typeof openKey.privateKey === "undefined"){
            throw new DecodingError("Could not decrypt root key")
        }
        if(openKey.type !== "hd-root-key"){
            // Clear the buffers
            clearBuffer(openKey.privateKey)
            delete openKey.privateKey

            throw new InvalidKeyDataError("Root key is not a seed key")
        }

        const keyPair = await dp256.genDomainSpecificKeyPair(openKey.privateKey, keyData.metadata.origin, keyData.metadata.userHandle, keyData.metadata.counter)
        key.publicKey = dp256.getPurePKBytes(keyPair)
        await commit({store, keyData: {
            ...key,
                publicKey: dp256.getPurePKBytes(openKey.privateKey),
                privateKey: keyPair
            }})


        // Cleanup the buffers
        clearBuffer(openKey.privateKey)
        delete openKey.privateKey
        clearBuffer(keyPair)


        // Notify the world we have a new key
        store.setState((state) => ({...state, keys: [key,...state.keys]}))

        return key.id;
    } finally {
        setStatus({store, status:'idle'})
    }

}
export async function importKey({store, keyData}: {
    store: Store<KeyStoreState>,
    keyData: Omit<KeyData, 'id'> | Uint8Array<ArrayBufferLike>,
    //format?: KeyFormat, // TODO: Align with Subtle's KeyFormat in the future?
    //algorithm?: Algorithm, // TODO: align with SubtleAlgorithm in the future?
    //extractable?: boolean, // TODO: align with SubtleExtractable in the future?
    //keyUsages: KeyUsage[] // TODO: leverage for keyData
}): Promise<KeyId> {
    if(keyData instanceof Uint8Array){
        // TODO: Check format and algorith for the key bytes to handle it appropriately
        // We only support our bespoke KeyData objects for now
        throw new InvalidKeyDataError("Importing raw or encoded keys is not currently supported");
    }
    // Ensure this is a KeyData object
    if(!(keyData as KeyData).type){
        throw new InvalidKeyFormatError("Only KeyData objects are allowed currently");
    }
    
    switch(keyData.type){
        case "hd-seed": {
            if(keyData.algorithm !== "raw" && keyData.format !== "raw"){
                throw new InvalidKeyDataError("Only supports importing raw seeds");
            } else {
                return importSeed({store, keyData: keyData as SeedData})
            }
        }
        case "hd-root-key":{
            return importSeed({store, keyData: keyData as SeedData})
        }
        case "hd-derived-ed25519": {
            if(keyData.algorithm !== "EdDSA" && keyData.format !== ""){

            }
            return importEd25519Key({store, keyData: keyData as SeedData})

        }
        case "hd-derived-passkey": {
            return importPasskey({store, keyData: keyData as XHDPasskey})
        }
        default: {
            throw new InvalidKeyDataError(`Unknown key type: ${keyData.type}`)
        }
    }
}

export async function exportKey({store, id}: {store: Store<KeyStoreState>, id: string, options?: any}): Promise<KeyData> {
    setStatus({store, status: 'exporting'})
    try {
        const key = await fetchSecret<KeyData>({keyId: id})
        if(!key) throw new KeyNotFoundError(id)
        console.log(key)
        if(!key.extractable){
            throw new InvalidKeyDataError("Cannot export an non-extractable key");
        }
        return key;
    }finally {
        setStatus({store, status: 'idle'})
    }

}

export async function decryptWithKey({store, id, data}: {store: Store<KeyStoreState>, id: KeyId, data: Uint8Array, algorithm?: string}): Promise<Uint8Array> {
    store.setState((s) => ({...s, status: 'decrypting'}))

    const key = await fetchSecret<KeyData>({keyId: id})
    if(!key) throw new KeyNotFoundError(id)

    const symmetricKey = crypto_generichash(32, key.publicKey!);
    const nonce = data.slice(0, 24);
    const ciphertext = data.slice(24);

    const decrypted = crypto_secretbox_open_easy(ciphertext, nonce, symmetricKey);
    if (!decrypted) throw new Error("Decryption failed");

    store.setState((s) => ({...s, status: 'idle'}))
    return decrypted;
}

export async function wrapKey(_options: {store: Store<KeyStoreState>, format: any, key: CryptoKey, wrappingKey: CryptoKey, wrapAlgorithm: EncryptDecryptParams}): Promise<ArrayBuffer> {
    throw new Error("Method not implemented.");
}

export async function unwrapKey(_options: {store: Store<KeyStoreState>, format: any, wrappedKey: BufferLike, unwrappingKey: CryptoKey, unwrapAlgorithm: EncryptDecryptParams, unwrappedKeyAlgorithm: SubtleAlgorithm, extractable: boolean, keyUsages: KeyUsage[]}): Promise<CryptoKey> {
    throw new Error("Method not implemented.");
}