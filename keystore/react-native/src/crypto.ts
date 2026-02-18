import {KeyContext} from "@algorandfoundation/xhd-wallet-api";

/**
 * Hardens a number for BIP32 derivation (adds 0x80000000).
 * @param num - The index to harden
 * @returns The hardened index
 */
export const harden = (num: number): number => 0x80_00_00_00 + num;

/**
 * Generates a BIP44 path based on the key context, account, and index.
 * @param context - The {@link KeyContext} (e.g., Address or Identity)
 * @param account - The account index
 * @param key_index - The key index
 * @returns An array of hardened and unhardened path components
 * @throws Error if context is invalid
 */
export function getBIP44PathFromContext(context: KeyContext, account:number, key_index: number): number[] {
    switch (context) {
        case KeyContext.Address:
            return [harden(44), harden(283), harden(account), 0, key_index]
        case KeyContext.Identity:
            return [harden(44), harden(0), harden(account), 0, key_index]
        default:
            throw Error("Invalid context")
    }
}