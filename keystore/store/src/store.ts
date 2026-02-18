import type { Store } from "@tanstack/store";
import {
	clearKeyData,
	decryptWithKeyData,
	encryptWithKeyData,
	signWithKeyData,
	verifyWithKeyData,
} from "./crypto.ts";
import type { Key, KeyData, KeyId, KeyStoreState } from "./types/index.ts";

/**
 * Adds a key to the store.
 *
 * @param store
 * @param key - The {@link Key} to add.
 */
export function addKey(store: Store<KeyStoreState>, key: Key): void {
	store.setState((s) => ({ ...s, keys: [...s.keys, key] }));
}

/**
 * Removes a key from the store by its ID.
 *
 * @param store
 * @param id - The {@link KeyId} of the key to remove.
 */
export function removeKey({
	store,
	id,
}: {
	store: Store<KeyStoreState>;
	id: KeyId;
}): void {
	store.setState((s) => ({ ...s, keys: s.keys.filter((k) => k.id !== id) }));
}

/**
 * Sets the current status of the keystore.
 *
 * @param store
 * @param status - A string representing the current operation (e.g., "signing", "generating").
 */
export function setStatus({
	store,
	status,
}: {
	store: Store<KeyStoreState>;
	status: string;
}): void {
	store.setState((s) => ({ ...s, status }));
}

/**
 * Clears all keys from the store and resets status to "idle".
 */
export function clearKeyStore({
	store,
}: {
	store: Store<KeyStoreState>;
}): void {
	store.setState({ keys: [], status: "idle" });
}

/**
 * Retrieves a key from the store by its ID.
 *
 * @param store
 * @param id - The {@link KeyId} of the key to retrieve.
 * @returns The {@link Key} if found, otherwise undefined.
 */
export function getKey({
	store,
	id,
}: {
	store: Store<KeyStoreState>;
	id: KeyId;
}): Key | undefined {
	return store.state.keys.find((k) => k.id === id);
}

/**
 * Initializes the keystore with a list of keys.
 * @param store
 * @param keys
 */
export function initializeKeyStore({
	store,
	keys,
}: {
	store: Store<KeyStoreState, any>;
	keys: Key[];
}): void {
	store.setState({ keys, status: "idle" });
}

export async function encrypt({
	store,
	key,
	data,
	algorithm,
}: {
	store: Store<KeyStoreState>;
	key: KeyData;
	data: Uint8Array;
	algorithm?: string;
}): Promise<Uint8Array> {
	setStatus({ store, status: "encrypting" });
	try {
		return encryptWithKeyData({ key, data, algorithm });
	} finally {
		clearKeyData(key);
		setStatus({ store, status: "idle" });
	}
}

export async function decrypt({
	store,
	key,
	data,
}: {
	store: Store<KeyStoreState>;
	key: KeyData;
	data: Uint8Array<ArrayBufferLike>;
	algorithm?: string;
}): Promise<Uint8Array<ArrayBufferLike>> {
	setStatus({ store, status: "decrypting" });
	try {
		return decryptWithKeyData({ key, data });
	} finally {
		clearKeyData(key);
		setStatus({ store, status: "idle" });
	}
}

export async function verify({
	store,
	key,
	data,
	signature,
}: {
	store: Store<KeyStoreState>;
	key: KeyData;
	data: Uint8Array<ArrayBufferLike>;
	signature: Uint8Array<ArrayBufferLike>;
	algorithm?: string;
}): Promise<boolean> {
	setStatus({ store, status: "verifying" });
	try {
		return verifyWithKeyData({ key, data, signature });
	} finally {
		clearKeyData(key);
		setStatus({ store, status: "idle" });
	}
}

export async function sign({
	store,
	key,
	parentKey,
	data,
}: {
	store: Store<KeyStoreState>;
	key: KeyData;
	parentKey?: KeyData;
	data: Uint8Array;
	algorithm?: string;
}): Promise<Uint8Array> {
	setStatus({ store, status: "signing" });
	try {
		return signWithKeyData({ key, data, parentKey });
	} finally {
		clearKeyData(key);
		clearKeyData(parentKey);
		setStatus({ store, status: "idle" });
	}
}
