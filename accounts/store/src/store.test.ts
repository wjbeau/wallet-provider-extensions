import { Provider } from "@algorandfoundation/wallet-provider";
import { Store } from "@tanstack/store";
import { describe, expect, it } from "vitest";
import { WithAccountStore } from "./extension.ts";
import { addAccount, clearAccounts, getAccount, removeAccount } from "./store.ts";
import type { Account, AccountStoreState } from "./types.ts";

describe("Account Store Extension", () => {
	it("should align with README usage", async () => {
		const MyProvider = Provider.withExtensions([WithAccountStore]);
		const provider = new MyProvider({ id: "test", name: "Test" }) as any;

		// Access account store methods
		const mockAddress = "A".repeat(58);
		await provider.account.store.addAccount({
			address: mockAddress,
			type: "ed25519",
			balance: BigInt(0),
			assets: [],
		});
		expect(provider.accounts).toHaveLength(1);
		expect(provider.accounts[0].address).toEqual(mockAddress);

		await provider.account.store.clear();
		expect(provider.accounts).toHaveLength(0);
	});

	describe("store functions", () => {
		it("should add an account", () => {
			const store = new Store<AccountStoreState>({
				accounts: [],
			});
			const account: Account = {
				address: "A".repeat(58),
				type: "ed25519",
				balance: BigInt(0),
				assets: [],
			};
			addAccount({ store, account });
			expect(store.state.accounts).toContain(account);
		});

		it("should remove an account", () => {
			const mockAddress = "A".repeat(58);
			const account: Account = {
				address: mockAddress,
				type: "ed25519",
				balance: BigInt(0),
				assets: [],
			};
			const store = new Store<AccountStoreState>({
				accounts: [account],
			});
			removeAccount({ store, address: mockAddress });
			expect(store.state.accounts).not.toContain(account);
		});

		it("should get an account", () => {
			const mockAddress = "A".repeat(58);
			const account: Account = {
				address: mockAddress,
				type: "ed25519",
				balance: BigInt(0),
				assets: [],
			};
			const store = new Store<AccountStoreState>({
				accounts: [account],
			});
			const found = getAccount({ store, address: mockAddress });
			expect(found).toEqual(account);
		});

		it("should return undefined for non-existent account", () => {
			const store = new Store<AccountStoreState>({
				accounts: [],
			});
			const found = getAccount({ store, address: "non-existent" });
			expect(found).toBeUndefined();
		});
		it("should clear accounts", () => {
			const account: Account = {
				address: "A".repeat(58),
				type: "ed25519",
				balance: BigInt(0),
				assets: [],
			};
			const store = new Store<AccountStoreState>({
				accounts: [account],
			});
			clearAccounts({ store });
			expect(store.state.accounts).toHaveLength(0);
		});
	});
});
