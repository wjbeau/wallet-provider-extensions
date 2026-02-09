import { DeterministicP256 } from "@algorandfoundation/dp256";
import {
	BIP32DerivationType,
	Encoding,
	fromSeed,
	KeyContext,
	XHDWalletAPI,
} from "@algorandfoundation/xhd-wallet-api";
import {
	crypto_generichash,
	crypto_secretbox_easy,
	crypto_secretbox_open_easy,
} from "@algorandfoundation/xhd-wallet-api/dist/sumo.facade.js";
import {
	type AuditEvent,
	type AuditStorage,
	type DeriveOptions,
	type ExportOptions,
	type GenerateOptions,
	InvalidKeyDataError,
	InvalidKeyFormatError,
	type KeyData,
	type KeyFormat,
	KeyGenerationNotSupportedError,
	type KeyId,
	type KeyMetadata,
	KeyNotFoundError,
	type KeyOptions,
	type KeyStorage,
	type KeyStoreBackend,
	type SeedStorage,
	type StoredSeedData,
} from "./types.ts";

/**
 * Configuration options for XHDKeyStoreBackend
 */
export interface XHDKeyStoreBackendOptions {
	keyStorage: KeyStorage;
	seedStorage: SeedStorage;
	auditStorage: AuditStorage;
}

// core
// dnfs
// evm -> algo

/**
 * Extended Hierarchical Deterministic (HD) Key Store Backend
 *
 * This class provides a secure key management system supporting:
 * - BIP32-Ed25519 hierarchical deterministic wallets (ARC-0052 standard)
 * - P-256 ECDSA keys for WebAuthn/Passkey compatibility
 * - Key import/export, signing, encryption, and shared secret derivation
 *
 * HD Wallet Concept:
 * Instead of managing many unrelated keys, you start with a single seed (like a master password).
 * From this seed, you can deterministically derive an unlimited tree of child keys using paths
 * like "m/44'/283'/0'/0'/0'". This means:
 * - Backup is just the seed (usually as a 12-24 word mnemonic)
 * - Same seed always produces the same keys
 * - Keys are organized hierarchically (accounts, addresses, etc.)
 */
export class XHDKeyStoreBackend implements KeyStoreBackend {
	private keyStorage: KeyStorage;
	private seedStorage: SeedStorage;
	private auditStorage: AuditStorage;
	private api = new XHDWalletAPI();
	private dp256 = new DeterministicP256();

	constructor(options: XHDKeyStoreBackendOptions) {
		this.keyStorage = options.keyStorage;
		this.seedStorage = options.seedStorage;
		this.auditStorage = options.auditStorage;
	}

	/**
	 * Generates a cryptographically secure random ID (hex string)
	 * Uses the Web Crypto API's getRandomValues for secure randomness
	 */
	private generateId(): KeyId {
		const bytes = new Uint8Array(16);
		crypto.getRandomValues(bytes);
		return Array.from(bytes)
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("");
	}

	/**
	 * Securely clears sensitive data from memory by overwriting with zeros.
	 * Use this after cryptographic operations to minimize key exposure.
	 */
	private clearBuffer(data?: Uint8Array): void {
		if (data) {
			data.fill(0);
		}
	}

	/**
	 * Compares two byte arrays lexicographically.
	 * Returns negative if a < b, positive if a > b, zero if equal.
	 * Used for deterministic ordering in ECDH.
	 */
	private compareBytes(a: Uint8Array, b: Uint8Array): number {
		const len = Math.min(a.length, b.length);
		for (let i = 0; i < len; i++) {
			if (a[i] !== b[i]) return a[i] - b[i];
		}
		return a.length - b.length;
	}

	/**
	 * Direct key generation is not supported - HD wallets require seeds
	 * Users should use importSeed() + deriveFromSeed() instead
	 */
	async generate(_options: GenerateOptions): Promise<KeyId> {
		throw new KeyGenerationNotSupportedError(
			"Direct key generation not supported. Use importSeed() + deriveFromSeed() for HD derivation.",
		);
	}

