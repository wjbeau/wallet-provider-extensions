import { subtle } from "node:crypto";
import { clearKeyData } from "./crypto.ts";
import { xhd } from "./libs.ts";
import type { KeyData } from "./types/index.ts";

/**
 * Verifies a signature using the provided public key and data.
 *
 * @param params - The verification parameters.
 * @param params.key - The {@link KeyData} containing the public key.
 * @param params.data - The original data that was signed.
 * @param params.signature - The signature to verify.
 * @param params.algorithm - Optional algorithm to use.
 * @returns A promise that resolves to true if the signature is valid, false otherwise.
 */
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
		if (key.algorithm === "P256" || key.algorithm === "P-256") {
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
