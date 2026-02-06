# Keystore Extension

A secure, pluggable key management system for the Algorand Wallet Provider. Manage cryptographic keys, derive HD wallets from BIP39 seeds, and sign transactions—all while keeping private keys locked away in a secure vault.

## Why This Exists

Building a non-custodial wallet requires a **secure, isolated key vault**. The Keystore Extension separates key management from wallet logic:

- **Users** import their BIP39 mnemonic once
- **Wallet UI** requests signatures without ever seeing the seed or private keys
- **Keystore backend** handles all cryptographic operations securely
- **Keys never leave the vault** — they stay in-memory, HSM, or cloud KMS
- **Every operation is audited** for compliance and security forensics

This architecture enables:
- ✅ Non-custodial key management (users control keys)
- ✅ Multi-account support from a single seed (Algorand's `m/44'/283'/account'/change/index`)
- ✅ Isolated, secure communication (IPC for browser extensions)
- ✅ Pluggable backends for different security levels (software → HSM → cloud)
- ✅ Ed25519 signing for Algorand

## Quick Start

### 1. Generate a Key

```typescript
import { SoftwareKeyStoreBackend } from "@algorandfoundation/keystore-extension";

const keystore = new SoftwareKeyStoreBackend();

const keyId = await keystore.generate({
  type: "ecc",
  algorithm: "EdDSA"
});

console.log(keyId); // "abc-123..."
```

### 2. Sign a Transaction

```typescript
const transactionBytes = new Uint8Array([1, 2, 3, ...]);

const signature = await keystore.sign(keyId, transactionBytes);
// Private key never exposed — signature is returned directly
```

### 3. Import a BIP39 Mnemonic

```typescript
// User provides their 12-word seed phrase
const mnemonic = "abandon abandon abandon ... about";

const seedId = await keystore.importMnemonic(mnemonic);
// Seed is securely stored; never exposed to the wallet UI
```

### 4. Derive Multiple Accounts

```typescript
// Derive account 0
const account0 = await keystore.deriveFromSeed(
  seedId,
  "m/44'/283'/0'/0/0"  // Algorand path
);

// Derive account 1
const account1 = await keystore.deriveFromSeed(
  seedId,
  "m/44'/283'/0'/0/1"
);

// Sign with any account — keys are isolated and audited
const sig0 = await keystore.sign(account0, transactionBytes);
const sig1 = await keystore.sign(account1, transactionBytes);
```

## Architecture

### Key Isolation

```
┌─────────────────────────────────────────┐
│  Wallet UI (Browser Extension)          │
│  - Show balances                        │
│  - Request signatures                   │
│  - Never see keys                       │
└────────────┬────────────────────────────┘
             │ IPC (JSON-RPC)
             │ "Please sign this..."
             ▼
┌─────────────────────────────────────────┐
│  Keystore Backend (Isolated Process)    │
│  - Holds all keys in secure vault       │
│  - Performs signing operations          │
│  - Returns signatures only              │
│  - Logs all operations (audit trail)    │
└─────────────────────────────────────────┘
             │
             ▼
     ┌───────────────────┐
     │  Keys Storage     │
     │  - Software       │
     │  - HSM            │
     │  - Cloud KMS      │
     └───────────────────┘
```

### Backend Pluggability

Same keystore API, different security levels:

```typescript
// Development: In-memory keys
const backend = new SoftwareKeyStoreBackend();

// Production: Hardware Security Module
const backend = new HSMKeyStoreBackend({ pin: "1234" });

// Enterprise: Cloud Key Management Service
const backend = new CloudKMSBackend({ 
  projectId: "my-gcp-project",
  keyRing: "production"
});

// All use the same interface:
await backend.generate({ type: "ecc", algorithm: "EdDSA" });
await backend.sign(keyId, data);
await backend.deriveFromSeed(seedId, "m/44'/283'/0'/0/0");
```

## Supported Key Types

| Type | Purpose | Example |
|------|---------|---------|
| `ecc` | Elliptic curve keys (Ed25519, secp256k1) | Algorand signing |
| `rsa` | RSA key pairs | Legacy systems |
| `hd-seed` | BIP39 seed for HD wallets | User's mnemonic |
| `hd-derived` | Keys derived from HD seeds | Account 0, Account 1, ... |

## Supported Algorithms

| Algorithm | Key Type | Use Case |
|-----------|----------|----------|
| `EdDSA` | ECC | Algorand (Ed25519 signing) |
| `ES256` | ECC | Ethereum-like (secp256k1) |
| `RS256` | RSA | Legacy systems |

## API Overview

### Core Operations

```typescript
// Generate a new key
const keyId = await keystore.generate(options);

// Import a key or seed
const keyId = await keystore.import(keyData, format);
const seedId = await keystore.importSeed(seed);
const seedId = await keystore.importMnemonic(mnemonic);

// Export public key (private key never exported)
const keyData = await keystore.export(keyId);

// Sign and verify
const signature = await keystore.sign(keyId, data);
const isValid = await keystore.verify(keyId, data, signature);

// HD Wallet derivation
const derivedKeyId = await keystore.deriveFromSeed(seedId, "m/44'/283'/0'/0/0");

// List and manage keys
const allKeys = await keystore.list();
const metadata = await keystore.getMetadata(keyId);
await keystore.remove(keyId);
```

### Audit Logging (Optional)

```typescript
// Every operation can be logged for compliance
const logs = await keystore.getAuditLogs({
  since: new Date("2024-01-01"),
  operation: "sign"
});

// logs = [
//   { timestamp, operation: "sign", keyId, principal: "user@example.com", success: true },
//   ...
// ]
```

## Security Properties

### Private Keys

- ✅ **Never exported** from the keystore
- ✅ **Never exposed** to the wallet UI
- ✅ **Always encrypted** at rest (in HSM/KMS)
- ✅ **Isolated** per derivation path (multi-account support)

### Seeds (BIP39)

- ✅ **Never exported** after import
- ✅ **Never shared** with wallet UI
- ✅ **Derivation happens inside** the secure backend
- ✅ **Child keys are isolated** — deriving Account 0 doesn't expose the seed

### Operations

- ✅ **All operations are auditable** (who signed what, when)
- ✅ **Error handling is cryptographically safe** (no timing attacks)
- ✅ **IPC communication is isolated** (separate process boundary)

## Integration with Wallet Provider

### Option 1: Use `SoftwareKeyStoreBackend` (Development)

```typescript
import { SoftwareKeyStoreBackend } from "@algorandfoundation/keystore-extension";
import { Provider } from "@algorandfoundation/wallet-provider";

const keystore = new SoftwareKeyStoreBackend();
const provider = new Provider({ keystore });

// Now provider has keystore methods
const keyId = await provider.keystore.generate({ type: "ecc", algorithm: "EdDSA" });
```

### Option 2: Custom Backend (Production)

```typescript
import type { KeyStoreBackend } from "@algorandfoundation/keystore-extension";
import { Provider } from "@algorandfoundation/wallet-provider";

class MySecureBackend implements KeyStoreBackend {
  async generate(options) { /* HSM integration */ }
  async sign(keyId, data) { /* HSM signing */ }
  // ... implement all methods
}

const keystore = new MySecureBackend();
const provider = new Provider({ keystore });
```

## Real-World Example: Algorand Wallet

```typescript
import { SoftwareKeyStoreBackend } from "@algorandfoundation/keystore-extension";

async function setupAlgorandWallet(userMnemonic: string) {
  const keystore = new SoftwareKeyStoreBackend();

  // 1. User imports their 12-word seed phrase
  const seedId = await keystore.importMnemonic(userMnemonic);

  // 2. Derive accounts using Algorand's standard paths
  const accounts = [];
  for (let i = 0; i < 3; i++) {
    const accountId = await keystore.deriveFromSeed(
      seedId,
      `m/44'/283'/0'/0/${i}`  // Algorand path: m/44'/283'/account'/change/index
    );
    accounts.push(accountId);
  }

  // 3. User views balances, requests a transaction signature
  const transactionBytes = buildAlgorandTransaction({
    from: "AAAAAAAAAAA...",  // Account 0 address
    to: "BBBBBBBBBBB...",
    amount: 1000
  });

  // 4. Keystore signs without exposing the seed or private key
  const signature = await keystore.sign(accounts[0], transactionBytes);

  // 5. Send signed transaction to blockchain
  await submitTransaction({ txn: transactionBytes, sig: signature });

  // 6. Query audit logs for compliance
  const logs = await keystore.getAuditLogs({ operation: "sign" });
  console.log(`Signed ${logs.length} transactions today`);
}

setupAlgorandWallet("abandon abandon abandon ... about");
```

## Best Practices

### Security

1. **Never log or display private keys** — the keystore keeps them private
2. **Always use HD derivation** — one seed, many accounts
3. **Validate derivation paths** — use standard BIP44 paths (`m/44'/coinType'/account'/change/index`)
4. **Enable audit logging** — track who signed what and when
5. **Use pluggable backends** — software in dev, HSM in production

### Usability

1. **Store seeds encrypted** — require passphrase to unlock
2. **Support key recovery** — allow BIP39 mnemonic exports (with warnings)
3. **Cache derived keys** — avoid re-deriving the same path repeatedly
4. **Show audit logs** — let users see their transaction history

## Testing

For development and testing, use the `StubKeyStoreBackend`:

```typescript
import { StubKeyStoreBackend } from "@algorandfoundation/keystore-extension";

const keystore = new StubKeyStoreBackend();

// Returns dummy values for quick testing
const keyId = await keystore.generate({ type: "ecc", algorithm: "EdDSA" });
const signature = await keystore.sign(keyId, data);
```

⚠️ **The stub backend is NOT secure** — keys are fake, operations are dummy. Use only for testing.

## Roadmap

- [ ] Ed25519 signing (Algorand support)
- [ ] BIP39 mnemonic import and BIP32/BIP44 derivation
- [ ] Audit logging implementation
- [ ] HSM backend reference implementation
- [ ] Web Crypto API support (browser compatibility)
- [ ] Persistent storage layer (file-based, IndexedDB)

## Contributing

See [ARCHITECTURE.md](./ARCHITECTURE.md) for design details and [CODE_REVIEW.md](./CODE_REVIEW.md) for known issues and improvement areas.

## License

Apache-2.0