	/**
	 * Imports an existing key into the keystore
	 *
	 * Supports two key types:
	 * - Ed25519: Used for Algorand signatures. Can derive public key from 64-byte private key.
	 * - P-256 (secp256r1): Used for WebAuthn/Passkey. Requires explicit public key.
	 *
	 * Ed25519 keys are 32-byte public keys + 64-byte private keys (includes public key)
	 * P-256 keys use 33-byte compressed or 65-byte uncompressed public keys
	 */
	async import(data: KeyData, format: KeyFormat): Promise<KeyId> {
		if (!data.publicKey && !data.privateKey) {
			throw new InvalidKeyFormatError("publicKey or privateKey required");
		}

		const isP256 = data.metadata.algorithm === "ES256";
		let publicKey = data.publicKey;

		// For Ed25519: derive public key from private key if not provided
		// The private key format is 64 bytes: [32 bytes seed || 32 bytes public key]
		if (!publicKey && data.privateKey) {
			if (isP256) {
				throw new InvalidKeyDataError(
					"P256 import requires both publicKey and privateKey",
				);
			}
			if (data.privateKey.length !== 64) {
				throw new InvalidKeyDataError(
					"Ed25519 import requires publicKey or 64-byte combined key",
				);
			}
			publicKey = data.privateKey.slice(32);
		}

		if (!publicKey) {
			throw new InvalidKeyDataError("Could not derive public key");
		}

		const id = this.generateId();
		await this.keyStorage.set(id, {
			metadata: { ...data.metadata, id, createdAt: new Date() },
			publicKey,
			privateKey: data.privateKey,
			curve: isP256 ? "secp256r1" : "ed25519",
		});

		return id;
	}

	/**
	 * Exports public key data for a given key ID
	 * Note: Private keys are never exported for security
	 */
	async export(id: KeyId, _options?: ExportOptions): Promise<KeyData> {
		const key = await this.keyStorage.get(id);
		if (!key) {
			throw new KeyNotFoundError(id);
		}

		return {
			publicKey: key.publicKey,
			metadata: { ...key.metadata },
		};
	}

	/**
	 * Removes a key or seed from storage
	 * Attempts to delete from both key and seed storage
	 */
	async remove(id: KeyId): Promise<void> {
		const keyDeleted = await this.keyStorage.delete(id);
		const seedDeleted = await this.seedStorage.delete(id);
		if (!keyDeleted && !seedDeleted) {
			throw new KeyNotFoundError(id);
		}
	}

	/**
	 * Lists all keys and seeds with their metadata
	 */
	async list(): Promise<KeyMetadata[]> {
		const [keys, seeds] = await Promise.all([
			this.keyStorage.getAll(),
			this.seedStorage.getAll(),
		]);
		return [
			...keys.map((k) => ({ ...k.metadata })),
			...seeds.map((s) => ({ ...s.metadata })),
		];
	}

	/**
	 * Gets metadata for a specific key or seed
	 */
	async getMetadata(id: KeyId): Promise<KeyMetadata> {
		const key = await this.keyStorage.get(id);
		if (key) return { ...key.metadata };

		const seed = await this.seedStorage.get(id);
		if (seed) return { ...seed.metadata };

		throw new KeyNotFoundError(id);
	}

