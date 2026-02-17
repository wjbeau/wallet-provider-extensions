import type {
	AuditEvent,
	DeriveOptions,
	ExportOptions,
	GenerateOptions,
	KeyData,
	KeyFormat,
	KeyId,
	KeyMetadata,
	KeyOptions,
} from "./core.ts";

/**
 * Main interface for keystore operations. This defines what a keystore backend must do.
 * Think of it as a "key manager" that can create, store, and use cryptographic keys.
 *
 * Use cases:
 * - Generate keys for signing blockchain transactions.
 * - Import keys from external sources (e.g., other wallets).
 * - Derive new keys from a master seed for HD wallets.
 * - Sign data with private keys and verify signatures with public keys.
 */
export interface KeyStoreBackend {
	/**
	 * Creates a new key pair. This generates both a private key (secret) and public key (shareable).
	 */
	generate(options: GenerateOptions): Promise<KeyId>;

	/**
	 * Imports an existing key into the keystore.
	 */
	import(data: KeyData, format: KeyFormat): Promise<KeyId>;

	/**
	 * Exports a key from the keystore (usually public key only, for security).
	 */
	export(id: KeyId, options?: ExportOptions): Promise<KeyData>;

	/**
	 * Deletes a key from the keystore.
	 */
	remove(id: KeyId): Promise<void>;

	/**
	 * Lists all keys in the keystore.
	 */
	list(): Promise<KeyMetadata[]>;

	/**
	 * Gets details about a specific key.
	 */
	getMetadata(id: KeyId): Promise<KeyMetadata>;

	/**
	 * Signs data with a private key.
	 */
	sign(id: KeyId, data: Uint8Array, algorithm?: string): Promise<Uint8Array>;

	/**
	 * Verifies a signature against data using a public key.
	 */
	verify(
		id: KeyId,
		data: Uint8Array,
		signature: Uint8Array,
		algorithm?: string,
	): Promise<boolean>;

	/**
	 * Encrypts data with a public key (asymmetric encryption).
	 */
	encryptWithKey?(
		id: KeyId,
		data: Uint8Array,
		algorithm?: string,
	): Promise<Uint8Array>;

	/**
	 * Decrypts data with a private key.
	 */
	decryptWithKey?(
		id: KeyId,
		data: Uint8Array,
		algorithm?: string,
	): Promise<Uint8Array>;

	/**
	 * Derives a shared secret for key agreement (e.g., ECDH).
	 */
	deriveSharedSecret?(
		id: KeyId,
		publicKey: Uint8Array,
		meFirst: boolean,
		algorithm?: string,
	): Promise<Uint8Array>;

	/**
	 * Imports a raw seed (64 bytes / 512 bits) for HD wallets.
	 */
	importSeed?(seed: Uint8Array, options?: KeyOptions): Promise<KeyId>;

	/**
	 * Derives a new key from a seed using HD derivation path.
	 */
	deriveFromSeed?(
		seedId: KeyId,
		path: string,
		options?: DeriveOptions,
	): Promise<KeyId>;

	/**
	 * Encrypts arbitrary data (not key-related).
	 */
	encryptData?(data: Uint8Array, passphrase?: string): Promise<Uint8Array>;

	/**
	 * Decrypts data.
	 */
	decryptData?(data: Uint8Array, passphrase?: string): Promise<Uint8Array>;

	/**
	 * Logs an audit event.
	 */
	logAuditEvent?(event: AuditEvent): Promise<void>;

	/**
	 * Gets audit logs.
	 */
	getAuditLogs?(filter?: {
		since?: Date;
		operation?: string;
	}): Promise<AuditEvent[]>;

	/**
	 * Signs multiple data items at once.
	 */
	batchSign?(ids: KeyId[], data: Uint8Array[]): Promise<Uint8Array[]>;
}

// Note: XHDKeyStoreBackendOptions is defined in backend/xhd.ts
// to avoid duplicate exports
