import type { KeyStoreState } from "./store.js";

export type SecretType = "algo25" | "bip39" | "intermezzo" | "pera" | string; // Future examples could be Tokens for any service such as Algod/Indexer

/**
 * Represents a secret key object used for cryptographic operations.
 *
 * The SecretKey interface defines the structure of a key object that includes metadata
 * and the actual cryptographic material. It supports different key types, allowing
 * flexibility for various cryptographic standards or protocols.
 */
export interface SecretKey {
	/**
	 * A unique identifier represented as a string.
	 * This value is used to uniquely distinguish a SecretKey.
	 */
	id: string;
	/**
	 *  A human-readable name or label associated with the secret key.
	 */
	name: string;
	/**
	 * The actual cryptographic material or secret managed by the key (null when applicable, some keys are non-exportable).
	 */
	value: string | null;
	/**
	 * Specifies the key type, which determines the cryptographic standard or protocol
	 * this key adheres to. Ecosystem accepted values are:
	 * - 'algo25': A key based on the Algorand 25-word mnemonic standard.
	 * - 'bip39': A key based on the BIP39 mnemonic standard.
	 * - 'intermezzo': A token used to communicate with Intermezzo vaults.
	 */
	type: SecretType;
	/**
	 * Additional metadata associated with the secret key.
	 */
	metadata?: Record<string, any>;
}

/**
 * Represents a secure storage interface for managing cryptographic keys and secrets.
 *
 * This interface serves as a contract for handling secrets in the form of `SecretKey` objects and
 * managing their lifecycle, as well as any associated extensions or plugins.
 *
 * Properties:
 * - `secrets`: An array of `SecretKey` objects, representing the collection of stored secrets.
 * - `keystore`: An object that represents additional functionality or extensions tied to the keystore.
 */
export interface KeyStoreExtension extends KeyStoreState {
	/**
	 * An object that represents additional functionality provided by this extension.
	 */
	keystore: KeyStoreApi;
}

/**
 * Interface representing a KeyStore extension, which provides methods for key management
 * operations, including adding, removing, importing, and exporting secrets.
 */
export interface KeyStoreApi {
	/**
	 * Adds or registers the provided secret key.
	 *
	 * @function
	 * @param {Partial<SecretKey>} key - A partial representation of the secret key to add.
	 * @returns {Promise<string>} A promise that resolves the key for chaining.
	 */
	add: (key: SecretKey) => Promise<SecretKey>;
	/**
	 * Removes an item identified by the provided ID.
	 *
	 * @param {string} id - The unique identifier of the item to be removed.
	 * @return {Promise<void>} A promise that resolves when the removal is complete.
	 */
	remove: (id: string) => Promise<void>;
	/**
	 * Imports a secret key into the system.
	 *
	 * @param {SecretKey} key - The secret key to be imported.
	 * @returns {Promise<SecretKey>} A promise that resolves to the imported secret key.
	 */
	import: (key: SecretKey) => Promise<SecretKey>;
	/**
	 * Exports data associated with the given identifier.
	 *
	 * This function takes an identifier as input, processes the data
	 * associated with it, and returns a promise that resolves to a
	 * string representation of the exported data.
	 *
	 * @param {string} id - A unique identifier used to specify the data to be exported.
	 * @returns {Promise<SecretKey>} A promise that resolves to the exported key.
	 */
	export: (id: string) => Promise<SecretKey>;
}
