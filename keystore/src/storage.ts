import type {
	AuditEvent,
	AuditStorage,
	KeyId,
	KeyStorage,
	SeedStorage,
	StoredKeyData,
	StoredSeedData,
} from "./types.ts";

/**
 * In-memory key storage implementation for storing cryptographic keys.
 * This class provides a simple key-value storage mechanism using a Map
 * for temporary key storage during runtime.
 */
export class InMemoryKeyStorage implements KeyStorage {
	/** Internal storage for keys using Map keyed by KeyId */
	private keys = new Map<KeyId, StoredKeyData>();

	/**
	 * Retrieves a key by its ID
	 * @param id - The unique identifier of the key to retrieve
	 * @returns The stored key data or undefined if not found
	 */
	async get(id: KeyId): Promise<StoredKeyData> {
		// throw if key not found to simplify error handling in tests
		const keyData = this.keys.get(id);
		if (!keyData) {
			throw new Error(`Key with ID ${id} not found`);
		}
		return keyData;
	}

	/**
	 * Stores a key with the specified ID
	 * @param id - The unique identifier for the key
	 * @param data - The key data to store
	 */
	async set(id: KeyId, data: StoredKeyData): Promise<void> {
		this.keys.set(id, data);
	}

	/**
	 * Deletes a key by its ID
	 * @param id - The unique identifier of the key to delete
	 * @returns true if the key was found and deleted, false otherwise
	 */
	async delete(id: KeyId): Promise<boolean> {
		return this.keys.delete(id);
	}

	/**
	 * Lists all stored key IDs
	 * @returns An array of all stored key IDs
	 */
	async list(): Promise<KeyId[]> {
		return Array.from(this.keys.keys());
	}

	/**
	 * Retrieves all stored key data
	 * @returns An array of all stored key data
	 */
	async getAll(): Promise<StoredKeyData[]> {
		return Array.from(this.keys.values());
	}
}

export class InMemorySeedStorage implements SeedStorage {
	private seeds = new Map<KeyId, StoredSeedData>();

	async get(id: KeyId): Promise<StoredSeedData> {
		// throw if seed not found to simplify error handling in tests
		const seedData = this.seeds.get(id);
		if (!seedData) {
			throw new Error(`Seed with ID ${id} not found`);
		}
		return seedData;
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

export class InMemoryAuditStorage implements AuditStorage {
	private logs: AuditEvent[] = [];

	async append(event: AuditEvent): Promise<void> {
		this.logs.push({ ...event });
	}

	async list(filter?: {
		since?: Date;
		operation?: string;
	}): Promise<AuditEvent[]> {
		let result = [...this.logs];

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
		this.logs = [];
	}
}
