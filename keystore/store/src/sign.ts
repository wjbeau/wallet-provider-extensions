import { Encoding } from "@algorandfoundation/xhd-wallet-api";
import { clearKeyData } from "./crypto.ts";
import { InvalidKeyDataError } from "./errors.ts";
import { dp256, xhd } from "./libs.ts";
import type {
	KeyData,
	XHDDerivedKeyData,
	XHDDomainP256KeyData,
	XHDRootKey,
} from "./types/index.ts";

export async function signXHDDomainP256KeyData({
	key,
	root,
	data,
}: {
	key: XHDDomainP256KeyData;
	root: XHDRootKey;
	data: Uint8Array;
}): Promise<Uint8Array<ArrayBufferLike>> {
	if (key.metadata?.passphraseId) {
		throw new InvalidKeyDataError(
			"Passphrase protected keys are not supported",
		);
	}

	if (key.type !== "hd-derived-p256") {
		throw new InvalidKeyDataError("Key is not a P256 key");
	}

	if (
		root.type !== "hd-root-key" ||
		typeof root.privateKey === "undefined" ||
		!(root.privateKey instanceof Uint8Array)
	) {
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
		typeof key.metadata?.parentKeyId === "undefined"
	) {
		throw new InvalidKeyDataError("Key does not have a private key");
	}
	if (
		root.type !== "hd-root-key" ||
		typeof root.privateKey === "undefined" ||
		!(root.privateKey instanceof Uint8Array)
	) {
		throw new InvalidKeyDataError("Root key is not available");
	}

	if (key.metadata.parentKeyId !== root.id) {
		throw new InvalidKeyDataError("Root key does not match key ID");
	}

	try {
		//@ts-expect-error, we are accessing a private field to reduce complexity
		return await xhd.rawSign(
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

/**
 * Signs data using the provided key data and optional parent key for HD derivation.
 *
 * @param params - The signing parameters.
 * @param params.key - The {@link KeyData} containing the private key.
 * @param params.data - The data to sign.
 * @param params.parentKey - Optional parent {@link KeyData} for HD derivation.
 * @returns A promise that resolves to the signature.
 */
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
				if (typeof key.metadata?.parentKeyId === "undefined") {
					throw new InvalidKeyDataError(
						"Ed25519 key does not have a parent key ID",
					);
				}
				if (typeof parentKey === "undefined") {
					throw new InvalidKeyDataError(
						"Ed25519 key does not have a parent key",
					);
				}
				if (key.metadata.parentKeyId !== parentKey.id) {
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
			case "hd-derived-p256": {
				if (typeof key.metadata?.parentKeyId === "undefined") {
					throw new InvalidKeyDataError(
						"P256 key does not have a parent key ID",
					);
				}
				if (typeof parentKey === "undefined") {
					throw new InvalidKeyDataError("P256 key does not have a parent key");
				}
				if (key.metadata.parentKeyId !== parentKey.id) {
					throw new InvalidKeyDataError(
						"Parent key does not match root key ID",
					);
				}
				return signXHDDomainP256KeyData({
					key: key as XHDDomainP256KeyData,
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
