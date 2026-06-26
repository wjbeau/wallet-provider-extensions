# 🆔 @wjbeau/identities-store

Basic reactive state management for identities.

This package provides a standardized way to manage and interact with identity data (DIDs, DID Documents) in a reactive way, integrated with the Wallet Provider Extension system.

## ✨ Features

- **Reactive State**: Built with [@tanstack/store](https://tanstack.com/store) for efficient state management and UI reactivity.
- **Hook-based Extensibility**: Leverages [before-after-hook](https://github.com/gr2m/before-after-hook) to allow for intercepting and extending identity operations.
- **W3C DID Support**: Built-in support for W3C DID Documents and DID:key generation.
- **Seamless Integration**: Designed to be used as a Wallet Provider Extension.

## 🧱 Core Components

- [**`Identity`**](./src/types.ts): The base interface for an identity, including address, DID, and DID Document.
- [**`WithIdentityStore`**](./src/extension.ts): The Wallet Provider Extension that adds identity management capabilities.
- [**`IdentityStoreApi`**](./src/types.ts): The API exposed to manage identities (add, remove, get, clear, update DID document).

## 📥 Installation

```bash
pnpm add @wjbeau/identities-store
```

## 🚀 Quick Start

### 1. Adding the Extension to a Provider

```typescript
import { Provider } from "@algorandfoundation/wallet-provider";
import { WithIdentityStore } from "@wjbeau/identities-store";
import { Store } from "@tanstack/store";
import Hook from "before-after-hook";

// Define a provider with the IdentityStore extension
const MyProvider = Provider.withExtensions([WithIdentityStore]);

// Initialize the provider
const identityStore = new Store({ identities: [] });
const identityHooks = new Hook.Collection();

const provider = new MyProvider(
  { id: "my-provider", name: "My Provider" },
  {
    identities: {
      store: identityStore,
      hooks: identityHooks,
    },
  },
);
```

### 2. Managing Identities

```typescript
// Add an identity
await provider.identity.store.addIdentity({
  address: "did:key:z6M...",
  type: "did:key",
});

// Access identities (reactive)
console.log(provider.identities);

// Subscribe to changes via the store
identityStore.subscribe((state) => {
  console.log("Updated identities:", state.identities);
});
```

### 3. Using Hooks

```typescript
provider.identity.store.hooks.before("add", (options) => {
  console.log("Adding identity:", options.identity.address);
});
```

## 📖 API Documentation

For detailed information on types and methods, see the [TypeDocs](https://algorandfoundation.github.io/wallet-provider-extensions/identities/store/).

## 📜 License

Apache-2.0
