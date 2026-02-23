import type {Account, AccountStoreExtension} from "@algorandfoundation/accounts-store";
import type {Key, KeyId, KeyStoreExtension, XHDDerivedKeyData} from "@algorandfoundation/keystore";
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
	provider: KeyStoreExtension & AccountStoreExtension,
	options: AccountsKeystoreExtensionOptions,
) => {
	// Ensure dependencies are present
	if (!provider.account) {
		throw new Error(
			"AccountsKeystore extension requires WithAccountStore extension to be present on the provider.",
		);
	}
	if (!provider.key) {
		throw new Error(
			"AccountsKeystore extension requires WithKeyStore extension to be present on the provider.",
		);
	}

	const keyStore = options.keystore.store;
	const { autoPopulate = true } = options.accounts.keystore ?? {};

	/**
	 * Creates an account object for a given key ID and address.
	 */
	const createKeyAccount = (keyId: string, address: string): Account => ({
		address,
		type: "ed25519",
		assets: [],
		metadata: { keyId },
		balance: BigInt(0),

		// TODO: Transfer helper
		transfer(amount: bigint, account: Account) {
			console.log(`Transferring ${amount} from ${address} to ${account.address}`);
		},
		// TODO: TransactionSigners
		sign: async (txns: Uint8Array[]) => {
			// Sign each transaction using the keystore
			const signedTxns: Uint8Array[] = [];
			for (const txn of txns) {
				const signed = await provider.key.store.sign(keyId, txn);
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
				provider.account.store.addAccount(createKeyAccount(key.id, (key as XHDDerivedKeyData)?.metadata?.address?.algorand as string ?? "TODO: Add addresses to types"));
			}
		}


		keyStore.subscribe((state)=>{
			// Find new keys by comparing current keys with previous keys
			const prevKeyIds = new Set(state.prevVal.keys.map(k => k.id));
			const newKeys = state.currentVal.keys.filter(key => !prevKeyIds.has(key.id));

			newKeys.forEach((key) => {
				if (key.type === "hd-derived-ed25519" && key.metadata?.address) {
					const address = (key as XHDDerivedKeyData).metadata.address.algorand as string;
					console.log(`New key ${key.id} detected, adding account...`);
					provider.account.store.addAccount(createKeyAccount(key.id, address));
				}
			})
		})

		// We can also listen for new keys added to the keystore
		provider.key.store.hooks.after("generate", async (keyId: KeyId) => {
			console.log(`Key ${keyId} was generated successfully.`);
		});
	}

	// This extension doesn't add new API methods, it just bridges existing ones.
	// But it must return an object that matches the combined interface.
	return provider as unknown as AccountsKeystoreExtension;
};
