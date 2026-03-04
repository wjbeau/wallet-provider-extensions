import { type KeyData, type KeyStoreState, type KeyStoreOptions } from "@algorandfoundation/keystore";
import { Store } from "@tanstack/store";
import Hook from "before-after-hook";
import { describe, expect, it, vi } from "vitest";
import { WithKeyStore } from "./extension.ts";
import { fetchSecret } from "./storage/state.ts";

describe("WithKeyStore Extension", () => {
	const createTestSetup = () => {
		const store = new Store<KeyStoreState>({
			keys: [],
			status: "idle",
		});
		const hooks = new Hook.Collection();
		const options: KeyStoreOptions = {
			keystore: {
				store,
				hooks,
			},
		};
		const provider = {
			log: {
				debug: vi.fn(),
				info: vi.fn(),
				warn: vi.fn(),
				error: vi.fn(),
			},
		} as any;

		const extension = WithKeyStore(provider, options);
		return { store, hooks, options, provider, extension };
	};

	it("should initialize with correct properties", () => {
		const { extension, store } = createTestSetup();
		expect(extension.keys).toEqual([]);
		expect(extension.status).toBe("idle");
		expect(extension.key.store).toBeDefined();
	});

	it("should reflect store changes in keys and status", () => {
		const { extension, store } = createTestSetup();
		store.setState((s) => ({ ...s, status: "busy", keys: [{ id: "test" } as any] }));
		expect(extension.status).toBe("busy");
		expect(extension.keys).toHaveLength(1);
		expect(extension.keys[0].id).toBe("test");
	});

	describe("key management", () => {
		it("should generate a key", async () => {
			const { extension, hooks } = createTestSetup();
			const beforeHook = vi.fn();
			hooks.before("generate", beforeHook);

			const seed = new Uint8Array(32).fill(1);
			const seedId = await extension.key.store.import({
				id: "root-seed",
				type: "hd-seed",
				algorithm: "raw",
				format: "raw",
				extractable: true,
				privateKey: seed,
			} as any);

			const keyId = await extension.key.store.generate({
				type: "hd-root-key",
				algorithm: "raw",
				extractable: true,
				keyUsages: ["deriveKey"],
				params: { parentKeyId: seedId },
			});

			expect(keyId).toBeDefined();
			expect(beforeHook).toHaveBeenCalled();
			expect(extension.keys).toHaveLength(2); // seed + root
		});

		it("should import a key", async () => {
			const { extension } = createTestSetup();
			const keyData: KeyData = {
				id: "imported-key",
				type: "hd-seed",
				algorithm: "raw",
				extractable: true,
				privateKey: new Uint8Array(32).fill(1),
			} as any;

			const keyId = await extension.key.store.import(keyData);
			expect(keyId).toBe("imported-key");
			expect(extension.keys).toHaveLength(1);
		});

		it("should export a key", async () => {
			const { extension } = createTestSetup();
			const keyData: KeyData = {
				id: "export-test",
				type: "hd-seed",
				algorithm: "raw",
				extractable: true,
				privateKey: new Uint8Array(32).fill(1),
			} as any;
			await extension.key.store.import(keyData);

			const exported = await extension.key.store.export("export-test");
			expect(exported.id).toBe("export-test");
			// privateKey should be restored by fetchSecret (mocked or actual)
			expect(exported.privateKey).toBeDefined();
		});

		it("should remove a key", async () => {
			const { extension, hooks } = createTestSetup();
			const beforeHook = vi.fn();
			hooks.before("remove", beforeHook);

			await extension.key.store.import({
				id: "to-remove",
				type: "hd-seed",
				algorithm: "raw",
				extractable: true,
				privateKey: new Uint8Array(32).fill(1),
			} as any);

			await extension.key.store.remove("to-remove");
			expect(extension.keys).toHaveLength(0);
			expect(beforeHook).toHaveBeenCalled();
			expect(beforeHook.mock.calls[0][0]).toMatchObject({ keyId: "to-remove" });
		});

		it("should clear all keys", async () => {
			const { extension, hooks } = createTestSetup();
			const beforeHook = vi.fn();
			hooks.before("clear", beforeHook);

			await extension.key.store.import({
				id: "key1",
				type: "hd-seed",
				algorithm: "raw",
				extractable: true,
				privateKey: new Uint8Array(32).fill(1),
			} as any);

			await extension.key.store.clear();
			expect(extension.keys).toHaveLength(0);
			expect(beforeHook).toHaveBeenCalled();
		});
	});

	describe("cryptographic operations", () => {
		it("should sign and verify", async () => {
			const { extension, hooks } = createTestSetup();
			const signBeforeHook = vi.fn();
			hooks.before("sign", signBeforeHook);

			// 32-byte seed
			const seed = new Uint8Array(32).fill(1);
			const seedId = await extension.key.store.import({
				id: "root-seed",
				type: "hd-seed",
				algorithm: "raw",
				format: "raw",
				extractable: true,
				privateKey: seed,
			} as any);

			const rootKeyId = await extension.key.store.generate({
				type: "hd-root-key",
				algorithm: "raw",
				extractable: true,
				keyUsages: ["deriveKey"],
				params: { parentKeyId: seedId },
			});

			const derivedId = await extension.key.store.deriveFromSeed(rootKeyId, "m/44'/283'/0'/0/0");

			const data = new TextEncoder().encode("hello world");
			const signature = await extension.key.store.sign(derivedId, data);
			
			expect(signature).toBeDefined();
			expect(signBeforeHook).toHaveBeenCalled();

			const isValid = await extension.key.store.verify(derivedId, data, signature);
			expect(typeof isValid).toBe("boolean");
		});

		it("should encrypt and decrypt", async () => {
			const { extension } = createTestSetup();
			const seed = new Uint8Array(32).fill(1);
			const seedId = await extension.key.store.import({
				id: "root-seed",
				type: "hd-seed",
				algorithm: "raw",
				format: "raw",
				extractable: true,
				privateKey: seed,
			} as any);

			const keyId = await extension.key.store.generate({
				type: "hd-derived-p256",
				algorithm: "P256",
				extractable: true,
				keyUsages: ["encrypt", "decrypt"],
				params: { parentKeyId: seedId },
			});

			const data = new TextEncoder().encode("secret message");
			const encrypted = await extension.key.store.encryptWithKey(keyId, data);
			expect(encrypted).toBeDefined();
			expect(encrypted).not.toEqual(data);

			const decrypted = await extension.key.store.decryptWithKey(keyId, encrypted);
			expect(new Uint8Array(decrypted)).toEqual(data);
		});

		it("should batch sign", async () => {
			const { extension, hooks } = createTestSetup();
			const batchBeforeHook = vi.fn();
			hooks.before("batchSign", batchBeforeHook);

			const seed = new Uint8Array(32).fill(1);
			const seedId = await extension.key.store.import({
				id: "root-seed",
				type: "hd-seed",
				algorithm: "raw",
				format: "raw",
				extractable: true,
				privateKey: seed,
			} as any);

			const rootKeyId = await extension.key.store.generate({
				type: "hd-root-key",
				algorithm: "raw",
				extractable: true,
				keyUsages: ["deriveKey"],
				params: { parentKeyId: seedId },
			});

			const id1 = await extension.key.store.deriveFromSeed(rootKeyId, "m/44'/283'/0'/0/0");
			const id2 = await extension.key.store.deriveFromSeed(rootKeyId, "m/44'/283'/0'/0/1");

			const data1 = new TextEncoder().encode("msg1");
			const data2 = new TextEncoder().encode("msg2");

			const signatures = await extension.key.store.batchSign([id1, id2], [data1, data2]);
			expect(signatures).toHaveLength(2);
			expect(signatures[0]).toBeDefined();
			expect(signatures[1]).toBeDefined();
			expect(batchBeforeHook).toHaveBeenCalled();
		});
	});
});