	/**
	 * Signs data with the specified key
	 *
	 * P-256 signing uses deterministic ECDSA via the dp256 library
	 * Ed25519 signing uses the XHDWalletAPI which implements BIP32-Ed25519
	 *
	 * Ed25519 is an EdDSA signature scheme - it's deterministic (no randomness needed)
	 * and produces 64-byte signatures.
	 */
	async sign(
		id: KeyId,
		data: Uint8Array,
		_algorithm?: string,
	): Promise<Uint8Array> {
		const key = await this.keyStorage.get(id);
		if (!key) {
			throw new KeyNotFoundError(id);
		}

		if (key.curve === "secp256r1") {
			if (!key.privateKey) {
				throw new InvalidKeyDataError("No private key available for signing");
			}
			// Create a copy of the private key to avoid modifying stored data
			const privateKey = new Uint8Array(key.privateKey);
			try {
				return this.dp256.signWithDomainSpecificKeyPair(privateKey, data);
			} finally {
				// Clear the private key from memory after use
				this.clearBuffer(privateKey);
			}
		}

		// Ed25519 HD signing requires rootKey and derivation context
		if (!key.metadata.customData?.seedId || key.context === undefined) {
			throw new InvalidKeyDataError(
				"Ed25519 signing requires HD-derived key with rootKey and derivation context",
			);
		}

		// find rootKey by seedID
		const seedId = key.metadata.customData.seedId as KeyId;
		const seed = await this.seedStorage.get(seedId);
		if (!seed) {
			throw new KeyNotFoundError(
				`Seed with ID ${seedId} not found for signing`,
			);
		}
		const rootKey = seed.rootKey;

		// Note: signData uses the rootKey to derive the signing key internally.
		// The sensitive derived key is not exposed to us, so we can't clear it here.
		// Consider this when choosing storage - encrypted storage wrappers are recommended.
		return this.api.signData(
			rootKey,
			key.context,
			key.account ?? 0,
			key.keyIndex ?? 0,
			data,
			{ encoding: Encoding.NONE, schema: {} },
			BIP32DerivationType.Peikert,
		);
	}

	/**
	 * Verifies a signature against data using the public key
	 *
	 * P-256 verification uses Web Crypto API's ECDSA implementation
	 * Ed25519 verification uses the XHDWalletAPI
	 */
	async verify(
		id: KeyId,
		data: Uint8Array,
		signature: Uint8Array,
		_algorithm?: string,
	): Promise<boolean> {
		const key = await this.keyStorage.get(id);
		if (!key) {
			throw new KeyNotFoundError(id);
		}

		if (key.curve === "secp256r1") {
			return this.verifyP256(key.publicKey, data, signature);
		}

		return this.api.verifyWithPublicKey(signature, data, key.publicKey);
	}

	/**
	 * Verifies a P-256 ECDSA signature using Web Crypto API
	 * P-256 public keys need the 0x04 prefix for uncompressed format
	 */
	private async verifyP256(
		publicKey: Uint8Array,
		data: Uint8Array,
		signature: Uint8Array,
	): Promise<boolean> {
		// Prepend 0x04 to indicate uncompressed point format (SEC1)
		const fullPublicKey = new Uint8Array(65);
		fullPublicKey[0] = 0x04;
		fullPublicKey.set(publicKey, 1);

		const cryptoKey = await crypto.subtle.importKey(
			"raw",
			fullPublicKey,
			{ name: "ECDSA", namedCurve: "P-256" },
			false,
			["verify"],
		);

		return crypto.subtle.verify(
			{ name: "ECDSA", hash: "SHA-256" },
			cryptoKey,
			new Uint8Array(signature),
			new Uint8Array(data),
		);
	}

	/**
	 * Imports a BIP32 seed for HD wallet derivation
	 *
	 * The seed is the root of the HD wallet tree. From this single seed,
	 * you can derive all your keys deterministically. This is typically
	 * generated from a BIP39 mnemonic (12-24 words).
	 *
	 * We also generate a "derived main key" for P-256 deterministic keys,
	 * which uses PBKDF2-like stretching for domain-specific key derivation.
	 */
	async importSeed(seed: Uint8Array, options?: KeyOptions): Promise<KeyId> {
		if (seed.length !== 32 && seed.length !== 64) {
			throw new InvalidKeyDataError(
				`Invalid seed length: ${seed.length}. Expected 32 or 64 bytes.`,
			);
		}

		// Use first 32 bytes for Ed25519 HD derivation
		const seedBytes = seed.length === 64 ? seed.slice(0, 32) : seed;
		const rootKey = fromSeed(seedBytes as unknown as Buffer);

		// Generate derived main key for P-256 deterministic derivation
		// This uses domain separation with "liquid" context
		const derivedMainKey = await this.dp256.genDerivedMainKey(
			seedBytes,
			new TextEncoder().encode("liquid"),
			210_000, // Iterations (similar to PBKDF2)
			64,
		);

		const id = options?.id ?? this.generateId();
		await this.seedStorage.set(id, {
			metadata: {
				id,
				type: "hd-seed",
				algorithm: "EdDSA",
				createdAt: new Date(),
				labels: options?.name ? { name: options.name } : undefined,
				customData: options?.metadata,
			},
			rootKey: new Uint8Array(rootKey),
			derivedMainKey,
		});

		return id;
	}

