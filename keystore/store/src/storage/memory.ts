import type {
	AuditEvent,
	AuditStorage,
	KeyId,
	KeyStorage,
	SeedStorage,
	StoredKeyData,
	StoredSeedData,
} from "../types/index.ts";

/**
 * ⚠️ ⚠️ ⚠️  WARNING: UNSAFE STORAGE  ⚠️ ⚠️ ⚠️
 *
 * This is a TEST-ONLY implementation that stores keys in memory.
 * Data is lost when the app closes and exists in plaintext in memory.
 *
 * 🚫 DO NOT USE IN PRODUCTION
 * 🚫 DO NOT USE FOR REAL KEYS
 * 🚫 DO NOT USE FOR REAL SEEDS
 *
 * Use only for:
 * - Unit tests
 * - Development/demos
 * - CI/CD pipelines
 *
 * For production, use WrappedKeyStorage with encrypted storage.
 *
 * @deprecated Use production storage with encryption. This is test-only.
 * @see {@link WrappedKeyStorage} for secure storage
 */
export class UnsafeTestOnlyKeyStorage implements KeyStorage {
	private keys = new Map<string, StoredKeyData>();

	async get(id: KeyId): Promise<StoredKeyData | undefined> {
		return this.keys.get(id);
	}

	async set(id: KeyId, data: StoredKeyData): Promise<void> {
		this.keys.set(id, data);
	}

	async delete(id: KeyId): Promise<boolean> {
		return this.keys.delete(id);
	}

	async list(): Promise<KeyId[]> {
		return Array.from(this.keys.keys());
	}

	async getAll(): Promise<StoredKeyData[]> {
		return Array.from(this.keys.values());
	}
}

/**
 * ⚠️ ⚠️ ⚠️  WARNING: UNSAFE STORAGE  ⚠️ ⚠️ ⚠️
 *
 * This is a TEST-ONLY implementation that stores seeds in memory.
 * Seeds are your master keys - if compromised, ALL derived keys are lost.
 *
 * 🚫 DO NOT USE IN PRODUCTION
 * 🚫 DO NOT USE FOR REAL SEEDS
 * 🚫 DO NOT USE FOR REAL WALLETS
 *
 * Use only for:
 * - Unit tests
 * - Development/demos
 * - CI/CD pipelines
 *
 * For production, use WrappedSeedStorage with hardware security modules
 * or platform secure enclaves (iOS Keychain, Android Keystore, etc.)
 *
 * @deprecated Use production storage with encryption. This is test-only.
 * @see {@link WrappedSeedStorage} for secure storage
 */
export class UnsafeTestOnlySeedStorage implements SeedStorage {
	private seeds = new Map<string, StoredSeedData>();

	async get(id: KeyId): Promise<StoredSeedData | undefined> {
		return this.seeds.get(id);
	}

	async set(id: KeyId, data: StoredSeedData): Promise<void> {
		this.seeds.set(id, data);
	}

	async delete(id: KeyId): Promise<boolean> {
		return this.seeds.delete(id);
	}

	async list(): Promise<KeyId[]> {
		return Array.from(this.seeds.keys());
	}

	async getAll(): Promise<StoredSeedData[]> {
		return Array.from(this.seeds.values());
	}
}

/**
 * ⚠️  WARNING: VOLATILE STORAGE  ⚠️
 *
 * This stores audit logs in memory. Data is lost when app closes.
 *
 * For production, use persistent storage (file, database, or log aggregation service).
 *
 * @deprecated Use persistent storage for production audit logs.
 */
export class InMemoryAuditStorage implements AuditStorage {
	private events: AuditEvent[] = [];

	async append(event: AuditEvent): Promise<void> {
		this.events.push(event);
	}

	async list(filter?: {
		since?: Date;
		operation?: string;
	}): Promise<AuditEvent[]> {
		let result = [...this.events];
		if (filter?.since) {
			const since = filter.since;
			result = result.filter((e) => e.timestamp >= since);
		}
		if (filter?.operation) {
			result = result.filter((e) => e.operation === filter.operation);
		}
		return result;
	}

	async clear(): Promise<void> {
		this.events = [];
	}
}

/**
 * @deprecated Use {@link UnsafeTestOnlyKeyStorage}. This alias will be removed.
 */
export const InMemoryKeyStorage: typeof UnsafeTestOnlyKeyStorage =
	UnsafeTestOnlyKeyStorage;

/**
 * @deprecated Use {@link UnsafeTestOnlySeedStorage}. This alias will be removed.
 */
export const InMemorySeedStorage: typeof UnsafeTestOnlySeedStorage =
	UnsafeTestOnlySeedStorage;
