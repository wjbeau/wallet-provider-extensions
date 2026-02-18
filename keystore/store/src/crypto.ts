import { randomBytes, subtle } from "node:crypto";
import { Encoding } from "@algorandfoundation/xhd-wallet-api";

import {
	crypto_generichash,
	crypto_secretbox_easy,
	crypto_secretbox_open_easy,
} from "@algorandfoundation/xhd-wallet-api/dist/sumo.facade.js";
import { InvalidKeyDataError } from "./errors.ts";
import type {
	KeyData,
	KeyId,
	XHDDerivedKeyData,
	XHDPasskey,
	XHDRootKey,
} from "./types/index.ts";
import {base32} from "@scure/base";
import {sha512_256} from "@noble/hashes/sha2.js";
import {dp256, xhd} from "./libs.ts";

/**
 * Generates a cryptographically secure random ID (hex string)
 * Uses the Web Crypto API's getRandomValues for secure randomness
 */
export function generateId(): KeyId {
	const bytes = new Uint8Array(16);
	crypto.getRandomValues(bytes);
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

/**
 * Securely clears sensitive data from memory by overwriting with zeros.
 * Use this after cryptographic operations to minimize key exposure.
 */
export function clearBuffer(data?: Uint8Array): void {
	if (data) {
		data.fill(0);
	}
}

export function clearKeyData(key?: Partial<KeyData> | null): void {
	if (
		key &&
		typeof key !== "undefined" &&
		typeof key.privateKey !== "undefined"
	) {
		clearBuffer(key.privateKey);
		delete key.privateKey;
	}
}

/**
 * Compares two byte arrays lexicographically.
 * Returns negative if a < b, positive if a > b, zero if equal.
 * Used for deterministic ordering in ECDH.
 */
export function compareBytes(a: Uint8Array, b: Uint8Array): number {
	const len = Math.min(a.length, b.length);
	for (let i = 0; i < len; i++) {
		if (a[i] !== b[i]) return a[i] - b[i];
	}
	return a.length - b.length;
}

export async function verifyWithKeyData({
	key,
	data,
	signature,
}: {
	key: KeyData;
	data: Uint8Array<ArrayBufferLike>;
	signature: Uint8Array<ArrayBufferLike>;
	algorithm?: string;
}): Promise<boolean> {
	try {
		if (typeof key.publicKey === "undefined") {
			throw new Error("Key does not have a public key");
		}

		// TODO: Switch case with bespoke handlers
		if (key.algorithm === "ES256" || key.algorithm === "P-256") {
			const fullPublicKey = new Uint8Array(65);
			fullPublicKey[0] = 0x04;
			fullPublicKey.set(key.publicKey, 1);

			const cryptoKey = await subtle.importKey(
				"raw",
				fullPublicKey,
				{ name: "ECDSA", namedCurve: "P-256" },
				false,
				["verify"],
			);
			return await subtle.verify(
				{ name: "ECDSA", hash: "SHA-256" },
				cryptoKey,
				new Uint8Array(signature),
				new Uint8Array(data),
			);
		}

		if (key.algorithm === "EdDSA") {
			return await xhd.verifyWithPublicKey(signature, data, key.publicKey);
		}

		throw new Error(
			`Algorithm ${key.algorithm} is not supported for verification`,
		);
	} finally {
		clearKeyData(key);
	}
}

export async function encryptWithKeyData({
	key,
	data,
}: {
	key: KeyData;
	data: Uint8Array;
	algorithm?: string;
}): Promise<Uint8Array<ArrayBufferLike>> {
	try {
		if (typeof key.publicKey === "undefined") {
			throw new InvalidKeyDataError("Key does not have a public key");
		}
		const symmetricKey = crypto_generichash(32, key.publicKey);
		const nonce = randomBytes(24);
		const ciphertext = crypto_secretbox_easy(data, nonce, symmetricKey);

		const result = new Uint8Array(24 + ciphertext.length);
		result.set(nonce, 0);
		result.set(ciphertext, 24);

		return result;
	} finally {
		clearKeyData(key);
	}
}

export async function decryptWithKeyData({
	key,
	data,
}: {
	key: KeyData;
	data: Uint8Array;
	algorithm?: string;
}): Promise<Uint8Array<ArrayBufferLike>> {
	try {
		if (typeof key.publicKey === "undefined") {
			throw new InvalidKeyDataError("Key does not have a public key");
		}
		const symmetricKey = crypto_generichash(32, key.publicKey);
		const nonce = data.slice(0, 24);
		const ciphertext = data.slice(24);

		const decrypted = crypto_secretbox_open_easy(
			ciphertext,
			nonce,
			symmetricKey,
		);
		if (!decrypted) throw new Error("Decryption failed");

		return decrypted;
	} finally {
		clearKeyData(key);
	}
}

export async function signXHDPasskey({
	key,
	root,
	data,
}: {
	key: XHDPasskey;
	root: XHDRootKey;
	data: Uint8Array;
}): Promise<Uint8Array<ArrayBufferLike>> {
	if (key.metadata?.passphraseId) {
		throw new InvalidKeyDataError(
			"Passphrase protected keys are not supported",
		);
	}

	if (key.type !== "hd-derived-passkey") {
		throw new InvalidKeyDataError("Key is not a passkey");
	}

	if (root.type !== "hd-root-key" || typeof root.privateKey === "undefined") {
		throw new InvalidKeyDataError("Root key is not a seed key");
	}

	try {
		return dp256.signWithDomainSpecificKeyPair(
			await dp256.genDomainSpecificKeyPair(
				root.privateKey,
				key.metadata.origin,
				key.metadata.userHandle,
				key.metadata.counter,
			),
			data,
		);
	} finally {
		clearKeyData(key);
		clearKeyData(root);
	}
}

export async function signXHDEd25519({
	key,
    root,
	data,
}: {
	key: XHDDerivedKeyData;
	root: XHDRootKey;
	data: Uint8Array;
}): Promise<Uint8Array<ArrayBufferLike>> {
	if (key.type !== "hd-derived-ed25519") {
		throw new InvalidKeyDataError("Key is not an Ed25519 key");
	}
	if (
		typeof key.metadata === "undefined" ||
		typeof key.metadata?.rootKeyId === "undefined"
	) {
		throw new InvalidKeyDataError("Key does not have a private key");
	}
	if (root.type !== "hd-root-key" || typeof root.privateKey === "undefined") {
		throw new InvalidKeyDataError("Root key is not a available");
	}

	if (key.metadata.rootKeyId !== root.id) {
		throw new InvalidKeyDataError("Root key does not match key ID");
	}

	try {
		return await xhd.signData(
			root.privateKey,
			key.metadata.context,
			key.metadata.account,
			key.metadata.index,
			data,
			{ encoding: Encoding.NONE, schema: {} },
			key.metadata.derivation,
		);
	} finally {
		clearKeyData(key);
		clearKeyData(root);
	}
}

export async function signWithKeyData({
	key,
	data,
	parentKey,
}: {
	key: KeyData;
	data: Uint8Array<ArrayBufferLike>;
	parentKey?: KeyData;
}): Promise<Uint8Array<ArrayBufferLike>> {
	try {
		switch (key.type) {
			case "hd-derived-ed25519": {
				if (typeof key.metadata?.rootKeyId === "undefined") {
					throw new InvalidKeyDataError(
						"Ed25519 key does not have a root key ID",
					);
				}
				if (typeof parentKey === "undefined") {
					throw new InvalidKeyDataError(
						"Ed25519 key does not have a parent key",
					);
				}
				if (key.metadata.rootKeyId !== parentKey.id) {
					throw new InvalidKeyDataError(
						"Parent key does not match root key ID",
					);
				}
				return signXHDEd25519({
					key: key as XHDDerivedKeyData,
					root: parentKey as XHDRootKey,
					data,
				});
			}
			case "hd-derived-passkey": {
				if (typeof key.metadata?.rootKeyId === "undefined") {
					throw new InvalidKeyDataError("Passkey does not have a root key ID");
				}
				if (typeof parentKey === "undefined") {
					throw new InvalidKeyDataError(
						"Passkey key does not have a parent key",
					);
				}
				if (key.metadata.rootKeyId !== parentKey.id) {
					throw new InvalidKeyDataError(
						"Parent key does not match root key ID",
					);
				}
				return signXHDPasskey({
					key: key as XHDPasskey,
					root: parentKey as XHDRootKey,
					data,
				});
			}
			default: {
				// TODO: fallback to subtle and adopt it's interfaces
				throw new InvalidKeyDataError(`Unknown key type: ${key.type}`);
			}
		}
	} finally {
		clearKeyData(key);
		clearKeyData(parentKey);
	}
}

export function encodeAddress(publicKey: Uint8Array<ArrayBufferLike>): string {
	const hash = sha512_256(publicKey); // 32 bytes
	const checksum = hash.slice(-4); // last 4 bytes
	const addressBytes = new Uint8Array([...publicKey, ...checksum]);
	return base32.encode(addressBytes).replace(/=+$/, '').toUpperCase();
}