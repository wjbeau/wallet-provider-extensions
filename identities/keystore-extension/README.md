# 🆔🌉 @algorandfoundation/identities-keystore-extension

Bridge between Identity Store and Keystore.

This extension provides a reference implementation for bridging the [Identity Store](../store) and the [Keystore](../../keystore/store). It automatically populates the identity store with identities derived from keys in the keystore (specifically context 1) and provides a signing method that leverages the keystore backend.

## ✨ Features

- **Auto-Population**: Automatically adds identities to the Identity Store when compatible keys (context 1) are added to the Keystore.
- **Integrated Signing**: Provides a `sign` method on identities that automatically uses the Keystore for cryptographic operations.
- **DID Document Persistence**: Optional storage interface for persisting DID documents.
- **Identity Recovery**: Recreates keystore state (derived keys) from a DID Document.

## 🧱 Core Components

- [**`IdentitiesKeystoreExtension`**](./src/types.ts): Interface for the augmented identity store with recovery capabilities.
- [**`WithIdentitiesKeystore`**](./src/extension.ts): The Wallet Provider Extension that bridges the stores.

## 📥 Installation

```bash
pnpm add @algorandfoundation/identities-keystore-extension
```

## 🚀 Quick Start

### 1. Adding the Extension to a Provider

The `WithIdentitiesKeystore` extension requires both `WithIdentityStore` and `WithKeyStore` (or a compatible keystore extension) to be present on the provider.

```typescript
import { Provider } from "@algorandfoundation/wallet-provider";
import { WithIdentityStore } from "@algorandfoundation/identities-store";
import { WithKeyStore } from "@algorandfoundation/react-native-keystore"; // or any keystore implementation
import { WithIdentitiesKeystore } from "@algorandfoundation/identities-keystore-extension";

const MyProvider = Provider.withExtensions([
  WithIdentityStore,
  WithKeyStore,
  WithIdentitiesKeystore,
]);
```

### 2. Configuration

When initializing the provider, you can configure the bridge behavior:

```typescript
const provider = new MyProvider(
  { id: "my-provider", name: "My Provider" },
  {
    identities: {
      store: identityStore,
      hooks: identityHooks,
      keystore: {
        autoPopulate: true, // Default is true
      },
    },
    keystore: {
      store: keyStore,
      hooks: keyStoreHooks,
    },
    storage: {
      set: (key, value) => mmkv.set(key, value),
      getString: (key) => mmkv.getString(key),
      remove: (key) => mmkv.delete(key),
    },
  },
);
```

### 3. Usage

Once configured, any compatible keys (e.g., `hd-derived-ed25519` with `context: 1`) added to the keystore will automatically appear as identities:

```typescript
// Generate an identity key in the keystore
await provider.key.store.generate({
  type: "hd-derived-ed25519",
  params: {
    context: 1,
    account: 0,
    index: 0,
  },
});

// The identity is automatically added to the identity store
console.log(provider.identities);

// Sign using the identity's sign method
const identity = provider.identities[0];
const signed = await identity.sign([txnData]);
```

## 📖 API Documentation

For detailed information on types and methods, see the [TypeDocs](https://algorandfoundation.github.io/wallet-provider-extensions/identities/keystore-extension/).

## 📜 License

Apache-2.0
