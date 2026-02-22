import type { Key } from "@algorandfoundation/keystore";
import { describe, expect, it, vi } from "vitest";
import { WithAccountsKeystore } from "../extension.ts";

describe("WithAccountsKeystore", () => {
	it("should populate accounts from keystore keys in provider", async () => {
		const mockAddress = "A".repeat(58);
		const mockKey: Partial<Key> = {
			id: mockAddress,
			metadata: { address: mockAddress },
		};

		const mockAddAccount = vi.fn();
		const provider = {
			keys: [mockKey],
			account: {
				addAccount: mockAddAccount,
			},
			keystore: {
				hooks: {
					after: vi.fn(),
				},
			},
		};

		WithAccountsKeystore(provider as any);

		expect(mockAddAccount).toHaveBeenCalled();
		const addedAccount = mockAddAccount.mock.calls[0][0];
		expect(addedAccount.address).toBe(mockAddress);
		expect(addedAccount.metadata.keyId).toBe(mockAddress);
	});

	it("should provide a sign method that calls keystore.sign", async () => {
		const mockAddress = "A".repeat(58);
		const mockKeyId = "key-123";
		const mockKey: Partial<Key> = {
			id: mockKeyId,
			metadata: { address: mockAddress },
		};

		const mockAddAccount = vi.fn();
		const mockSign = vi.fn().mockResolvedValue(new Uint8Array([4, 5, 6]));
		const provider = {
			keys: [mockKey],
			account: {
				addAccount: mockAddAccount,
			},
			keystore: {
				sign: mockSign,
				hooks: {
					after: vi.fn(),
				},
			},
		};

		WithAccountsKeystore(provider as any);

		const addedAccount = mockAddAccount.mock.calls[0][0];
		const txns = [new Uint8Array([1, 2, 3])];
		const signedTxns = await addedAccount.sign(txns);

		expect(mockSign).toHaveBeenCalledWith(mockKeyId, txns[0]);
		expect(signedTxns[0]).toEqual(new Uint8Array([4, 5, 6]));
	});
});
