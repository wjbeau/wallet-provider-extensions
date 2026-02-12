import type {
	AuditEvent,
	AuditStorage,
	AuditWrapper,
	KeyId,
	KeyWrapper,
	SeedWrapper,
	StoredKeyData,
	StoredSeedData,
} from "../types/index.ts";

/**
 * Raw bytes storage interface for wrapped data.
 * This is the underlying storage that wrapped storage uses.
 */
export interface RawBytesStorage {
	get(id: KeyId): Promise<Uint8Array>;
	set(id: KeyId, data: Uint8Array): Promise<void>;
	delete(id: KeyId): Promise<boolean>;
	list(): Promise<KeyId[]>;
	getAll(): Promise<Uint8Array[]>;
}

/**
 * Generic wrapper type for storage operations.
 * T is the data type, U is the wrapped type (usually Uint8Array).
 * Renamed to DataWrapper to avoid conflict with types/wrapper.ts interface.
 */
export type DataWrapper<T, U = Uint8Array> = {
	wrap(data: T): Promise<U>;
	unwrap(wrapped: U): Promise<T>;
};

/**
 * Generic wrapped storage that encrypts/decrypts data before storing.
 * This wraps a RawBytesStorage and applies encryption/decryption.
 */
export class WrappedStorage<T> {
	constructor(
		private storage: RawBytesStorage,
		private wrapper: DataWrapper<T>,
	) {}

	async get(id: KeyId): Promise<T> {
		const wrapped = await this.storage.get(id);
		return this.wrapper.unwrap(wrapped);
	}

	async set(id: KeyId, data: T): Promise<void> {
		const wrapped = await this.wrapper.wrap(data);
		await this.storage.set(id, wrapped);
	}

	async delete(id: KeyId): Promise<boolean> {
		return this.storage.delete(id);
	}

	async list(): Promise<KeyId[]> {
		return this.storage.list();
	}

	async getAll(): Promise<T[]> {
		const all = await this.storage.getAll();
		return Promise.all(all.map((w) => this.wrapper.unwrap(w)));
	}
}

/**
 * Wrapped key storage using a KeyWrapper for encryption.
 */
export class WrappedKeyStorage extends WrappedStorage<StoredKeyData> {
	constructor(storage: RawBytesStorage, wrapper: KeyWrapper) {
		super(storage, wrapper as DataWrapper<StoredKeyData>);
	}
}

/**
 * Wrapped seed storage using a SeedWrapper for encryption.
 */
export class WrappedSeedStorage extends WrappedStorage<StoredSeedData> {
	constructor(storage: RawBytesStorage, wrapper: SeedWrapper) {
		super(storage, wrapper as DataWrapper<StoredSeedData>);
	}
}

/**
 * Simple in-memory raw bytes storage.
 * Used as the underlying storage for wrapped storage implementations.
 */
export class InMemoryRawStorage implements RawBytesStorage {
	private data = new Map<string, Uint8Array>();

	async get(id: KeyId): Promise<Uint8Array> {
		const value = this.data.get(id);
		if (!value) throw new Error(`Data not found: ${id}`);
		return value;
	}

	async set(id: KeyId, data: Uint8Array): Promise<void> {
		this.data.set(id, data);
	}

	async delete(id: KeyId): Promise<boolean> {
		return this.data.delete(id);
	}

	async list(): Promise<KeyId[]> {
		return Array.from(this.data.keys());
	}

	async getAll(): Promise<Uint8Array[]> {
		return Array.from(this.data.values());
	}
}

/**
 * Wrapped audit storage using an AuditWrapper for encryption.
 */
export class WrappedAuditStorage implements AuditStorage {
	constructor(
		private storage: RawBytesStorage,
		private wrapper: AuditWrapper,
	) {}

	async append(event: AuditEvent): Promise<void> {
		const wrapped = await this.wrapper.wrap(event);
		// Generate a unique ID for each audit event
		const id = `audit-${Date.now()}-${Math.random().toString(36).slice(2)}`;
		await this.storage.set(id, wrapped);
	}

	async list(filter?: {
		since?: Date;
		operation?: string;
	}): Promise<AuditEvent[]> {
		const allWrapped = await this.storage.getAll();
		const all = await Promise.all(
			allWrapped.map((w) => this.wrapper.unwrap(w)),
		);
		let result = all;
		if (filter?.since) {
			result = result.filter((e) => e.timestamp >= filter.since!);
		}
		if (filter?.operation) {
			result = result.filter((e) => e.operation === filter.operation);
		}
		return result;
	}

	async clear(): Promise<void> {
		const ids = await this.storage.list();
		await Promise.all(ids.map((id) => this.storage.delete(id)));
	}
}
