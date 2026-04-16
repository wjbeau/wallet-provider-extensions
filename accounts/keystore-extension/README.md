# 🌉 @algorandfoundation/accounts-keystore-extension

Bridge between Account Store and Keystore.

This extension provides a reference implementation for bridging the [Account Store](../store) and the [Keystore](../../keystore/store). It automatically populates the account store with accounts derived from keys in the keystore and provides a signing method that leverages the keystore backend.

> [!NOTE]
> This extension is primarily a reference for how to create other types of account bridges. It does not have much functionality outside of bridging these two specific stores together.

## ✨ Features

- **Auto-Population**: Automatically adds accounts to the Account Store when keys are added to the Keystore.
- **Integrated Signing**: Provides a `sign` method on accounts that automatically uses the Keystore for cryptographic operations.
- **Reactive Synchronization**: Subscribes to Keystore changes to keep the Account Store in sync.

## 🧱 Core Components

- [**`KeystoreAccount`**](./src/types.ts): An account type that includes a `sign` method backed by the Keystore.
- [**`WithAccountsKeystore`**](./src/extension.ts): The Wallet Provider Extension that bridges the stores.

## 📥 Installation

```bash
pnpm add @algorandfoundation/accounts-keystore-extension
```

## 🚀 Quick Start

### 1. Adding the Extension to a Provider

The `WithAccountsKeystore` extension requires both `WithAccountStore` and `WithKeyStore` (or a compatible keystore extension) to be present on the provider.

```typescript
import { Provider } from "@algorandfoundation/wallet-provider";
import { WithAccountStore } from "@algorandfoundation/accounts-store";
import { WithKeyStore } from "@algorandfoundation/keystore-react-native"; // or any keystore implementation
import { WithAccountsKeystore } from "@algorandfoundation/accounts-keystore-extension";

const MyProvider = Provider.withExtensions([WithAccountStore, WithKeyStore, WithAccountsKeystore]);
```

### 2. Configuration

When initializing the provider, you can configure the bridge behavior:

```typescript
const provider = new MyProvider(
  { id: "my-provider", name: "My Provider" },
  {
    accounts: {
      store: accountStore,
      hooks: accountHooks,
      keystore: {
        autoPopulate: true, // Default is true
      },
    },
    keystore: {
      store: keyStore,
      hooks: keyStoreHooks,
    },
  },
);
```

### 3. Usage

Once configured, any compatible keys (e.g., `hd-derived-ed25519`) added to the keystore will automatically appear as accounts:

```typescript
// Generate a key in the keystore
await provider.key.store.generate({ type: "hd-seed" });

// The account is automatically added to the account store
console.log(provider.accounts);

// Sign using the account's sign method
const account = provider.accounts[0];
const signed = await account.sign([txnData]);
```

## 📖 API Documentation

For detailed information on types and methods, see the [TypeDocs](https://algorandfoundation.github.io/wallet-provider-extensions/accounts/keystore-extension/).

## 📜 License

Apache-2.0
