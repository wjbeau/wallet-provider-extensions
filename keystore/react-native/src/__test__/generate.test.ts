import { describe, it, expect, vi } from 'vitest';
import { generateSeedData, generateXHDRootKeyFromSeed } from '../generate.ts';

// Mocking some of the heavy dependencies
vi.mock('@scure/bip39', () => ({
    generateMnemonic: vi.fn(() => 'test mnemonic'),
    mnemonicToSeed: vi.fn(async () => new Uint8Array(64).fill(1)),
}));

vi.mock('@algorandfoundation/keystore', () => ({
    generateId: vi.fn(() => 'test-id'),
    InvalidKeyDataError: class extends Error {},
    clearKeyData: vi.fn(),
}));

vi.mock('@algorandfoundation/xhd-wallet-api', () => ({
    fromSeed: vi.fn(() => new Uint8Array(32).fill(2)),
    BIP32DerivationType: { Peikert: 0 },
    KeyContext: { Address: 0, Identity: 1 },
    XHDWalletAPI: vi.fn(() => ({
        keyGen: vi.fn(async () => new Uint8Array(32).fill(3)),
    })),
}));

vi.mock('@algorandfoundation/dp256', () => ({
    DeterministicP256: vi.fn(() => ({
        genDomainSpecificKeyPair: vi.fn(async () => new Uint8Array(32).fill(4)),
        getPurePKBytes: vi.fn(() => new Uint8Array(32).fill(5)),
    })),
}));

describe('generate utilities', () => {
    describe('generateSeedData', () => {
        it('should generate seed data with default options', async () => {
            const seed = await generateSeedData();
            expect(seed.id).toBe('test-id');
            expect(seed.type).toBe('hd-seed');
            expect(seed.privateKey).toBeDefined();
            expect(seed.privateKey?.length).toBe(64);
        });

        it('should use provided name', async () => {
            const seed = await generateSeedData({ name: 'My Key' });
            expect(seed.name).toBe('My Key');
        });
    });

    describe('generateXHDRootKeyFromSeed', () => {
        it('should generate root key from valid seed', async () => {
            const seed = {
                id: 'seed-id',
                type: 'hd-seed' as const,
                privateKey: new Uint8Array(64).fill(1),
                metadata: {}
            };
            const rootKey = await generateXHDRootKeyFromSeed(seed as any);
            expect(rootKey.type).toBe('hd-root-key');
            expect(rootKey.metadata.rootKeyId).toBe('seed-id');
        });

        it('should throw error for invalid seed type', async () => {
            const seed = { type: 'invalid' };
            await expect(generateXHDRootKeyFromSeed(seed as any)).rejects.toThrow();
        });
    });
});
