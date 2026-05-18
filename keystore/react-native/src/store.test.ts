import type { KeyStoreState } from "@algorandfoundation/keystore";
import { Store } from "@tanstack/store";
import { describe, expect, it } from "vitest";
import { fetchSecret } from "./storage/state.ts";
import { importKey, importSeed, parsePath } from "./store.ts";

describe("react-native-keystore store.ts logic", () => {
  describe("parsePath", () => {
    it("should parse a standard BIP44 path", () => {
      const path = "m/44'/283'/0'/0/0";
      const result = parsePath(path);
      expect(result).toEqual([0x80000000 + 44, 0x80000000 + 283, 0x80000000 + 0, 0, 0]);
    });

    it("should handle paths without 'm/' prefix", () => {
      const path = "44'/283'/0'/0/1";
      const result = parsePath(path);
      expect(result).toEqual([0x80000000 + 44, 0x80000000 + 283, 0x80000000 + 0, 0, 1]);
    });

    it("should handle mixed hardened and non-hardened parts", () => {
      const path = "m/44'/283/0'/1/2";
      const result = parsePath(path);
      expect(result).toEqual([0x80000000 + 44, 283, 0x80000000 + 0, 1, 2]);
    });
  });

  describe("importSeed", () => {
    const store = new Store<KeyStoreState>({ keys: [], status: "idle" });

    it("should throw an error for mnemonic import as it is not implemented", async () => {
      const mnemonic =
        "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
      await expect(importSeed({ store, seed: mnemonic })).rejects.toThrow(
        "Mnemonic import is not implemented yet",
      );
    });

    it("should import a raw Uint8Array seed", async () => {
      const rawSeed = new Uint8Array(64);
      for (let i = 0; i < 64; i++) rawSeed[i] = i;
      const expectedHex = Buffer.from(rawSeed).toString("hex");
      const id = await importSeed({ store, seed: rawSeed, name: "Raw Seed" });

      expect(id).toBeDefined();

      // Verify it was committed to storage
      const committed = await fetchSecret<any>({ keyId: id });
      expect(committed).toMatchObject({
        type: "seed",
        name: "Raw Seed",
      });
      // Compare hex strings
      expect(Buffer.from(committed.privateKey).toString("hex")).toBe(expectedHex);
    });
  });

  describe("importKey", () => {
    const store = new Store<KeyStoreState>({ keys: [], status: "idle" });

    it("should throw for raw Uint8Array as first argument", async () => {
      const raw = new Uint8Array(32);
      await expect(importKey({ store, keyData: raw })).rejects.toThrow(
        "Importing raw or encoded keys is not currently supported. Use KeyData instead.",
      );
    });

    it("should throw for string as first argument", async () => {
      const mnemonic =
        "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
      await expect(importKey({ store, keyData: mnemonic })).rejects.toThrow(
        "Importing raw or encoded keys is not currently supported. Use KeyData instead.",
      );
    });

    it("should import a SeedData object with Uint8Array privateKey", async () => {
      const rawSeed = new Uint8Array(64);
      for (let i = 0; i < 64; i++) rawSeed[i] = i;
      const expectedHex = Buffer.from(rawSeed).toString("hex");
      const keyData = {
        id: "imported-key-id",
        type: "hd-seed" as const,
        algorithm: "raw" as const,
        format: "bytes" as const,
        extractable: true,
        keyUsages: ["deriveKey", "deriveBits"] as any,
        privateKey: rawSeed,
      };
      const id = await importKey({ store, keyData });
      expect(id).toBe("imported-key-id");

      const committed = await fetchSecret<any>({ keyId: id });
      // The legacy `hd-seed` input is normalised to the canonical `seed` type.
      expect(committed).toMatchObject({
        type: "seed",
      });
      // Compare hex strings
      expect(Buffer.from(committed.privateKey).toString("hex")).toBe(expectedHex);
    });

    it("should import a KeyData object with the canonical `seed` type", async () => {
      const rawSeed = new Uint8Array(64);
      for (let i = 0; i < 64; i++) rawSeed[i] = 64 - i;
      const expectedHex = Buffer.from(rawSeed).toString("hex");
      const keyData = {
        id: "imported-seed-id",
        type: "seed" as const,
        algorithm: "raw" as const,
        format: "bytes" as const,
        extractable: true,
        keyUsages: ["deriveKey", "deriveBits"] as any,
        privateKey: rawSeed,
      };
      const id = await importKey({ store, keyData });
      expect(id).toBe("imported-seed-id");

      const committed = await fetchSecret<any>({ keyId: id });
      expect(committed).toMatchObject({ type: "seed" });
      expect(Buffer.from(committed.privateKey).toString("hex")).toBe(expectedHex);
    });
  });
});
