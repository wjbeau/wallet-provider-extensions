# @wjbeau/keystore

Core types and reactive state management for the Wallet Provider Keystore.

This package provides the base interfaces and reactive store for managing cryptographic keys. It does **not** contain a concrete implementation of key storage or cryptographic operations.

## Why This Exists

By separating the store and types from the implementation, we enable:

- **Environment Specific Implementations**: Use specialized extensions for different contexts (e.g., React Native, Browser Extension, Cloud KMS) that all fulfill the same contract.
- **Type Safety**: Unified interfaces for all keystore-related operations, including arbitrary data signing and HD derivation.
- **Reactive State**: Built-in state management using [@tanstack/store](https://tanstack.com/store) for UI-safe key metadata.

## Core Components

- [**`KeyStoreAPI`**](./src/types/backend.ts): The main interface that all backends must implement.
- [**`keyStore`**](./src/store.ts): A reactive store for managing key metadata and operation status.
- [**`KeyStoreExtension`**](./src/types/extension.ts): The interface exposed when added to a Wallet Provider.

## Implementation Examples

If you are looking for a concrete implementation, please refer to:

- [`@wjbeau/keystore-react-native`](../react-native/README.md) - React Native implementation using secure hardware.

## Quick Start

### 1. Define a Backend

To use the store, you typically use a concrete implementation that implements the `KeyStoreAPI`:

```typescript
import { KeyStoreAPI } from "@wjbeau/keystore/types";

class MyBackend implements KeyStoreAPI {
  // Implement required methods: generate, import, sign, etc.
}
```

### 2. Subscribe to State Changes

The store provides a reactive way to track available keys and the current operation status:

```typescript
import { keyStore } from "@wjbeau/keystore";

keyStore.subscribe((state) => {
  console.log("Current keys:", state.keys);
  console.log("Status:", state.status);
});
```

## API Documentation

For detailed information on types and methods, see the [TypeDocs](https://algorandfoundation.github.io/wallet-provider-extensions/keystore/store/).

### Key Interfaces

- [**`KeyStoreAPI`**](./src/types/backend.ts): Main interface for cryptographic operations.
- [**`KeyStoreState`**](./src/types/extension.ts): Reactive state structure.
- [**`Key`**](./src/types/core.ts): Metadata for a single key.

## Supported Algorithms & Key Types

The store defines the canonical [`KeyType`](./src/types/core.ts) and [`Algorithm`](./src/types/core.ts) unions used by every backend. Backends are free to implement a subset of these.

### Algorithms

| Algorithm | Description                                |
| --------- | ------------------------------------------ |
| `EdDSA`   | EdDSA using Ed25519 (signing/verification) |
| `P256`    | ECDSA using P-256 and SHA-256              |
| `RS256`   | RSA PKCS#1 v1.5 with SHA-256               |
| `raw`     | Raw bytes (e.g. seed material)             |

### Key Types

| Type                 | Algorithm | Description                                                               |
| -------------------- | --------- | ------------------------------------------------------------------------- |
| `seed`               | `raw`     | BIP39 / Algo25 seed material used as a root for HD derivation             |
| `hd-seed`            | `raw`     | **Deprecated** alias of `seed`, kept for backward compatibility           |
| `hd-root-key`        | `EdDSA`   | XHD root key derived from a `seed` (basis for `hd-derived-ed25519`)       |
| `hd-derived-ed25519` | `EdDSA`   | XHD-derived Ed25519 child key (Algorand `m/44'/283'/account'/change/idx`) |
| `hd-derived-p256`    | `P256`    | XHD-derived P-256 child key                                               |
| `ed25519`            | `EdDSA`   | Standalone Ed25519 key derived directly from a `seed` parent              |
| `rsa`                | `RS256`   | RSA key pair (handed off to WebCrypto)                                    |
| `ecc`                | `P256`    | Generic elliptic-curve key pair (handed off to WebCrypto)                 |
| `secret-key`         | `raw`     | Arbitrary user-supplied symmetric/secret material                         |

> Generation of `ed25519` and `hd-derived-*` keys requires a `seed` (or legacy `hd-seed`) parent — callers convert any mnemonic to a seed before calling `generate`. Unrecognized algorithms fall through to a `SubtleCrypto` WebCrypto fallback.

## Security

The store is designed to be **UI-safe**. It only holds metadata and public identifiers. Private key material should **never** be stored in the reactive `keyStore` and should remain isolated within the backend implementation.

## License

Apache-2.0
