import type { Account } from "@algorandfoundation/accounts-store";
import type { Key, KeyId } from "@algorandfoundation/keystore";
import type { Extension } from "@algorandfoundation/wallet-provider";
import type {
	AccountsKeystoreExtension,
	AccountsKeystoreExtensionOptions,
} from "./types.ts";

/**
 * Extension that bridges the account store and keystore.
 *
 * It automatically populates the account store with accounts derived from keys
 * in the keystore, providing a sign method that leverages the keystore backend.
 */
export const WithAccountsKeystore: Extension<AccountsKeystoreExtension> = (
	provider,
	options: AccountsKeystoreExtensionOptions = {},
) => {
	// Ensure dependencies are present
	if (!provider.account) {
		throw new Error(
			"AccountsKeystore extension requires WithAccountStore extension to be present on the provider.",
		);
	}
	if (!provider.keystore) {
		throw new Error(
			"AccountsKeystore extension requires WithKeyStore extension to be present on the provider.",
		);
	}

	const { autoPopulate = true } = options.accounts?.keystore ?? {};

	/**
	 * Creates an account object for a given key ID and address.
	 */
	const createKeyAccount = (keyId: string, address: string): Account => ({
		address,
		metadata: { keyId },
		// TODO: TransactionSigners
		sign: async (txns: Uint8Array[]) => {
			// Sign each transaction using the keystore
			const signedTxns: Uint8Array[] = [];
			for (const txn of txns) {
				const signed = await provider.keystore.sign(keyId, txn);
				signedTxns.push(signed);
			}
			return signedTxns;
		},
	});

	// Initial population if enabled
	if (autoPopulate) {
		console.log("Auto-populating accounts from keystore...");
		const keys = (provider.keys as Key[]) ?? [];
		for (const key of keys) {
			console.log(`Adding account for key ${key.id}-${key.type}...`);
			if (key.type === "hd-derived-ed25519") {
				provider.account.store.addAccount(createKeyAccount(key.id, key?.metadata?.address as string ?? "TODO: Add addresses to types"));
			}
		}

		// Listen for new keys added to the keystore
		provider.keystore.hooks.after("generate", async (keyId: KeyId) => {
			const key: Key = provider.keys?.find((k: Key) => k.id === keyId);
			const address = (key.metadata?.address as string) || key.id;
			console.log(`Added key ${keyId} to keystore, adding account...`);
			if ((address && address.length === 58) || key.type === "hd-derived-ed25519") {
				console.log(`Adding account for key ${keyId}...`);
				await provider.account.store.addAccount(createKeyAccount(key.id, address));
			}
		});
	}

	// This extension doesn't add new API methods, it just bridges existing ones.
	// But it must return an object that matches the combined interface.
	return provider as unknown as AccountsKeystoreExtension;
};
