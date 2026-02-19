import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock external crypto suite used by encrypt/decrypt to keep tests deterministic
vi.mock("@algorandfoundation/xhd-wallet-api/dist/sumo.facade.js", () => {
	return {
		crypto_generichash: (len: number, _input: Uint8Array) =>
			new Uint8Array(len).fill(2),
		crypto_secretbox_easy: (
			data: Uint8Array,
			_nonce: Uint8Array,
			_key: Uint8Array,
		) => {
			// simple XOR transform to emulate encryption deterministically
			const out = new Uint8Array(data.length);
			for (let i = 0; i < data.length; i++) out[i] = data[i] ^ 0x03;
			return out;
		},
		crypto_secretbox_open_easy: (
			cipher: Uint8Array,
			_nonce: Uint8Array,
			_key: Uint8Array,
		) => {
			const out = new Uint8Array(cipher.length);
			for (let i = 0; i < cipher.length; i++) out[i] = cipher[i] ^ 0x03;
			return out;
		},
	};
});

// Mock node:crypto's randomBytes to return a fixed nonce for deterministic output
vi.mock("node:crypto", async (orig) => {
	const actual: any = await (orig as any)();
	return {
		...actual,
		randomBytes: (len: number) =>
			new Uint8Array(Array.from({ length: len }, () => 1)),
		subtle: actual.subtle,
	};
});

import {
	clearKeyData,
	decryptWithKeyData,
	encryptWithKeyData,
} from "./crypto.ts";
import type { KeyData } from "./types/index.ts";

// Helpers
const makeUint8 = (arr: number[]) => new Uint8Array(arr);

describe("crypto.ts", () => {
	const origGetRandomValues = globalThis.crypto?.getRandomValues?.bind(
		globalThis.crypto,
	);

	beforeEach(() => {
		// deterministically stub webcrypto getRandomValues for generateId
		Object.defineProperty(globalThis, "crypto", {
			value: {
				...globalThis.crypto,
				getRandomValues: (buf: Uint8Array) => {
					for (let i = 0; i < buf.length; i++) buf[i] = i; // 00,01,02,...
					return buf;
				},
			},
			configurable: true,
		});
	});

	afterEach(() => {
		if (origGetRandomValues) {
			Object.defineProperty(globalThis, "crypto", {
				value: { ...globalThis.crypto, getRandomValues: origGetRandomValues },
				configurable: true,
			});
		}
		vi.clearAllMocks();
	});

	it("clearKeyData removes privateKey field if present", () => {
		const key: Partial<KeyData> = { privateKey: makeUint8([5, 6, 7]) } as any;
		clearKeyData(key);
		expect(key.privateKey).toBeUndefined();
	});

	it("encryptWithKeyData + decryptWithKeyData roundtrip", async () => {
		const key: KeyData = {
			id: "k1",
			type: "ecc",
			algorithm: "raw",
			extractable: false,
			publicKey: makeUint8([10, 11, 12]),
		};
		const plaintext = makeUint8([100, 101, 102]);

		const encrypted = await encryptWithKeyData({
			key: { ...key },
			data: plaintext,
		});
		// Expect nonce(24 bytes of 0x01) + transformed ciphertext
		expect((encrypted as Uint8Array).length).toBe(24 + plaintext.length);
		expect(Array.from((encrypted as Uint8Array).slice(0, 24))).toEqual(
			new Array(24).fill(1),
		);

		const decrypted = await decryptWithKeyData({
			key: { ...key },
			data: encrypted as Uint8Array,
		});
		expect(Array.from(decrypted as Uint8Array)).toEqual(Array.from(plaintext));
	});
});
