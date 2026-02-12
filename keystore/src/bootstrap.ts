/**
 * Bootstrap example for React Native with TanStack Store and Provider Pattern
 *
 * This shows how a wallet developer would integrate the keystore extension
 * with the provider pattern in a React Native app.
 */

import { createKeyStore, XHDKeyStoreBackend } from "./backend/xhd.ts";
import type { KeystoreConfig } from "./storage/factory.ts";
import type { RawBytesStorage } from "./storage/wrapped.ts";
import type { KeyWrapper, SeedWrapper } from "./types/index.ts";

// ============================================================================
// Example 1: Testing/Development (unsafe but quick to start)
// ============================================================================

const devKeystore = createKeyStore({ mode: "test-only" });

// ============================================================================
// Example 2: Production with React Native
// ============================================================================

// Placeholder implementations for documentation - these would be
// provided by the integrator for their specific platform

class ReactNativeAsyncStorageRaw implements RawBytesStorage {
	async get(_id: string): Promise<Uint8Array> {
		throw new Error(
			"ReactNativeAsyncStorageRaw is a placeholder - implement for your platform",
		);
	}
	async set(_id: string, _data: Uint8Array): Promise<void> {
		throw new Error(
			"ReactNativeAsyncStorageRaw is a placeholder - implement for your platform",
		);
	}
	async delete(_id: string): Promise<boolean> {
		throw new Error(
			"ReactNativeAsyncStorageRaw is a placeholder - implement for your platform",
		);
	}
	async list(): Promise<string[]> {
		throw new Error(
			"ReactNativeAsyncStorageRaw is a placeholder - implement for your platform",
		);
	}
	async getAll(): Promise<Uint8Array[]> {
		throw new Error(
			"ReactNativeAsyncStorageRaw is a placeholder - implement for your platform",
		);
	}
}

class ReactNativeKeychainWrapper implements KeyWrapper {
	async wrap(_data: {
		metadata: import("./types/core.ts").KeyMetadata;
		publicKey: Uint8Array;
		privateKey?: Uint8Array;
		derivationPath?: number[];
		context?: number;
		account?: number;
		keyIndex?: number;
		curve?: "ed25519" | "secp256r1" | undefined;
	}): Promise<Uint8Array> {
		throw new Error(
			"ReactNativeKeychainWrapper is a placeholder - implement for your platform",
		);
	}
	async unwrap(_wrapped: Uint8Array): Promise<{
		metadata: import("./types/core.ts").KeyMetadata;
		publicKey: Uint8Array;
		privateKey?: Uint8Array;
		derivationPath?: number[];
		context?: number;
		account?: number;
		keyIndex?: number;
		curve?: "ed25519" | "secp256r1" | undefined;
	}> {
		throw new Error(
			"ReactNativeKeychainWrapper is a placeholder - implement for your platform",
		);
	}
}

class ReactNativeSecureEnclaveWrapper implements SeedWrapper {
	async wrap(_data: {
		metadata: import("./types/core.ts").KeyMetadata;
		rootKey: Uint8Array;
		derivedMainKey?: Uint8Array | undefined;
	}): Promise<Uint8Array> {
		throw new Error(
			"ReactNativeSecureEnclaveWrapper is a placeholder - implement for your platform",
		);
	}
	async unwrap(_wrapped: Uint8Array): Promise<{
		metadata: import("./types/core.ts").KeyMetadata;
		rootKey: Uint8Array;
		derivedMainKey?: Uint8Array | undefined;
	}> {
		throw new Error(
			"ReactNativeSecureEnclaveWrapper is a placeholder - implement for your platform",
		);
	}
}

// Production example (would be used with real implementations)
const prodKeystore = createKeyStore({
	mode: "wrapped",
	rawStorage: new ReactNativeAsyncStorageRaw(),
	keyWrapper: new ReactNativeKeychainWrapper(),
	seedWrapper: new ReactNativeSecureEnclaveWrapper(),
});

// ============================================================================
// Example 3: With Provider pattern and TanStack Store
// ============================================================================

// Note: TanStack Store import would be from '@tanstack/react-store' in real usage
// This is a simplified type definition for the example
type StoreState = {
	backend: XHDKeyStoreBackend;
	isInitialized: boolean;
	lastError: Error | null;
};

type StoreListener<T> = (state: T) => void;

class Store<T> {
	private state: T;
	private listeners: Set<StoreListener<T>> = new Set();

	constructor(initialState: T) {
		this.state = initialState;
	}

	getState(): T {
		return this.state;
	}

	setState(updater: (state: T) => T): void {
		this.state = updater(this.state);
		for (const listener of this.listeners) {
			listener(this.state);
		}
	}

	subscribe(listener: StoreListener<T>): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}
}

interface KeystoreExtensionOptions {
	useKMS?: boolean;
}

interface KeystoreExtensionResult {
	keystore?: XHDKeyStoreBackend;
	kms?: Store<StoreState>;
}

/**
 * Creates a keystore extension for the provider pattern.
 *
 * @example
 * ```typescript
 * // In your provider setup
 * const extension = createKeystoreExtension({ useKMS: true });
 *
 * // Access in components
 * const { provider } = useWallet();
 * const keystore = provider.keystore;  // XHDKeyStoreBackend instance
 * const kmsState = provider.kms?.getState();  // Reactive state
 * ```
 */
export function createKeystoreExtension(
	options: KeystoreExtensionOptions,
): KeystoreExtensionResult {
	if (!options.useKMS) return {};

	const backend = createKeyStore({
		mode: "wrapped",
		rawStorage: new ReactNativeAsyncStorageRaw(),
		keyWrapper: new ReactNativeKeychainWrapper(),
		seedWrapper: new ReactNativeSecureEnclaveWrapper(),
	});

	// Single instance in TanStack store
	const store = new Store<StoreState>({
		backend,
		isInitialized: false,
		lastError: null,
	});

	return {
		keystore: backend, // Available as provider.keystore
		kms: store, // Reactive state
	};
}

// ============================================================================
// Re-exports for convenience
// ============================================================================

export { createKeyStore, XHDKeyStoreBackend };
export type {
	KeystoreConfig,
	KeystoreExtensionOptions,
	KeystoreExtensionResult,
};
