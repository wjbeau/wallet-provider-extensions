import {
    clearBuffer,
    type KeyData,
    type KeyId,
    type KeyStoreState, setStatus
} from "@algorandfoundation/keystore";
import {createMMKV} from "react-native-mmkv";
// import {base64url} from "@scure/base";
import {decryptData, encryptData, getMasterKey} from "./crypto.ts";
import type {Store} from "@tanstack/store";
import {base64url} from "@scure/base";

export const storage = createMMKV({
    id: 'keystore',
    //encryptionKey: 'hunter2',
    // mode: 'single-process'
});


/**
 * Fetches a secret from persistent storage and decrypts it using the master key.
 * @param params.keyId - The ID of the key to fetch
 * @param params.masterKey - Optional master key override
 * @returns The decrypted secret data or null if not found
 */
export async function fetchSecret<T>({keyId, masterKey}: {keyId: KeyId, masterKey?: Buffer}): Promise<T | null>{
    try {
        const encryptedSeed = storage.getString(keyId)
        if (!encryptedSeed) return null
        return decode(decryptData(masterKey ? masterKey : await getMasterKey(), encryptedSeed)) as T
    } finally {
        clearBuffer(masterKey)
    }
}

/**
 * Removes a secret from persistent storage.
 * @param params.keyId - The ID of the key to remove
 */
export async function removeSecret({keyId}: {keyId: KeyId}): Promise<void>{
    storage.remove(keyId)
}

/**
 * Commits a key to persistent storage and updates the reactive store.
 * The private key is encrypted before storage and cleared from memory.
 * @param params.store - The reactive store instance
 * @param params.keyData - The key data to store
 */
export async function commit({store, keyData}: {store: Store<KeyStoreState>, keyData: KeyData}): Promise<void> {
    setStatus({store, status: 'commiting'})
    try {
        // Never allow the master key to touch memory.
        storage.set(keyData.id, encryptData(await getMasterKey(), encode(keyData)))

        // clear then delete the keys from the keyData object to remove it from memory, even from the caller 😈
        clearBuffer(keyData.privateKey);
        delete keyData.privateKey;
        delete keyData.publicKey;

        // Reflect the change in the reactive store
        store.setState((state) => ({...state,keys: [{...keyData},...state.keys]}))
    } finally {
        setStatus({store, status: 'idle'})
    }
}

export function encode(key: KeyData){
    const encoder = new TextEncoder();
    return base64url.encode(encoder.encode(JSON.stringify(key)))
}
export function decode(data: string): KeyData {
    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(base64url.decode(data)))
}