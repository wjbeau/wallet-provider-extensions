# @algorandfoundation/keystore

Core types and reactive state management for the Algorand Wallet Provider Keystore.

This package provides the base interfaces and reactive store for managing cryptographic keys. It does **not** contain a concrete implementation of key storage or cryptographic operations.

## Why This Exists

By separating the store and types from the implementation, we enable:
- **Pluggable Backends**: Easily swap between different storage mechanisms (React Native, Browser Extension, Cloud KMS).
- **Type Safety**: Unified interfaces for all keystore-related operations.
- **Reactive State**: Built-in state management using [@tanstack/store](https://tanstack.com/store) for UI-safe key metadata.

## Core Components

- [**`KeyStoreAPI`**](./src/types/backend.ts): The main interface that all backends must implement.
- [**`keyStore`**](./src/store.ts): A reactive store for managing key metadata and operation status.
- [**`KeyStoreExtension`**](./src/types/extension.ts): The interface exposed when added to a Wallet Provider.

## Implementation Examples

If you are looking for a concrete implementation, please refer to:
- [`@algorandfoundation/keystore-react-native`](../react-native/README.md) - React Native implementation using secure hardware.

## Quick Start

### 1. Define a Backend

To use the store, you typically use a concrete implementation that implements the `KeyStoreAPI`:

```typescript
import { KeyStoreAPI } from "@algorandfoundation/keystore/types";

class MyBackend implements KeyStoreAPI {
  // Implement required methods: generate, import, sign, etc.
}
```

### 2. Subscribe to State Changes

The store provides a reactive way to track available keys and the current operation status:

```typescript
import { keyStore } from "@algorandfoundation/keystore";

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

## Security

The store is designed to be **UI-safe**. It only holds metadata and public identifiers. Private key material should **never** be stored in the reactive `keyStore` and should remain isolated within the backend implementation.

## License

Apache-2.0
