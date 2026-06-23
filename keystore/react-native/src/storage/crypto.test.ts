import * as Keychain from "react-native-keychain";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { decryptData, encryptData, getMasterKey } from "./crypto.js";

describe("crypto storage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should retrieve or generate a master key", async () => {
    const key = await getMasterKey();
    expect(key).toBeInstanceOf(Buffer);
    expect(key.length).toBe(32);
  });

  it("should encrypt and decrypt data", () => {
    const key = Buffer.alloc(32, 1);
    const data = "secret-message";
    const encrypted = encryptData(key, data);
    const decrypted = decryptData(key, encrypted);
    expect(decrypted).toBe(data);
  });

  it("should use stored key if available", async () => {
    const storedKey = Buffer.alloc(32, 2).toString("hex");
    vi.mocked(Keychain.getGenericPassword).mockResolvedValueOnce({
      password: storedKey,
      username: "master",
      service: "app-secret",
      storage: "best",
    });

    const key = await getMasterKey();
    expect(key.toString("hex")).toBe(storedKey);
  });

  it("should reuse a recently authenticated biometric master key", async () => {
    const storedKey = Buffer.alloc(32, 3).toString("hex");
    vi.mocked(Keychain.getGenericPassword).mockResolvedValueOnce({
      password: storedKey,
      username: "master",
      service: "app-secret",
      storage: "best",
    });

    const firstKey = await getMasterKey({ biometrics: true });
    firstKey.fill(0);

    const secondKey = await getMasterKey({ biometrics: true });

    expect(Keychain.getGenericPassword).toHaveBeenCalledOnce();
    expect(secondKey.toString("hex")).toBe(storedKey);
  });
});
