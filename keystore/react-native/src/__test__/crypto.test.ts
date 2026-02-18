import { describe, it, expect } from 'vitest';
import { KeyContext } from "@algorandfoundation/xhd-wallet-api";
import { harden, getBIP44PathFromContext } from '../crypto.ts';

describe('crypto utilities', () => {
    describe('harden', () => {
        it('should correctly harden a number', () => {
            expect(harden(44)).toBe(0x80000000 + 44);
            expect(harden(0)).toBe(0x80000000);
        });
    });

    describe('getBIP44PathFromContext', () => {
        it('should return correct path for Address context', () => {
            const path = getBIP44PathFromContext(KeyContext.Address, 1, 2);
            expect(path).toEqual([
                harden(44),
                harden(283),
                harden(1),
                0,
                2
            ]);
        });

        it('should return correct path for Identity context', () => {
            const path = getBIP44PathFromContext(KeyContext.Identity, 0, 5);
            expect(path).toEqual([
                harden(44),
                harden(0),
                harden(0),
                0,
                5
            ]);
        });

        it('should throw error for invalid context', () => {
            expect(() => getBIP44PathFromContext('invalid' as any, 0, 0)).toThrow('Invalid context');
        });
    });
});
