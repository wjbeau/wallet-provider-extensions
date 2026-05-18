import { base32 } from "@scure/base";

/**
 * Decodes an Algorand address.
 * @param address - The Algorand address to decode.
 * @returns The public key and checksum.
 */
export function decodeAddress(address: string): { publicKey: Uint8Array; checksum: Uint8Array } {
  const decoded = base32.decode(address.toUpperCase() + "======");
  if (decoded.length !== 36) {
    throw new Error("Invalid address length");
  }
  return {
    publicKey: decoded.slice(0, 32),
    checksum: decoded.slice(32),
  };
}

/**
 * Encodes a buffer to base64url.
 * @param bytes - The bytes to encode.
 * @returns The base64url encoded string.
 */
export function toBase64URL(bytes: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * Decodes a base64url string to bytes.
 * @param base64url - The base64url string to decode.
 * @returns The decoded bytes.
 */
export function fromUrlSafe(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4;
  const padded = pad ? base64 + "=".repeat(4 - pad) : base64;
  return new Uint8Array(
    atob(padded)
      .split("")
      .map((c) => c.charCodeAt(0)),
  );
}