	/**
	 * Derives a child key from a seed using a BIP44-style derivation path
	 *
	 * Paths follow the format: m / purpose' / coin_type' / account' / change / address_index
	 * The ' indicates a "hardened" derivation (uses parent private key)
	 *
	 * Examples:
	 * - m/44'/283'/0'/0'/0' - Algorand address 0 (hardened)
	 * - m/44'/283'/0'/0/0 - Algorand address 0 (non-hardened)
	 */
	async deriveFromSeed(
		seedId: KeyId,
		path: string,
		options?: DeriveOptions,
	): Promise<KeyId> {
		const seed = await this.seedStorage.get(seedId);
		if (!seed) {
			throw new KeyNotFoundError(seedId);
		}

		const isP256 =
			options?.curve === "secp256r1" || options?.algorithm === "ES256";

		return isP256
			? this.deriveP256FromSeed(seed, path, options)
			: this.deriveEd25519FromSeed(seed, path, options);
	}

	/**
	 * Derives a P-256 key deterministically from seed
	 *
	 * Uses domain-specific derivation: keys are generated based on
	 * origin (domain), userHandle, and counter. Same inputs always
	 * produce the same key pair.
	 */
	private async deriveP256FromSeed(
		seed: StoredSeedData,
		path: string,
		options?: DeriveOptions,
	): Promise<KeyId> {
		if (!seed.derivedMainKey) {
			throw new InvalidKeyDataError("Seed does not have P256 derived main key");
		}

		const privateKey = await this.dp256.genDomainSpecificKeyPair(
			seed.derivedMainKey,
			options?.origin ?? "default",
			options?.userHandle ?? "default",
			options?.counter ?? 0,
		);

		const publicKey = this.dp256.getPurePKBytes(privateKey);

		const id = options?.id ?? this.generateId();
		await this.keyStorage.set(id, {
			metadata: {
				id,
				type: "hd-derived",
				algorithm: "ES256",
				createdAt: new Date(),
				labels: options?.name ? { name: options.name } : undefined,
				customData: {
					...options?.metadata,
					derivationPath: path,
					seedId: seed.metadata.id,
					origin: options?.origin ?? "default",
					userHandle: options?.userHandle ?? "default",
					counter: options?.counter ?? 0,
				},
			},
			publicKey,
			privateKey,
			curve: "secp256r1",
		});

		return id;
	}

	/**
	 * Derives an Ed25519 key from seed using BIP32-Ed25519
	 *
	 * BIP32-Ed25519 is an extension of BIP32 for Ed25519 curves.
	 * Unlike secp256k1, Ed25519 has special requirements:
	 * - Public keys can't be directly derived from parent public key only
	 * - Uses a "extended" private key format (64 bytes: kL, kR)
	 *
	 * We support two derivation modes:
	 * - Peikert (default): Non-linear keyspace, better security properties
	 * - Khovratovich (standard): Linear keyspace, BIP32-compatible
	 */
	private async deriveEd25519FromSeed(
		seed: StoredSeedData,
		path: string,
		options?: DeriveOptions,
	): Promise<KeyId> {
		const derivationPath = this.parsePath(path);
		const derivationType =
			options?.mode === "standard"
				? BIP32DerivationType.Khovratovich
				: BIP32DerivationType.Peikert;

		// Determine key context from coin_type in path
		// 0x8000011b (283) = Algorand addresses, others = Identity
		const context =
			derivationPath[1] === 0x8000011b
				? KeyContext.Address
				: KeyContext.Identity;
		const account = (derivationPath[2] ?? 0x80000000) & 0x7fffffff;
		const keyIndex = (derivationPath[4] ?? 0) & 0x7fffffff;

		const derivedPublic = await this.api.keyGen(
			seed.rootKey,
			context,
			account,
			keyIndex,
			derivationType,
		);

		const id = options?.id ?? this.generateId();
		await this.keyStorage.set(id, {
			metadata: {
				id,
				type: "hd-derived",
				algorithm: "EdDSA",
				createdAt: new Date(),
				labels: options?.name ? { name: options.name } : undefined,
				customData: {
					...options?.metadata,
					derivationPath: path,
					seedId: seed.metadata.id,
				},
			},
			publicKey: derivedPublic,
			derivationPath,
			context,
			account,
			keyIndex,
			curve: "ed25519",
		});

		return id;
	}

