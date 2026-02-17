import type { AuditEvent, KeyId } from "./core.ts";

/**
 * Generic storage interface for typed data.
 * Used for keys, seeds, or any other stored entity.
 * 
 * @template T - The type of data being stored.
 */
export interface Storage<T> {
	/** Retrieves data by its unique identifier */
	get(id: KeyId): Promise<T | undefined>;
	/** Stores data under a unique identifier */
	set(id: KeyId, data: T): Promise<void>;
	/** Deletes data by its identifier */
	delete(id: KeyId): Promise<boolean>;
	/** Lists all identifiers currently in storage */
	list(): Promise<KeyId[]>;
	/** Retrieves all items from storage */
	getAll(): Promise<T[]>;
}

/**
 * Internal format for data stored for a cryptographic key.
 */
export interface StoredKeyData {
	/** Associated metadata for the key */
	metadata: import("./core.ts").KeyMetadata;
	/** Raw bytes of the public key */
	publicKey: Uint8Array;
	/** Raw bytes of the private key (encrypted if managed by a wrapper) */
	privateKey?: Uint8Array;
	/** Optional BIP32-style derivation path */
	derivationPath?: number[];
	/** Implementation specific context */
	context?: number;
	/** Account index for derivation */
	account?: number;
	/** Key index for derivation */
	keyIndex?: number;
	/** The elliptic curve used by the key */
	curve?: "ed25519" | "secp256r1";
}

/**
 * Internal format for data stored for a HD seed.
 */
export interface StoredSeedData {
	/** Associated metadata for the seed */
	metadata: import("./core.ts").KeyMetadata;
	/** Raw bytes of the root master key */
	rootKey: Uint8Array;
	/** Optional pre-derived main key for faster access */
	derivedMainKey?: Uint8Array;
}

/** Storage for cryptographic keys (alias for backward compatibility) */
export type KeyStorage = Storage<StoredKeyData>;

/** Storage for HD seeds (alias for backward compatibility) */
export type SeedStorage = Storage<StoredSeedData>;

/**
 * Audit storage interface for logging and retrieving operations.
 */
export interface AuditStorage {
	/** Appends a new event to the audit log */
	append(event: AuditEvent): Promise<void>;
	/**
	 * Lists audit events matching the filter.
	 * 
	 * @param filter - Search criteria for audit events.
	 */
	list(filter?: { since?: Date; operation?: string }): Promise<AuditEvent[]>;
	/** Clears all audit logs */
	clear(): Promise<void>;
}
