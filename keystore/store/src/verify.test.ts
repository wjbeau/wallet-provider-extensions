import { afterEach, describe, expect, it, vi } from "vitest";
import type { KeyData } from "./types/index.ts";
import { verifyWithKeyData } from "./verify.ts";

// Mock libs.ts providers used by verify paths
vi.mock("./libs.ts", () => {
	return {
		xhd: {
			verifyWithPublicKey: vi.fn(
				async (_sig: Uint8Array, _data: Uint8Array, _pub: Uint8Array) => true,
			),
		},
		dp256: {
			genDomainSpecificKeyPair: vi.fn(),
			signWithDomainSpecificKeyPair: vi.fn(),
		},
	};
});

// Mock subtle crypto for P-256
vi.mock("node:crypto", async (orig) => {
	const actual: any = await (orig as any)();
	return {
		...actual,
		subtle: {
			importKey: vi.fn(async () => ({})),
			verify: vi.fn(async () => true),
		},
	};
});

describe("verify.ts", () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	const makeUint8 = (arr: number[]) => new Uint8Array(arr);

	it("verifyWithKeyData (EdDSA path) delegates to xhd.verifyWithPublicKey", async () => {
		const { xhd } = await import("./libs.ts");
		const key: KeyData = {
			id: "k2",
			type: "ecc",
			algorithm: "EdDSA",
			extractable: true,
			publicKey: makeUint8([1, 2, 3, 4]),
		};
		const ok = await verifyWithKeyData({
			key: { ...key },
			data: makeUint8([8, 8]),
			signature: makeUint8([9, 9]),
		});
		expect(ok).toBe(true);
		expect(xhd.verifyWithPublicKey).toHaveBeenCalled();
	});

	it("verifyWithKeyData (P-256 path) delegates to subtle.verify", async () => {
		const { subtle } = await import("node:crypto");
		const key: KeyData = {
			id: "k3",
			type: "ecc",
			algorithm: "P-256",
			extractable: true,
			publicKey: new Uint8Array(64).fill(1),
		};
		const ok = await verifyWithKeyData({
			key: { ...key },
			data: makeUint8([8, 8]),
			signature: makeUint8([9, 9]),
		});
		expect(ok).toBe(true);
		expect(subtle.verify).toHaveBeenCalled();
	});

	it("verifyWithKeyData throws if no public key", async () => {
		const key: KeyData = {
			id: "k4",
			type: "ecc",
			algorithm: "EdDSA",
			extractable: true,
		} as any;
		await expect(
			verifyWithKeyData({
				key,
				data: makeUint8([1]),
				signature: makeUint8([2]),
			}),
		).rejects.toThrow("Key does not have a public key");
	});

	it("verifyWithKeyData throws if algorithm not supported", async () => {
		const key: KeyData = {
			id: "k5",
			type: "ecc",
			algorithm: "UNKNOWN",
			extractable: true,
			publicKey: makeUint8([1]),
		} as any;
		await expect(
			verifyWithKeyData({
				key,
				data: makeUint8([1]),
				signature: makeUint8([2]),
			}),
		).rejects.toThrow("Algorithm UNKNOWN is not supported for verification");
	});
});
