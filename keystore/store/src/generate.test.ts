import { BIP32DerivationType, KeyContext } from "@algorandfoundation/xhd-wallet-api";
import { describe, expect, it, vi } from "vitest";
import {
  generateKey,
  generateSeedData,
  generateXHDFromParent,
  generateXHDRootKeyFromSeed,
} from "./generate.ts";
import type { SeedData, XHDDomainP256KeyData, XHDRootKey } from "./types/core.ts";

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

    const derived = await generateXHDFromParent({
      key: keyData,
      parentKey: rootKey,
    });
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

    const p256KeyData = {
      type: "hd-derived-p256" as const,
      algorithm: "P256" as const,
      extractable: true,
      metadata: { parentKeyId: rootKey.id },
    };
    const p256Key = await generateKey({
      keyData: p256KeyData,
      parentKey: rootKey,
    });
    expect(p256Key.type).toBe("hd-derived-p256");
    expect(p256Key.algorithm).toBe("P256");
  });

  it("generateKey creates deterministic P256 keys from same seed", async () => {
    const seedPrivateKey = new Uint8Array(64).fill(0x42);
    const seed: SeedData = {
      id: "seed-1",
      type: "hd-seed",
      algorithm: "raw",
      extractable: true,
      privateKey: seedPrivateKey,
      metadata: {},
    } as any;

    const generateDeterministicP256 = async (s: SeedData) => {
      const rootKey = (await generateKey({
        keyData: {
          type: "hd-root-key",
          algorithm: "raw",
          extractable: true,
          metadata: { parentKeyId: s.id },
        },
        parentKey: s,
      })) as XHDRootKey;
      const p256Key = (await generateKey({
        keyData: {
          type: "hd-derived-p256",
          algorithm: "P256",
          extractable: true,
          metadata: {
            parentKeyId: rootKey.id,
            origin: "test.com",
            userHandle: "user-1",
          },
        },
        parentKey: rootKey,
      })) as XHDDomainP256KeyData;
      return p256Key;
    };

    const key1 = await generateDeterministicP256(seed);
    // Need to provide a fresh copy of seed because generateKey might clear it
    const seed2: SeedData = {
      ...seed,
      privateKey: new Uint8Array(seedPrivateKey),
    };
    const key2 = await generateDeterministicP256(seed2);

    expect(key1.publicKey).toEqual(key2.publicKey);
    expect(key1.privateKey).toEqual(key2.privateKey);
    expect(key1.publicKey).toBeDefined();
  });
});
