import { describe, expect, it, vi } from "vitest";
import { generateKey, generateSeedData, generateXHDFromParent, generateXHDRootKeyFromSeed } from "./generate.ts";
import { KeyContext, BIP32DerivationType } from "@algorandfoundation/xhd-wallet-api";

// Mock internal dependencies to make generate deterministic or isolated
vi.mock("@scure/bip39", () => ({
    mnemonicToSeed: async (m: string) => new Uint8Array(new Array(64).fill(1)),
    generateMnemonic: () => "test mnemonic",
}));

vi.mock("@algorandfoundation/wallet-provider", () => ({
    generateId: () => "mocked-id",
    clearBuffer: vi.fn(),
}));

vi.mock("./libs.ts", () => ({
    xhd: {
        keyGen: async () => new Uint8Array([1, 2, 3]),
    },
    dp256: {
        genDomainSpecificKeyPair: async () => new Uint8Array([4, 5, 6]),
        getPurePKBytes: (pk: Uint8Array) => pk.slice(0, 2),
    },
}));

vi.mock("@algorandfoundation/xhd-wallet-api", async (orig) => {
    const actual: any = await orig();
    return {
        ...actual,
        fromSeed: () => new Uint8Array([7, 8, 9]),
    };
});

describe("generate.ts", () => {
    it("generateSeedData creates a seed with default strength", async () => {
        const seed = await generateSeedData();
        expect(seed.type).toBe("hd-seed");
        expect(seed.id).toBe("mocked-id");
        expect(seed.privateKey).toBeDefined();
        expect(seed.privateKey?.length).toBe(64);
    });

    it("generateXHDRootKeyFromSeed creates a root key from seed", async () => {
        const seed = {
            id: "seed-1",
            type: "hd-seed" as const,
            privateKey: new Uint8Array(64).fill(1),
        } as any;
        const rootKey = await generateXHDRootKeyFromSeed(seed);
        expect(rootKey.type).toBe("hd-root-key");
        expect(rootKey.metadata?.rootKeyId).toBe("seed-1");
        expect(rootKey.privateKey).toEqual(new Uint8Array([7, 8, 9]));
    });

    it("generateXHDFromParent creates a derived ed25519 key", async () => {
        const parentKey = {
            id: "root-1",
            type: "hd-root-key" as const,
            privateKey: new Uint8Array([7, 8, 9]),
        } as any;
        const keyData = {
            type: "hd-derived-ed25519" as const,
            metadata: {
                context: KeyContext.Address,
                account: 0,
                index: 0,
            }
        } as any;

        const derived = await generateXHDFromParent({ key: keyData, parentKey });
        expect(derived.type).toBe("hd-derived-ed25519");
        expect(derived.metadata.parentKeyId).toBe("root-1");
        expect(new Uint8Array(Object.values(derived.privateKey as any))).toEqual(new Uint8Array([1, 2, 3]));
    });

    it("generateKey routes to correct generators", async () => {
        const seedKeyData = {
            type: "hd-seed" as const,
            algorithm: "raw" as const,
            metadata: {}
        };
        const seed = await generateKey({ keyData: seedKeyData });
        expect(seed.type).toBe("hd-seed");

        const rootKeyData = {
            type: "hd-root-key" as const,
            algorithm: "raw" as const,
            metadata: { parentKeyId: "seed-1" }
        };
        const rootKey = await generateKey({ keyData: rootKeyData, parentKey: seed });
        expect(rootKey.type).toBe("hd-root-key");
    });
});
