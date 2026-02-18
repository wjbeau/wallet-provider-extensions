import type {
	AuditStorage,
	KeyStorage,
	KeyWrapper,
	RawBytesStorage,
	SeedStorage,
	SeedWrapper,
} from "../types/index.ts";
import {
	InMemoryAuditStorage,
	UnsafeTestOnlyKeyStorage,
	UnsafeTestOnlySeedStorage,
} from "./memory.ts";
import { WrappedKeyStorage, WrappedSeedStorage } from "./wrapped.ts";

/**
 * Configuration for creating a keystore backend.
 * This provides a simpler way to configure storage without needing to
 * instantiate storage classes manually.
 */
export interface KeystoreConfig {
	/**
	 * Storage mode - determines how keys and seeds are stored.
	 * @default 'test-only' - uses unsafe in-memory storage (for testing only)
	 */
	mode?: "test-only" | "wrapped" | "custom";

	/**
	 * For 'wrapped' mode: the raw storage backend (e.g., AsyncStorage, SQLite, Filesystem).
	 * The integrator provides this based on their platform.
	 */
	rawStorage?: RawBytesStorage;

	/**
	 * For 'wrapped' mode: optional custom wrapper for key encryption.
	 * If not provided, a default wrapper will be used (platform-dependent).
	 */
	keyWrapper?: KeyWrapper;

	/**
	 * For 'wrapped' mode: optional custom wrapper for seed encryption.
	 * If not provided, a default wrapper will be used (platform-dependent).
	 */
	seedWrapper?: SeedWrapper;

	/** Custom key storage (for 'custom' mode) */
	keyStorage?: KeyStorage;

	/** Custom seed storage (for 'custom' mode) */
	seedStorage?: SeedStorage;

	/** Custom audit storage (optional, defaults to in-memory) */
	auditStorage?: AuditStorage;
}

/**
 * Factory function to create storage backends based on configuration.
 *
 * This is the RECOMMENDED way to create storage for the keystore.
 * It provides sensible defaults and guides developers toward secure patterns.
 *
 * @example
 * ```typescript
 * // For testing only - data lost when app closes
 * const testStorage = createKeystoreStorage({ mode: 'test-only' });
 *
 * // For production - with platform-specific encrypted storage
 * const prodStorage = createKeystoreStorage({
 *   mode: 'wrapped',
 *   rawStorage: new AsyncStorageRaw(), // React Native AsyncStorage
 *   keyWrapper: new ReactNativeKeychainWrapper(), // iOS Keychain/Android Keystore
 *   seedWrapper: new SecureEnclaveWrapper() // Hardware-backed encryption
 * });
 * ```
 */
export function createKeystoreStorage(config: KeystoreConfig = {}): {
	keyStorage: KeyStorage;
	seedStorage: SeedStorage;
	auditStorage: AuditStorage;
} {
	const mode = config.mode ?? "test-only";

	switch (mode) {
		case "test-only": {
			console.warn(
				"⚠️  WARNING: Using UNSAFE test-only storage. " +
					"Keys and seeds are stored in plaintext and lost when app closes. " +
					"DO NOT USE IN PRODUCTION!",
			);
			return {
				keyStorage: new UnsafeTestOnlyKeyStorage(),
				seedStorage: new UnsafeTestOnlySeedStorage(),
				auditStorage: config.auditStorage ?? new InMemoryAuditStorage(),
			};
		}

		case "wrapped": {
			if (!config.rawStorage) {
				throw new Error(
					"'wrapped' mode requires 'rawStorage' to be provided. " +
						"Please provide a RawBytesStorage implementation for your platform " +
						"(e.g., AsyncStorage for React Native, LocalStorage for web, etc.)",
				);
			}

			// If no wrapper provided, we'll need a default
			// The default should be provided by the platform-specific implementation
			if (!config.keyWrapper || !config.seedWrapper) {
				throw new Error(
					"'wrapped' mode requires 'keyWrapper' and 'seedWrapper' to be provided. " +
						"These handle encryption/decryption of your keys and seeds. " +
						"For React Native, use ReactNativeKeychainWrapper or similar.",
				);
			}

			return {
				keyStorage: new WrappedKeyStorage(config.rawStorage, config.keyWrapper),
				seedStorage: new WrappedSeedStorage(
					config.rawStorage,
					config.seedWrapper,
				),
				auditStorage: config.auditStorage ?? new InMemoryAuditStorage(),
			};
		}

		case "custom": {
			if (!config.keyStorage || !config.seedStorage) {
				throw new Error(
					"'custom' mode requires both 'keyStorage' and 'seedStorage' to be provided.",
				);
			}
			return {
				keyStorage: config.keyStorage,
				seedStorage: config.seedStorage,
				auditStorage: config.auditStorage ?? new InMemoryAuditStorage(),
			};
		}

		default:
			throw new Error(`Unknown storage mode: ${mode}`);
	}
}
