# Wallet Provider Extensions

Based on the work of the [Wallet Provider](https://github.com/algorandfoundation/wallet-provider),
this project adds support for various extensions that allow for cryptographic operations in specific contexts.

## What are Extensions?

Extensions are modular components that enhance the capabilities of a wallet or provider. They allow for the addition of specialized features—such as secret management, logging, or custom transaction signing—without bloating the core provider implementation. 

An extension typically consists of:
1.  **State**: Data managed by the extension (e.g., a list of stored secrets).
2.  **API**: A set of methods to interact with the extension and its state.

## Available Extensions

The following extension packages are available in this workspace:

- **[Keystore](./keystore)**: Securely manage cryptographic secrets and keys.

## Creating a New Extension

To create a new extension, you define an interface that combines your custom state and your API.

### Example: Logger Extension

Imagine you want an extension that logs all wallet activities.

#### 1. Define the Extension Types

```typescript
export interface LoggerState {
  logs: string[];
}

export interface LoggerApi {
  log: (message: string) => void;
  clear: () => void;
}

export interface LoggerExtension extends LoggerState {
  logger: LoggerApi;
}
```

#### 2. Implement the Extension

```typescript
import { Store } from "@tanstack/store";
import type { Provider, ExtensionOptions } from "@algorandfoundation/wallet-provider";

const store = new Store<LoggerState>({ logs: [] });

export const loggerExtension: (provider: Provider, options: ExtensionOptions) => LoggerExtension = () => ({
    get logs() {
        return store.state.logs;
    },
    logger: {
        log: (message: string) => {
            store.setState((state) => ({
                logs: [...state.logs, `${new Date().toISOString()}: ${message}`],
            }));
        },
        clear: () => {
            store.setState(() => ({ logs: [] }));
        },
    },
})

export default loggerExtension;
```

## Using Extensions in a Provider

Extensions are designed to be used within a Wallet Provider. When initializing a provider, you can include these extensions to expose their functionality.

```typescript
import { KeyStoreExtension } from "@algorandfoundation/keystore-extension";
import { LoggerExtension } from "./logger-extension";

// A Provider can be extended with multiple extensions
type MyExtendedProvider = Provider & KeyStoreExtension & LoggerExtension;

const provider = new Provider(...) as MyExtendedProvider;

// Now you can access extension APIs directly on the provider
provider.keystore.add(mySecret);
provider.logger.log("Secret added");
```

