import { describe, expect, it } from "vitest";
import { generateKey, generateSeedData, generateXHDRootKeyFromSeed } from "./generate.ts";
import { signWithKeyData, signXHDDomainP256KeyData, signXHDEd25519 } from "./sign.ts";
import type { SeedData, XHDDerivedKeyData, XHDDomainP256KeyData } from "./types/index.ts";

describe("sign.ts", () => {
  const makeUint8 = (arr: number[]) => new Uint8Array(arr);

  async function setupKeys() {
    const seedData = (await generateSeedData({
      strength: 128,
    })) as SeedData;

    // Deep clone to prevent original from being cleared
    const rootKey = await generateXHDRootKeyFromSeed({
      ...seedData,
      privateKey: new Uint8Array(seedData.privateKey as Uint8Array),
    });

    const edKey = (await generateKey({
      keyData: {
        type: "hd-derived-ed25519",
        algorithm: "EdDSA",
        metadata: {
          account: 0,
          index: 0,
          context: 0,
          parentKeyId: rootKey.id,
        },
      },
      parentKey: {
        ...rootKey,
        privateKey: new Uint8Array(rootKey.privateKey as Uint8Array),
      },
    })) as XHDDerivedKeyData;

    const p256Key = (await generateKey({
      keyData: {
        type: "hd-derived-p256",
        algorithm: "P256",
        metadata: {
          origin: "https://example.com",
          userHandle: "user",
          parentKeyId: rootKey.id,
        },
      },
      parentKey: {
        ...rootKey,
        privateKey: new Uint8Array(rootKey.privateKey as Uint8Array),
      },
    })) as XHDDomainP256KeyData;

    return { rootKey, edKey, p256Key, seedData };
  }

  it("signXHDEd25519 signs using real xhd and clears root privateKey", async () => {
    const { rootKey, edKey } = await setupKeys();

    const data = makeUint8([1, 2, 3]);
    const sig = await signXHDEd25519({
      key: edKey,
      root: rootKey,
      data,
    });

    expect(sig).toBeDefined();
    expect(sig?.length).toBe(64);
    // root privateKey must be cleared by finally
    expect(rootKey.privateKey).toBeUndefined();
  });

  it("signXHDDomainP256KeyData uses real dp256 and clears root privateKey", async () => {
    const { rootKey, p256Key } = await setupKeys();

    const data = makeUint8([7, 7]);
    const sig = await signXHDDomainP256KeyData({
      key: p256Key,
      root: rootKey,
      data,
    });

    expect(sig).toBeDefined();
    // ECDSA P-256 signature length can vary but is usually around 70-72 bytes in DER or 64 in raw
    // The library likely returns raw 64 bytes
    expect(sig?.length).toBe(64);
    expect(rootKey.privateKey).toBeUndefined();
  });

  it("signWithKeyData routes to correct signer for ed25519 and P256", async () => {
    const { rootKey, edKey, p256Key, seedData } = await setupKeys();

    const sig1 = await signWithKeyData({
      key: edKey,
      parentKey: rootKey,
      data: makeUint8([1]),
    });
    expect(sig1?.length).toBe(64);

    // Re-setup keys because rootKey.privateKey was cleared
    const rootKey2 = await generateXHDRootKeyFromSeed({
      ...seedData,
      privateKey: new Uint8Array(seedData.privateKey as Uint8Array),
    });
    // Since generateXHDRootKeyFromSeed generates a random ID, we need to update the key's metadata
    // or manually set the ID.
    (rootKey2 as any).id = p256Key.metadata.parentKeyId;

    const sig2 = await signWithKeyData({
      key: p256Key,
      parentKey: rootKey2,
      data: makeUint8([2]),
    });
    expect(sig2?.length).toBe(64);
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
    const { rootKey, edKey } = await setupKeys();
    const malformedKey = {
      ...edKey,
      metadata: {
        ...edKey.metadata,
        parentKeyId: "mismatch",
      },
    };

    await expect(
      signXHDEd25519({
        key: malformedKey,
        root: rootKey,
        data: makeUint8([1]),
      }),
    ).rejects.toThrow("Root key does not match key ID");
  });
});
