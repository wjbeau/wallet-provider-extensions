import { sha512_256 } from "@noble/hashes/sha2.js";
import { base32 } from "@scure/base";

export function encodeAddress(publicKey: Uint8Array<ArrayBufferLike>): string {
	const hash = sha512_256(publicKey); // 32 bytes
	const checksum = hash.slice(-4); // last 4 bytes
	const addressBytes = new Uint8Array([...publicKey, ...checksum]);
	return base32.encode(addressBytes).replace(/=+$/, "").toUpperCase();
}
