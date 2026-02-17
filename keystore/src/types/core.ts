/**
 * Core types and interfaces for the keystore.
 * These are the fundamental types used throughout the system.
 */

/**
 * Unique identifier for a key
 */
export type KeyId = string;

/**
 * Type of key: RSA (asymmetric), ECC (elliptic curve), HD seed/derived
 */
export type KeyType = "rsa" | "ecc" | "lattice" | "hd-seed" | "hd-derived";

/**
 * How keys are encoded: raw bytes, PEM (text), DER (binary), JWK (JSON), OpenPGP
 */
export type KeyFormat = "raw" | "pem" | "der" | "jwk" | "openpgp";

/**
 * Supported algorithms: RS256 (RSA), ES256 (ECDSA), EdDSA (Ed25519)
 */
export type Algorithm = "RS256" | "ES256" | "EdDSA";

/**
 * Metadata about a key.
 *
 * Use case: Store info like when key was created or what it's for.
 */
export interface KeyMetadata {
	/** Unique identifier for the key */
	id: KeyId;
	/** The type of key (e.g., RSA, ECC, HD) */
	type: KeyType;
	/** The algorithm used by the key */
	algorithm: Algorithm;
	/** When the key was created */
	createdAt: Date;
	/** API version for compatibility tracking */
	version?: number;
	/** Custom labels (e.g., `{"purpose": "signing"}`) */
	labels?: Record<string, string>;
	/** Custom extension data for specific implementations */
	customData?: Record<string, unknown>;
}

/**
 * Data for a key, including optional public key and metadata.
 */
export interface KeyData {
	/** Public key bytes (if available) */
	publicKey?: Uint8Array;
	/** Private key bytes (usually for import only, never exported for existing keys) */
	privateKey?: Uint8Array;
	/** Associated {@link KeyMetadata} */
	metadata: KeyMetadata;
}

/**
 * Options for generating a new key.
 */
export interface GenerateOptions {
	/** Key type */
	type: KeyType;
	/** Algorithm */
	algorithm: Algorithm;
	/** Key size in bits (e.g., 2048 for RSA) */
	keySize?: number;
	/** Curve for ECC (e.g., 'P-256') */
	curve?: string;
	/** Additional params */
	params?: Record<string, any>;
}

/**
 * Options for exporting a key.
 */
export interface ExportOptions {
	/** Export format */
	format: KeyFormat;
}

/**
 * Options for key operations.
 */
export interface KeyOptions {
	/** Custom ID */
	id?: string;
	/** Name/label */
	name?: string;
	/** Algorithm */
	algorithm?: Algorithm;
	/** Passphrase for encryption */
	passphrase?: string;
	/** Extra metadata */
	metadata?: Record<string, any>;
}

/**
 * Options for deriving keys from seed.
 */
export interface DeriveOptions extends KeyOptions {
	/** Algorithm for the derived key */
	algorithm: Algorithm;
	/** Curve for derived key (secp256k1, secp256r1, ed25519) */
	curve?: "secp256k1" | "secp256r1" | "ed25519";
	/** Derivation mode */
	mode?: "standard" | "peikert" | "slip10";
	/** For P256 domain-specific derivation (WebAuthn/passkeys) */
	origin?: string;
	/** For P256 domain-specific derivation (WebAuthn/passkeys) */
	userHandle?: string;
	/** Counter for multiple keys per domain (default: 0) */
	counter?: number;
}

/**
 * Audit event for logging key operations.
 *
 * Use case: Track when keys were used for compliance reports.
 */
export interface AuditEvent {
	/** Event ID */
	id: string;
	/** When it happened */
	timestamp: Date;
	/** What operation (e.g., "sign") */
	operation: string;
	/** Key involved */
	keyId?: KeyId;
	/** Who did it */
	principal?: string;
	/** Did it succeed? */
	success: boolean;
	/** Extra details */
	details?: Record<string, any>;
	/** Tamper-proof hash */
	hmac?: string;
}

/**
 * Configuration for data encryption.
 */
export interface EncryptionConfig {
	/** Algorithm for encrypting data (e.g., 'aes-256-gcm') */
	algorithm?: "aes-256-gcm" | "chacha20-poly1305";
	/** How to derive keys from passphrases (e.g., 'pbkdf2') */
	keyDerivation?: "pbkdf2" | "argon2";
	/** Whether to require a passphrase for sensitive operations */
	requirePassphrase?: boolean;
}

/**
 * Configuration for the keystore. This controls how it behaves (e.g., enable logging, set limits).
 */
export interface KeyStoreConfig {
	/** The {@link KeyStoreBackend} implementation to use */
	backend?: import("./backend.ts").KeyStoreBackend;
	/** Whether to enable audit logging */
	enableAudit?: boolean;
	/** Data encryption settings */
	encryption?: EncryptionConfig;
}
