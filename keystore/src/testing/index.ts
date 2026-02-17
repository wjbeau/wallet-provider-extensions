import { beforeEach, describe, expect, it } from "vitest";
import type { KeyStoreBackend } from "../types/index.ts";

export type BackendFactory = () => KeyStoreBackend | Promise<KeyStoreBackend>;

export interface TestSuiteOptions {
	skipOptional?: boolean;
}

const TEST_SEED = new Uint8Array(32).fill(1);

export function runKeyStoreBackendTests(
	factory: BackendFactory,
	options: TestSuiteOptions = {},
): void {
	// Some features of the KeyStoreBackend are optional and may not be implemented by all backends (e.g. batchSign, HD wallet operations, encryption, audit logging). We allow these tests to be skipped via options so that the test suite can be used for a wider range of implementations while still providing comprehensive coverage for core functionality.
	const { skipOptional = false } = options;

	describe("KeyStoreBackend Conformance Tests", () => {
		let backend: KeyStoreBackend;

		beforeEach(async () => {
			backend = await factory();
		});

		async function createTestKey(index = 0) {
			if (!backend.importSeed || !backend.deriveFromSeed) {
				throw new Error("importSeed or deriveFromSeed not supported");
			}

			const seedId = (await backend.importSeed(TEST_SEED)) as string;
			return (await backend.deriveFromSeed(
				seedId,
				`m/44'/283'/0'/0'/${index}'`,
				{
					algorithm: "EdDSA",
					curve: "ed25519",
				},
			)) as string;
		}

		// =======================
		// Core Operations
		// =======================
		describe("Core Operations", () => {
			describe("list()", () => {
				it("should return an array", async () => {
					const list = await backend.list();
					expect(Array.isArray(list)).toBe(true);
				});

				it("should include derived keys in the list", async () => {
					const id = (await createTestKey()) as string;
					const list = await backend.list();
					const found = list.find((k: { id: string }) => k.id === id);
					expect(found).toBeDefined();
				});
			});

			describe("getMetadata()", () => {
				it("should return metadata for a derived key", async () => {
					const id = (await createTestKey()) as string;
					const metadata = await backend.getMetadata(id);
					expect(metadata.id).toBe(id);
					expect(metadata.type).toBe("hd-derived");
					expect(metadata.algorithm).toBe("EdDSA");
					expect(metadata.createdAt).toBeInstanceOf(Date);
				});
			});

			describe("export()", () => {
				it("should export a key with publicKey and metadata", async () => {
					const id = (await createTestKey()) as string;
					const data = await backend.export(id);
					expect(data.publicKey).toBeInstanceOf(Uint8Array);
					expect(data.publicKey?.length).toBe(32);
					expect(data.metadata).toBeDefined();
					expect(data.metadata.id).toBe(id);
				});
			});

			describe("remove()", () => {
				it("should remove a key", async () => {
					const id = (await createTestKey()) as string;
					await backend.remove(id);
					const list = await backend.list();
					const found = list.find((k: { id: string }) => k.id === id);
					expect(found).toBeUndefined();
				});
			});

			describe("import()", () => {
				it("should import a key and return a KeyId", async () => {
					const id = (await createTestKey()) as string;
					const exported = await backend.export(id);
					const importedId = await backend.import(exported, "raw");
					expect(typeof importedId).toBe("string");
					expect(importedId.length).toBeGreaterThan(0);
				});
			});
		});

		// =======================
		// Signing and Verification
		// =======================
		describe("Signing Operations", () => {
			describe("sign()", () => {
				it("should return a signature as Uint8Array", async () => {
					const id = (await createTestKey()) as string;
					const data = new Uint8Array([1, 2, 3, 4, 5]);
					const signature = await backend.sign(id, data);
					expect(signature).toBeInstanceOf(Uint8Array);
					expect(signature.length).toBe(64);
				});

				it("should produce different signatures for different data", async () => {
					const id = (await createTestKey()) as string;
					const sig1 = await backend.sign(id, new Uint8Array([1, 2, 3]));
					const sig2 = await backend.sign(id, new Uint8Array([4, 5, 6]));
					expect(sig1).not.toEqual(sig2);
				});

				it("should produce consistent signatures for same data (deterministic)", async () => {
					const id = (await createTestKey()) as string;
					const data = new Uint8Array([1, 2, 3]);
					const sig1 = await backend.sign(id, data);
					const sig2 = await backend.sign(id, data);
					expect(sig1).toEqual(sig2);
				});
			});

			describe("verify()", () => {
				it("should verify a valid signature", async () => {
					const id = (await createTestKey()) as string;
					const data = new Uint8Array([1, 2, 3, 4, 5]);
					const signature = await backend.sign(id, data);
					const valid = await backend.verify(id, data, signature);
					expect(valid).toBe(true);
				});

				it("should reject an invalid signature", async () => {
					const id = (await createTestKey()) as string;
					const data = new Uint8Array([1, 2, 3, 4, 5]);
					const badSignature = new Uint8Array(64).fill(0);
					const valid = await backend.verify(id, data, badSignature);
					expect(valid).toBe(false);
				});

				it("should reject signature for different data", async () => {
					const id = (await createTestKey()) as string;
					const data1 = new Uint8Array([1, 2, 3]);
					const data2 = new Uint8Array([4, 5, 6]);
					const signature = await backend.sign(id, data1);
					const valid = await backend.verify(id, data2, signature);
					expect(valid).toBe(false);
				});
			});

			// Optional batch signing test - only run if batchSign is implemented
			// This is a more advanced feature and may not be supported by all backends, so we allow it to be skipped via options
			if (!skipOptional) {
				describe("batchSign()", () => {
					it("should sign multiple data items", async () => {
						if (!backend.batchSign) return;

						const id1 = (await createTestKey(0)) as string;
						const id2 = (await createTestKey(1)) as string;

						const signatures = await backend.batchSign(
							[id1, id2],
							[new Uint8Array([1, 2, 3]), new Uint8Array([4, 5, 6])],
						);

						expect(Array.isArray(signatures)).toBe(true);
						expect(signatures.length).toBe(2);
						for (const sig of signatures) {
							expect(sig).toBeInstanceOf(Uint8Array);
							expect(sig.length).toBe(64);
						}
					});
				});
			}
		});

		// =======================
		// Optional Advanced Features
		//
		//
		// xHD Wallet Operations (importSeed, deriveFromSeed)
		//
		// =======================

		if (!skipOptional) {
			describe("HD Wallet Operations", () => {
				describe("importSeed()", () => {
					it("should import a seed and return a KeyId", async () => {
						if (!backend.importSeed) return;

						const seed = new Uint8Array(64).fill(1);
						const id = await backend.importSeed(seed);
						expect(typeof id).toBe("string");
						expect(id.length).toBeGreaterThan(0);
					});
				});

				describe("deriveFromSeed()", () => {
					it("should derive a key from seed", async () => {
						if (!backend.importSeed || !backend.deriveFromSeed) return;

						const seed = new Uint8Array(64).fill(1);
						const seedId = await backend.importSeed(seed);
						const derivedId = await backend.deriveFromSeed(
							seedId,
							"m/44'/283'/0'/0'/0'",
							{ algorithm: "EdDSA", curve: "ed25519" },
						);
						expect(typeof derivedId).toBe("string");
						expect(derivedId.length).toBeGreaterThan(0);
					});

					it("should derive different keys for different paths", async () => {
						if (!backend.importSeed || !backend.deriveFromSeed) return;

						const seed = new Uint8Array(64).fill(1);
						const seedId = await backend.importSeed(seed);

						const id1 = await backend.deriveFromSeed(
							seedId,
							"m/44'/283'/0'/0'/0'",
							{ algorithm: "EdDSA", curve: "ed25519" },
						);
						const id2 = await backend.deriveFromSeed(
							seedId,
							"m/44'/283'/0'/0'/1'",
							{ algorithm: "EdDSA", curve: "ed25519" },
						);

						const key1 = await backend.export(id1);
						const key2 = await backend.export(id2);

						expect(key1.publicKey).not.toEqual(key2.publicKey);
					});

					it("should derive same key for same path (deterministic)", async () => {
						if (!backend.importSeed || !backend.deriveFromSeed) return;

						const seed = new Uint8Array(64).fill(1);
						const seedId = await backend.importSeed(seed);
						const path = "m/44'/283'/0'/0'/0'";

						const id1 = await backend.deriveFromSeed(seedId, path, {
							algorithm: "EdDSA",
							curve: "ed25519",
						});
						const id2 = await backend.deriveFromSeed(seedId, path, {
							algorithm: "EdDSA",
							curve: "ed25519",
						});

						const key1 = await backend.export(id1);
						const key2 = await backend.export(id2);

						expect(key1.publicKey).toEqual(key2.publicKey);
					});
				});
			});

			// =======================
			// Encryption with Passphrase and Key Agreement (encryptWithKey, encryptData, deriveSharedSecret)
			// =======================

			describe("Encryption Operations", () => {
				describe("encryptWithKey() / decryptWithKey()", () => {
					it("should round-trip encrypt/decrypt data", async () => {
						if (!backend.encryptWithKey || !backend.decryptWithKey) return;

						const id = (await createTestKey()) as string;
						const plaintext = new Uint8Array([1, 2, 3, 4, 5]);
						const encrypted = await backend.encryptWithKey(id, plaintext);
						const decrypted = await backend.decryptWithKey(id, encrypted);
						expect(decrypted).toEqual(plaintext);
					});
				});

				describe("encryptData() / decryptData()", () => {
					it("should round-trip encrypt/decrypt with passphrase", async () => {
						if (!backend.encryptData || !backend.decryptData) return;

						const plaintext = new Uint8Array([1, 2, 3, 4, 5]);
						const passphrase = "test-password";
						const encrypted = await backend.encryptData(plaintext, passphrase);
						const decrypted = await backend.decryptData(encrypted, passphrase);
						expect(decrypted).toEqual(plaintext);
					});
				});

				describe("deriveSharedSecret()", () => {
					it("should derive a shared secret", async () => {
						if (!backend.deriveSharedSecret) return;

						const id1 = (await createTestKey(0)) as string;
						const id2 = (await createTestKey(1)) as string;

						const key2 = await backend.export(id2);
						if (!key2.publicKey) throw new Error("publicKey missing");
						const secret = await backend.deriveSharedSecret(
							id1,
							key2.publicKey,
							true,
						);

						expect(secret).toBeInstanceOf(Uint8Array);
					});

					it("should derive same secret from both sides", async () => {
						if (!backend.deriveSharedSecret) return;

						const id1 = (await createTestKey(0)) as string;
						const id2 = (await createTestKey(1)) as string;

						const key1 = await backend.export(id1);
						const key2 = await backend.export(id2);
						if (!key1.publicKey || !key2.publicKey)
							throw new Error("publicKey missing");

						const secret1 = await backend.deriveSharedSecret(
							id1,
							key2.publicKey,
							true,
						);
						const secret2 = await backend.deriveSharedSecret(
							id2,
							key1.publicKey,
							false,
						);

						expect(secret1).toEqual(secret2);
					});
				});
			});

			// =======================
			// Audit Logging (logAuditEvent, getAuditLogs)
			//
			// Optional features, but gives the option to logs or persistent audit trails of key operations which can be important for security-sensitive applications
			// =======================

			describe("Audit Operations", () => {
				describe("logAuditEvent() / getAuditLogs()", () => {
					it("should log and retrieve audit events", async () => {
						if (!backend.logAuditEvent || !backend.getAuditLogs) return;

						const event = {
							id: "test-event-1",
							timestamp: new Date(),
							operation: "sign",
							keyId: "test-key",
							success: true,
						};

						await backend.logAuditEvent(event);
						const logs = await backend.getAuditLogs();

						expect(Array.isArray(logs)).toBe(true);
						const found = logs.find((e: { id: string }) => e.id === event.id);
						expect(found).toBeDefined();
						expect(found?.operation).toBe("sign");
					});

					it("should filter audit logs by operation", async () => {
						if (!backend.logAuditEvent || !backend.getAuditLogs) return;

						await backend.logAuditEvent({
							id: "event-sign",
							timestamp: new Date(),
							operation: "sign",
							success: true,
						});
						await backend.logAuditEvent({
							id: "event-verify",
							timestamp: new Date(),
							operation: "verify",
							success: true,
						});

						const logs = await backend.getAuditLogs({ operation: "sign" });
						expect(
							logs.every((e: { operation: string }) => e.operation === "sign"),
						).toBe(true);
					});
				});
			});
		}

		// =======================
		// Error Handling
		//
		// Tests to ensure that the backend properly throws errors for invalid operations, such as trying to access non-existent keys or providing invalid input data. Proper error handling is crucial for robustness and security.
		// =======================

		describe("Error Handling", () => {
			it("should throw when getting metadata for non-existent key", async () => {
				await expect(
					backend.getMetadata("non-existent-key-id"),
				).rejects.toThrow();
			});

			it("should throw when exporting non-existent key", async () => {
				await expect(backend.export("non-existent-key-id")).rejects.toThrow();
			});

			it("should throw when signing with non-existent key", async () => {
				await expect(
					backend.sign("non-existent-key-id", new Uint8Array([1, 2, 3])),
				).rejects.toThrow();
			});
		});
	});
}
