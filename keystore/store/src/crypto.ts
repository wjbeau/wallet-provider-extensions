import { randomBytes } from "node:crypto";
import { clearBuffer } from "@algorandfoundation/wallet-provider";
import { KeyContext } from "@algorandfoundation/xhd-wallet-api";
import {
	crypto_generichash,
	crypto_secretbox_easy,
	crypto_secretbox_open_easy,
} from "@algorandfoundation/xhd-wallet-api/dist/sumo.facade.js";
import { InvalidKeyDataError } from "./errors.ts";
import type { Key, KeyData } from "./types/index.ts";

export const derivableTypes: string[] = [
	"hd-root-key",
	"hd-derived-ed25519",
	"hd-derived-p256",
];

export function requiresParentKey(key: Partial<Key>): boolean {
	return typeof key.type !== "undefined" && derivableTypes.includes(key.type);
}

/**
 * Clears sensitive key material from a KeyData object.
 *
 * @param key - The {@link KeyData} to clear. If null or undefined, does nothing.
 */
export function clearKeyData(key?: Partial<KeyData> | null): void {
	if (
		key &&
		typeof key !== "undefined" &&
		typeof key.privateKey !== "undefined" &&
		key.privateKey instanceof Uint8Array
	) {
		clearBuffer(key.privateKey);
		delete key.privateKey;
	}
}

/**
 * Hardens a number for BIP32 derivation (adds 0x80000000).
 * @param num - The index to harden
 * @returns The hardened index
 */
export const harden = (num: number): number => 0x80_00_00_00 + num;

/**
 * Generates a BIP44 path based on the key context, account, and index.
 * @param context - The {@link KeyContext} (e.g., Address or Identity)
 * @param account - The account index
 * @param key_index - The key index
 * @returns An array of hardened and unhardened path components
 * @throws Error if context is invalid
 */
export function getBIP44PathFromContext(
	context: KeyContext,
	account: number,
	key_index: number,
): number[] {
	switch (context) {
		case KeyContext.Address:
			return [harden(44), harden(283), harden(account), 0, key_index];
		case KeyContext.Identity:
			return [harden(44), harden(0), harden(account), 0, key_index];
		default:
			throw Error("Invalid context");
	}
}

/**
 * Encrypts data using the provided public key.
 *
 * @param params - The encryption parameters.
 * @param params.key - The {@link KeyData} containing the public key.
 * @param params.data - The plaintext data to encrypt.
 * @param params.algorithm - Optional algorithm to use.
 * @returns A promise that resolves to the encrypted data (ciphertext).
 */
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

/**
 * Decrypts data using the provided secret key.
 *
 * @param params - The decryption parameters.
 * @param params.key - The {@link KeyData} containing the secret key.
 * @param params.data - The ciphertext to decrypt.
 * @param params.algorithm - Optional algorithm to use.
 * @returns A promise that resolves to the decrypted data (plaintext).
 */
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
