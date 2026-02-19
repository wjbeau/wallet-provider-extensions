import { sha512_256 } from "@noble/hashes/sha2.js";
import { base32 } from "@scure/base";
import { describe, expect, it } from "vitest";
import { encodeAddress } from "./encoding.ts";

describe("encoding.ts", () => {
	it("encodeAddress computes base32 of pubkey+checksum", () => {
		const pub = new Uint8Array(32).fill(0xab);
		const checksum = sha512_256(pub).slice(-4);
		const expected = base32
			.encode(new Uint8Array([...pub, ...checksum]))
			.replace(/=+$/, "")
			.toUpperCase();
		expect(encodeAddress(pub)).toBe(expected);
	});
});
