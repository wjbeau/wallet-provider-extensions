import type { AuditEvent } from "./core.ts";
import type { StoredKeyData, StoredSeedData } from "./storage.ts";

/**
 * Generic wrapper interface for encrypting/decrypting data of type T.
 * This is the base interface used to provide a layer of security before data is sent to storage.
 *
 * @template T - The type of data structure being wrapped.
 */
export interface Wrapper<T> {
	/**
	 * Encrypts or encodes data into a raw byte array.
	 *
	 * @param data - The data structure to protect.
	 * @returns The wrapped byte array.
	 */
	wrap(data: T): Promise<Uint8Array>;
	/**
	 * Decrypts or decodes data back into its original structure.
	 *
	 * @param wrapped - The wrapped byte array.
	 * @returns The original data structure.
	 */
	unwrap(wrapped: Uint8Array): Promise<T>;
}

/**
 * Wrapper interface for encrypting/decrypting key data before storage.
 * This allows integrators to implement custom encryption schemes (e.g., hardware-backed or passphrase-derived)
 * while keeping the storage interface focused on raw bytes.
 *
 * Use case: Provide AES-GCM encryption, ChaCha20-Poly1305, or platform-specific
 * encryption (iOS Keychain, Android Keystore, etc.) as a separate layer.
 */
export interface KeyWrapper extends Wrapper<StoredKeyData> {}

/**
 * Wrapper interface for encrypting/decrypting seed data before storage.
 * Seeds are highly sensitive and often require stronger protection or specialized handling (e.g., HSM, secure enclave).
 */
export interface SeedWrapper extends Wrapper<StoredSeedData> {}

/**
 * Wrapper interface for encrypting/decrypting audit data before storage.
 * Audit logs may be encrypted for privacy compliance (GDPR, HIPAA) or to ensure integrity.
 */
export interface AuditWrapper extends Wrapper<AuditEvent> {}

/**
 * Low-level storage backend interface for raw bytes.
 * This is the interface that `WrappedStorage` uses internally to persist encrypted data.
 */
export interface RawBytesStorage {
	/** Retrieves raw bytes by ID */
	get(id: import("./core.ts").KeyId): Promise<Uint8Array | undefined>;
	/** Persists raw bytes under an ID */
	set(id: import("./core.ts").KeyId, data: Uint8Array): Promise<void>;
	/** Removes data by ID */
	delete(id: import("./core.ts").KeyId): Promise<boolean>;
	/** Lists all IDs in storage */
	list(): Promise<import("./core.ts").KeyId[]>;
	/** Retrieves all stored byte arrays */
	getAll(): Promise<Uint8Array[]>;
}
