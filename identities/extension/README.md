# 🆔 @wjbeau/identities-extension

Unified Identities extension for Wallet Provider.

This package provides a unified extension that combines the identity store and the keystore bridge. It simplifies the setup by automatically loading the appropriate identity management capabilities based on the available extensions in the provider.

## ✨ Features

- **Unified API**: Combines `@wjbeau/identities-store` and `@wjbeau/identities-keystore-extension`.
- **Conditional Loading**: Automatically enables keystore integration if the `WithKeyStore` extension is present.
- **Simplified Setup**: Reduces boilerplate when setting up identity management in a provider.
- **Reactive State**: Inherits all reactive capabilities from the underlying identity store.

## 🧱 Core Components

- [**`WithIdentities`**](./src/extension.ts): The primary extension that wraps identity store and keystore bridge logic.
- [**`IdentitiesExtensionOptions`**](./src/types.ts): Configuration options for the unified identities extension.

## 📥 Installation

```bash
pnpm add @wjbeau/identities-extension
```

## 🚀 Quick Start

### 1. Basic Usage (Identity Store Only)

```typescript
import { Provider } from "@algorandfoundation/wallet-provider";
import { WithIdentities } from "@wjbeau/identities-extension";

const MyProvider = Provider.withExtensions([WithIdentities]);
const provider = new MyProvider({ id: "my-provider", name: "My Provider" });

// Access identity store
console.log(provider.identities);
```

### 2. With Keystore Integration

When combined with `WithKeyStore`, the `WithIdentities` extension automatically enables the identities-keystore bridge, which auto-populates identities from derived keys and adds DID Document restoration capabilities.

```typescript
import { Provider } from "@algorandfoundation/wallet-provider";
import { WithKeyStore } from "@wjbeau/keystore";
import { WithIdentities } from "@wjbeau/identities-extension";

const MyProvider = Provider.withExtensions([WithKeyStore, WithIdentities]);
const provider = new MyProvider({ id: "my-provider", name: "My Provider" });

// identities will be auto-populated from keys with context 1
// provider.identity.store.restoreFromDidDocument() will be available
```

## 📖 API Documentation

For detailed information on types and methods, see the [TypeDocs](https://algorandfoundation.github.io/wallet-provider-extensions/identities/extension/).

## 📜 License

Apache-2.0
