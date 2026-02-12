import type { AuditEvent, KeyId } from "./core.ts";

/**
 * Generic storage interface for typed data.
 * Used for keys, seeds, or any other stored entity.
 */
export interface Storage<T> {
	get(id: KeyId): Promise<T | undefined>;
	set(id: KeyId, data: T): Promise<void>;
	delete(id: KeyId): Promise<boolean>;
	list(): Promise<KeyId[]>;
	getAll(): Promise<T[]>;
}

/**
 * Data stored for a key (internal format).
 */
export interface StoredKeyData {
	metadata: import("./core.ts").KeyMetadata;
	publicKey: Uint8Array;
	privateKey?: Uint8Array;
	derivationPath?: number[];
	context?: number;
	account?: number;
	keyIndex?: number;
	curve?: "ed25519" | "secp256r1";
}

/**
 * Data stored for a seed (internal format).
 */
export interface StoredSeedData {
	metadata: import("./core.ts").KeyMetadata;
	rootKey: Uint8Array;
	derivedMainKey?: Uint8Array;
}

/** Storage for cryptographic keys (alias for backward compatibility) */
export type KeyStorage = Storage<StoredKeyData>;

/** Storage for HD seeds (alias for backward compatibility) */
export type SeedStorage = Storage<StoredSeedData>;

/**
 * Audit storage interface for logging operations.
 */
export interface AuditStorage {
	append(event: AuditEvent): Promise<void>;
	list(filter?: { since?: Date; operation?: string }): Promise<AuditEvent[]>;
	clear(): Promise<void>;
}
