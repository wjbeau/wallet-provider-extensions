import { afterEach, describe, expect, it, vi } from "vitest";
import { signWithKeyData, signXHDEd25519, signXHDPasskey } from "./sign.ts";
import type {
	XHDDerivedKeyData,
	XHDPasskey,
	XHDRootKey,
} from "./types/index.ts";

// Mock libs.ts providers used by sign paths
vi.mock("./libs.ts", () => {
	return {
		xhd: {
			signData: vi.fn(
				async (
					_root: Uint8Array,
					_ctx: number,
					_acct: number,
					_idx: number,
					_data: Uint8Array,
				) => new Uint8Array([9, 9]),
			),
		},
		dp256: {
			genDomainSpecificKeyPair: vi.fn(
				async (
					_root: Uint8Array,
					_origin: string,
					_user: string,
					_counter?: number,
				) => ({ kp: "generated" }) as any,
			),
			signWithDomainSpecificKeyPair: vi.fn(
				async (_kp: any, _data: Uint8Array) => new Uint8Array([7]),
			),
		},
	};
});

describe("sign.ts", () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	const makeUint8 = (arr: number[]) => new Uint8Array(arr);

	it("signXHDEd25519 signs using xhd.signData and clears root privateKey", async () => {
		const root: XHDRootKey = {
			id: "root-1",
			type: "hd-root-key",
			algorithm: "raw",
			extractable: false,
			privateKey: makeUint8([1, 1, 1]),
		};
		const key: XHDDerivedKeyData = {
			id: "d1",
			type: "hd-derived-ed25519",
			algorithm: "EdDSA",
			extractable: false,
			metadata: {
				path: "",
				account: 0,
				context: 1,
				index: 2,
				derivation: 3,
				parentKeyId: "root-1",
			},
		} as any;

		const sig = await signXHDEd25519({
			key,
			root,
			data: makeUint8([4, 5, 6]),
		});
		expect(Array.from(sig as Uint8Array)).toEqual([9, 9]);
		// root privateKey must be cleared by finally
		expect(root.privateKey).toBeUndefined();
	});

	it("signXHDPasskey uses dp256 and clears root privateKey", async () => {
		const root: XHDRootKey = {
			id: "root-2",
			type: "hd-root-key",
			algorithm: "raw",
			extractable: false,
			privateKey: makeUint8([2, 2, 2]),
		};
		const key: XHDPasskey = {
			id: "p1",
			type: "hd-derived-passkey",
			algorithm: "P-256",
			extractable: false,
			metadata: {
				origin: "https://example.com",
				userHandle: "user",
				counter: 1,
				parentKeyId: "root-2",
			},
		} as any;

		const sig = await signXHDPasskey({
			key,
			root,
			data: makeUint8([7, 7]),
		});
		expect(Array.from(sig as Uint8Array)).toEqual([7]);
		expect(root.privateKey).toBeUndefined();
	});

	it("signWithKeyData routes to correct signer for ed25519 and passkey", async () => {
		const root: XHDRootKey = {
			id: "root-3",
			type: "hd-root-key",
			algorithm: "raw",
			extractable: false,
			privateKey: makeUint8([3, 3, 3]),
		};
		const edKey: XHDDerivedKeyData = {
			id: "ed1",
			type: "hd-derived-ed25519",
			algorithm: "EdDSA",
			extractable: false,
			metadata: {
				path: "",
				account: 0,
				context: 1,
				index: 2,
				derivation: 3,
				parentKeyId: "root-3",
			},
		} as any;

		const passKey: XHDPasskey = {
			id: "pk1",
			type: "hd-derived-passkey",
			algorithm: "P-256",
			extractable: false,
			metadata: { origin: "o", userHandle: "u", parentKeyId: "root-3" },
		} as any;

		const sig1 = await signWithKeyData({
			key: { ...edKey },
			parentKey: { ...root },
			data: makeUint8([1]),
		});
		expect(Array.from(sig1 as Uint8Array)).toEqual([9, 9]);

		// reset root private key for next call
		root.privateKey = makeUint8([3, 3, 3]);

		const sig2 = await signWithKeyData({
			key: { ...passKey },
			parentKey: { ...root },
			data: makeUint8([2]),
		});
		expect(Array.from(sig2 as Uint8Array)).toEqual([7]);
	});

	it("signWithKeyData throws for unknown key type", async () => {
		const key = {
			id: "k1",
			type: "unknown",
			algorithm: "raw",
		} as any;
		await expect(
			signWithKeyData({
				key,
				data: makeUint8([1]),
			}),
		).rejects.toThrow("Unknown key type: unknown");
	});

	it("signXHDEd25519 throws if rootKeyId mismatch", async () => {
		const root: XHDRootKey = {
			id: "root-1",
			type: "hd-root-key",
			algorithm: "raw",
			privateKey: makeUint8([1]),
		} as any;
		const key: XHDDerivedKeyData = {
			id: "d1",
			type: "hd-derived-ed25519",
			metadata: {
				parentKeyId: "mismatch",
			},
		} as any;

		await expect(
			signXHDEd25519({
				key,
				root,
				data: makeUint8([1]),
			}),
		).rejects.toThrow("Root key does not match key ID");
	});
});
