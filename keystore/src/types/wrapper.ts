import type { AuditEvent } from "./core.ts";
import type { StoredKeyData, StoredSeedData } from "./storage.ts";

/**
 * Generic wrapper interface for encrypting/decrypting data of type T.
 * This is the base interface - for the storage implementation, see storage/wrapped.ts
 */
export interface Wrapper<T> {
	wrap(data: T): Promise<Uint8Array>;
	unwrap(wrapped: Uint8Array): Promise<T>;
}

/**
 * Wrapper interface for encrypting/decrypting key data before storage.
 * This allows integrators to implement custom encryption schemes while
 * keeping the storage interface simple (raw bytes/string storage).
 *
 * Use case: Provide AES-GCM encryption, ChaCha20-Poly1305, or platform-specific
 * encryption (iOS Keychain, Android Keystore, etc.) as a separate layer.
 */
export interface KeyWrapper extends Wrapper<StoredKeyData> {}

/**
 * Wrapper interface for encrypting/decrypting seed data before storage.
 * Seeds are the most sensitive data and often need special handling (HSM, secure enclave).
 */
export interface SeedWrapper extends Wrapper<StoredSeedData> {}

/**
 * Wrapper interface for encrypting/decrypting audit data before storage.
 * Audit logs may need encryption for compliance (GDPR, HIPAA) or to prevent tampering.
 */
export interface AuditWrapper extends Wrapper<AuditEvent> {}

// Note: RawBytesStorage and the concrete Wrapper type are defined in storage/wrapped.ts
// to avoid duplicate exports