	/**
	 * Parses a BIP44 derivation path string into an array of indices
	 *
	 * Path format: m / purpose' / coin_type' / account' / change / address_index
	 * Hardened indices (marked with ' or h) have 0x80000000 (2^31) added
	 *
	 * Example: m/44'/283'/0'/0'/0' becomes [44, 283, 0, 0, 0] with hardening
	 */
	private parsePath(path: string): number[] {
		return path
			.replace(/^m\/?/, "")
			.split("/")
			.map((part) => {
				const hardened = part.endsWith("'") || part.endsWith("h");
				const index = parseInt(part.replace(/['h]$/, ""), 10);
				return hardened ? index + 0x80000000 : index;
			});
	}

	/**
	 * Derives a shared secret using ECDH (Elliptic Curve Diffie-Hellman)
	 *
	 * ECDH allows two parties to establish a shared secret:
	 * - Party A has private key 'a' and public key 'aG' (G = generator point)
	 * - Party B has private key 'b' and public key 'bG'
	 * - Shared secret = a * bG = b * aG = abG
	 *
	 * For Ed25519, we convert to X25519 (Curve25519) format first because:
	 * - Ed25519 is optimized for signatures
	 * - X25519 is optimized for ECDH
	 * - Both use the same underlying curve but different representations
	 *
	 * This method works for both HD-derived keys and imported keys.
	 */
	async deriveSharedSecret(
		id: KeyId,
		publicKey: Uint8Array,
		meFirst: boolean,
		_algorithm?: string,
	): Promise<Uint8Array> {
		return new Uint8Array(0); // Placeholder implementation
	}

	/**
	 * Extracts the Ed25519 private key from a stored key
	 *
	 * For HD keys: derives the child private key from the root key
	 * For imported keys: returns a copy of the stored private key (safe to clear after use)
	 */
	private async getEd25519PrivateKey(key: {
		privateKey?: Uint8Array;
		rootKey?: Uint8Array;
		context?: number;
		account?: number;
		keyIndex?: number;
	}): Promise<Uint8Array> {
		// Direct private key available (imported non-HD key)
		// Return a copy so the caller can safely clear it without affecting stored data
		if (key.privateKey) {
			return new Uint8Array(key.privateKey);
		}

		// HD key - derive from root
		if (key.rootKey && key.context !== undefined) {
			const extendedPrivateKey = await this.api.deriveKey(
				key.rootKey,
				[key.context, key.account ?? 0, 0, key.keyIndex ?? 0],
				true, // Return private key
				BIP32DerivationType.Peikert,
			);
			// Extended format: 96 bytes total (kL || kR || chainCode)
			// We only need the first 64 bytes (kL || kR) for signing/ECDH
			return extendedPrivateKey.slice(0, 64);
		}

		throw new InvalidKeyDataError("No private key available");
	}

	/**
	 * Encrypts data using a public key
	 *
	 * Uses NaCl's secretbox (XSalsa20 + Poly1305):
	 * - XSalsa20: Stream cipher for encryption
	 * - Poly1305: MAC for authentication (prevents tampering)
	 *
	 * The symmetric key is derived by hashing the public key.
	 * Each encryption uses a random 24-byte nonce.
	 * Format: [24-byte nonce || ciphertext]
	 */
	async encryptWithKey(
		id: KeyId,
		data: Uint8Array,
		_algorithm?: string,
	): Promise<Uint8Array> {
		const key = await this.keyStorage.get(id);
		if (!key) {
			throw new KeyNotFoundError(id);
		}

		// Derive symmetric key from public key using BLAKE2b (generichash)
		const symmetricKey = crypto_generichash(32, key.publicKey);

		// Generate random nonce (number used once) - must be unique per encryption
		const nonce = new Uint8Array(24);
		crypto.getRandomValues(nonce);

		// Encrypt with XSalsa20-Poly1305 (NaCl secretbox)
		const ciphertext = crypto_secretbox_easy(data, nonce, symmetricKey);

		// Output format: nonce || ciphertext
		const result = new Uint8Array(24 + ciphertext.length);
		result.set(nonce, 0);
		result.set(ciphertext, 24);
		return result;
	}

	/**
	 * Decrypts data encrypted with encryptWithKey
	 *
	 * Requires the private key corresponding to the public key used for encryption.
	 * Extracts nonce from first 24 bytes, decrypts the rest.
	 */
	async decryptWithKey(
		id: KeyId,
		data: Uint8Array,
		_algorithm?: string,
	): Promise<Uint8Array> {
		const key = await this.keyStorage.get(id);
		if (!key) {
			throw new KeyNotFoundError(id);
		}

		const symmetricKey = crypto_generichash(32, key.publicKey);
		const nonce = data.slice(0, 24);
		const ciphertext = data.slice(24);

		return crypto_secretbox_open_easy(ciphertext, nonce, symmetricKey);
	}

	/**
	 * Encrypts data using a passphrase (password-based encryption)
	 *
	 * Uses PBKDF2-like key derivation with random salt:
	 * - Salt: 16 random bytes (prevents rainbow table attacks)
	 * - Key derivation: BLAKE2b(salt || passphrase)
	 * - Encryption: XSalsa20-Poly1305 with random nonce
	 *
	 * Format: [16-byte salt || 24-byte nonce || ciphertext]
	 */
	async encryptData(
		data: Uint8Array,
		passphrase?: string,
	): Promise<Uint8Array> {
		if (!passphrase) {
			throw new InvalidKeyDataError("Passphrase required for encryption");
		}

		// Generate random salt for key derivation
		const salt = new Uint8Array(16);
		crypto.getRandomValues(salt);

		// Derive key from passphrase using BLAKE2b with salt
		const key = crypto_generichash(
			32,
			new TextEncoder().encode(passphrase),
			salt,
		);

		// Generate random nonce
		const nonce = new Uint8Array(24);
		crypto.getRandomValues(nonce);

		// Encrypt
		const ciphertext = crypto_secretbox_easy(data, nonce, key);

		// Output format: salt || nonce || ciphertext
		const result = new Uint8Array(16 + 24 + ciphertext.length);
		result.set(salt, 0);
		result.set(nonce, 16);
		result.set(ciphertext, 40);
		return result;
	}

	/**
	 * Decrypts data encrypted with encryptData
	 *
	 * Extracts salt and nonce, re-derives key from passphrase, decrypts.
	 */
	async decryptData(
		data: Uint8Array,
		passphrase?: string,
	): Promise<Uint8Array> {
		if (!passphrase) {
			throw new InvalidKeyDataError("Passphrase required for decryption");
		}

		const salt = data.slice(0, 16);
		const nonce = data.slice(16, 40);
		const ciphertext = data.slice(40);

		const key = crypto_generichash(
			32,
			new TextEncoder().encode(passphrase),
			salt,
		);

		return crypto_secretbox_open_easy(ciphertext, nonce, key);
	}

	async logAuditEvent(event: AuditEvent): Promise<void> {
		await this.auditStorage.append(event);
	}

	async getAuditLogs(filter?: {
		since?: Date;
		operation?: string;
	}): Promise<AuditEvent[]> {
		return this.auditStorage.list(filter);
	}

	/**
	 * Signs multiple messages in parallel
	 *
	 * Note: ids and data arrays must be the same length
	 */
	async batchSign(ids: KeyId[], data: Uint8Array[]): Promise<Uint8Array[]> {
		if (ids.length !== data.length) {
			throw new InvalidKeyDataError(
				"ids and data arrays must have the same length",
			);
		}

		return Promise.all(ids.map((id, i) => this.sign(id, data[i])));
	}
}
