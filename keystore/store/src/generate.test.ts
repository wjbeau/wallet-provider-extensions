import {
	BIP32DerivationType,
	KeyContext,
} from "@algorandfoundation/xhd-wallet-api";
import { describe, expect, it, vi } from "vitest";
import {
	generateKey,
	generateSeedData,
	generateXHDFromParent,
	generateXHDRootKeyFromSeed,
} from "./generate.ts";
import type { SeedData } from "./types/core.ts";


vi.mock("@algorandfoundation/wallet-provider", () => ({
	generateId: () => "mocked-id",
	clearBuffer: vi.fn(),
}));

describe("generate.ts", () => {
	it("generateSeedData creates a seed from mnemonic", async () => {
		const seed = (await generateSeedData({
			strength: 128,
		})) as SeedData;
		expect(seed.type).toBe("hd-seed");
		expect(seed.id).toBe("mocked-id");
		expect(seed.privateKey).toBeDefined();
		expect(seed.privateKey?.length).toBe(64);
	});

	it("generateXHDRootKeyFromSeed creates a rootKey from seed", async () => {
		const seed = {
			id: "seed-1",
			type: "hd-seed" as const,
			privateKey: new Uint8Array(64).fill(1),
			extractable: true,
			algorithm: "raw" as const,
		} as any;
		const rootKey = await generateXHDRootKeyFromSeed(seed);
		expect(rootKey.type).toBe("hd-root-key");
		expect(rootKey.metadata?.rootKeyId).toBe("seed-1");
		// Check that it's a valid 96-byte Ed25519 private key (seed + chain code + public key)
		expect(rootKey.privateKey?.length).toBe(96);
	});

	it("generateXHDFromParent creates a derived ed25519 key", async () => {
		const seedData = (await generateSeedData({
			strength: 128,
			// We can't easily force the mnemonic in generateSeedData without mocking bip39
			// but we can mock bip39 to return our TEST_MNEMONIC or just use the seed directly
		})) as SeedData;

		const rootKey = await generateXHDRootKeyFromSeed(seedData);

		const keyData = {
			type: "hd-derived-ed25519" as const,
			metadata: {
				context: KeyContext.Address,
				account: 0,
				index: 0,
				derivation: BIP32DerivationType.Peikert,
			},
		} as any;

		const derived = await generateXHDFromParent({ key: keyData, parentKey: rootKey });
		expect(derived.type).toBe("hd-derived-ed25519");
		expect(derived.metadata.parentKeyId).toBe(rootKey.id);
		expect(derived.publicKey).toBeDefined();
		expect(derived.publicKey?.length).toBe(32);
		expect(derived.metadata.address.algorand).toBeDefined();
	});

	it("generateKey routes to correct generators", async () => {
		const seedKeyData = {
			type: "hd-seed" as const,
			algorithm: "raw" as const,
			extractable: true,
			metadata: {},
		};
		const seed = (await generateKey({ keyData: seedKeyData })) as SeedData;
		expect(seed.type).toBe("hd-seed");

		const rootKeyData = {
			type: "hd-root-key" as const,
			algorithm: "raw" as const,
			extractable: true,
			metadata: { parentKeyId: "seed-1" },
		};
		const rootKey = await generateKey({
			keyData: rootKeyData,
			parentKey: seed,
		});
		expect(rootKey.type).toBe("hd-root-key");
	});
});
