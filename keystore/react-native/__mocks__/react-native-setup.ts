import crypto from "node:crypto";
import { vi } from "vitest";

// Polyfill global.crypto for @algorandfoundation/wallet-provider generateId()
if (typeof global.crypto === "undefined") {
  // @ts-expect-error
  global.crypto = crypto.webcrypto;
}

vi.mock("react-native-keychain", () => {
  let mockPassword = null;
  return {
    getGenericPassword: vi.fn(async () => mockPassword),
    setGenericPassword: vi.fn(async (username, password) => {
      mockPassword = { username, password };
    }),
  };
});
vi.mock("react-native-quick-crypto", () => ({
  ...crypto,
  randomBytes: (size: number) => crypto.randomBytes(size),
}));

vi.mock("react-native-mmkv", () => {
  const mockStorage = new Map();
  const createMock = () => ({
    set: vi.fn((key, value) => mockStorage.set(key, value)),
    getString: vi.fn((key) => mockStorage.get(key)),
    delete: vi.fn((key) => mockStorage.delete(key)),
    remove: vi.fn((key) => mockStorage.delete(key)),
    clearAll: vi.fn(() => mockStorage.clear()),
  });
  return {
    MMKV: vi.fn(() => createMock()),
    createMMKV: vi.fn(() => createMock()),
  };
});

vi.mock("react-native", () => ({
  Platform: {
    OS: "ios",
  },
}));
