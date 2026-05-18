import { describe, it, expect } from "vitest";
import { decodeAddress, toBase64URL, fromUrlSafe } from "./utils.ts";

describe("Keystore Extension Utils", () => {
  it("should decode an Algorand address", () => {
    // A known Algorand address: 737777777777777777777777777777777777777777777777777U7777XY
    // Public key should be all zeros (except for checksum)
    const address = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ";
    const { publicKey } = decodeAddress(address);
    expect(publicKey).toHaveLength(32);
    expect(publicKey.every((b) => b === 0)).toBe(true);
  });

  it("should encode to base64url", () => {
    const bytes = new Uint8Array([0, 1, 2, 3, 4, 5]);
    const encoded = toBase64URL(bytes);
    expect(encoded).toBe("AAECAwQF"); // No padding
  });

  it("should decode from base64url", () => {
    const encoded = "AAECAwQF";
    const decoded = fromUrlSafe(encoded);
    expect(decoded).toEqual(new Uint8Array([0, 1, 2, 3, 4, 5]));
  });

  it("should handle URL safe characters in base64url", () => {
    const bytes = new Uint8Array([251, 255, 191]); // Encodes to +/+ in regular base64, -_ in URL safe
    const encoded = toBase64URL(bytes);
    expect(encoded).toBe("-_-_");
    expect(fromUrlSafe(encoded)).toEqual(bytes);
  });
});
