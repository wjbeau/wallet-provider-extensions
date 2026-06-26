# 🏦 @wjbeau/accounts-store

Basic reactive state management for accounts.

This package provides a standardized way to manage and interact with account data in a reactive way, integrated with the Wallet Provider Extension system.

## ✨ Features

- **Reactive State**: Built with [@tanstack/store](https://tanstack.com/store) for efficient state management and UI reactivity.
- **Hook-based Extensibility**: Leverages [before-after-hook](https://github.com/gr2m/before-after-hook) to allow for intercepting and extending account operations.
- **Flexible Account Metadata**: Support for custom account types and metadata via generics.
- **Seamless Integration**: Designed to be used as a Wallet Provider Extension.

## 🧱 Core Components

- [**`Account`**](./src/types.ts): The base interface for an account, including address, balance, assets, type, and optional metadata.
- [**`WithAccountStore`**](./src/extension.ts): The Wallet Provider Extension that adds account management capabilities.
- [**`AccountStoreApi`**](./src/types.ts): The API exposed to manage accounts (add, remove, get, clear).

## 📥 Installation

```bash
pnpm add @wjbeau/accounts-store
```

## 🚀 Quick Start

### 1. Adding the Extension to a Provider

```typescript
import { Provider } from "@algorandfoundation/wallet-provider";
import { WithAccountStore } from "@wjbeau/accounts-store";
import { Store } from "@tanstack/store";
import Hook from "before-after-hook";

// Define a provider with the AccountStore extension
const MyProvider = Provider.withExtensions([WithAccountStore]);

// Initialize the provider
const accountStore = new Store({ accounts: [] });
const accountHooks = new Hook.Collection();

const provider = new MyProvider(
  { id: "my-provider", name: "My Provider" },
  {
    accounts: {
      store: accountStore,
      hooks: accountHooks,
    },
  },
);
```

### 2. Managing Accounts

```typescript
// Add an account
await provider.account.store.addAccount({
  address: "ADDRESS...",
  type: "ed25519",
  balance: 0n,
  assets: [],
});

// Access accounts (reactive)
console.log(provider.accounts);

// Subscribe to changes via the store
accountStore.subscribe((state) => {
  console.log("Updated accounts:", state.accounts);
});
```

### 3. Using Hooks

```typescript
provider.account.store.hooks.before("add", (options) => {
  console.log("Adding account:", options.account.address);
});
```

## 🛠️ Custom Account Types

The Account Store is designed to be generic. You can define your own account types by extending the base `Account` interface.

### 1. Define a Custom Account Type

```typescript
import { Account } from "@wjbeau/accounts-store";

export interface MyCustomAccount extends Account {
  type: "custom";
  customField: string;
}

export function isMyCustomAccount(account: Account): account is MyCustomAccount {
  return account.type === "custom";
}
```

### 2. Using with the Extension

You can pass your custom type as a generic to `WithAccountStore`.

```typescript
import { Provider } from "@algorandfoundation/wallet-provider";
import { WithAccountStore, type AccountStoreApi } from "@wjbeau/accounts-store";

// Use the generic extension with your custom type
const MyProvider = Provider.withExtensions([
  (provider, options) => WithAccountStore<MyCustomAccount>(provider, options),
]);

// Or when using the concrete class pattern
class MyProvider extends Provider<typeof MyProvider.EXTENSIONS> {
  static EXTENSIONS = [WithAccountStore] as const;
  accounts!: MyCustomAccount[];
  account!: { store: AccountStoreApi<MyCustomAccount> };
}
```

### 3. Adding and Accessing Custom Accounts

```typescript
// Add an account with custom fields
await provider.account.store.addAccount({
  address: "ADDRESS...",
  type: "custom",
  customField: "some value",
  balance: 0n,
  assets: [],
});

// Get the account back and verify its type
const account = await provider.account.store.getAccount("ADDRESS...");

if (account && isMyCustomAccount(account)) {
  console.log(account.customField);
}
```

## 🔀 Using Union Types

In many cases, a single provider may need to handle multiple different types of accounts. You can achieve this by using a TypeScript union type.

### 1. Define Your Account Union

```typescript
import { Account } from "@wjbeau/accounts-store";

export interface IntermezzoAccount extends Account {
  type: "intermezzo";
}

export interface XChainAccount extends Account {
  type: "x-chain";
  metadata: {
    originChain: string;
  };
}

export type MyAccountUnion = IntermezzoAccount | XChainAccount;
```

### 2. Create Type Guard Functions

You can create type narrowing functions for your custom types.

```typescript
export function isIntermezzoAccount(account: Account): account is IntermezzoAccount {
  return account.type === "intermezzo";
}

export function isXChainAccount(account: Account): account is XChainAccount {
  return account.type === "x-chain";
}
```

### 3. Initialize with the Union Type

```typescript
const MyProvider = Provider.withExtensions([
  (provider, options) => WithAccountStore<MyAccountUnion>(provider, options),
]);
```

### 4. Type-Safe Access

When retrieving accounts, you can use your type guards to safely access type-specific fields.

```typescript
const account = await provider.account.store.getAccount("ADDRESS...");

if (account && isXChainAccount(account)) {
  // TypeScript now knows this is a XChainAccount
  console.log("Origin Chain:", account.metadata.originChain);
}
```

## 📖 API Documentation

For detailed information on types and methods, see the [TypeDocs](https://algorandfoundation.github.io/wallet-provider-extensions/accounts/store/).

## 📜 License

Apache-2.0
