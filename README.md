# Wallet Provider Extensions

<!-- TODO: Add Heading with badges -->

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
import type {KeyStoreExtension} from "@algorandfoundation/keystore/types";
import {createKeyStore} from "@algorandfoundation/keystore/storage";
import {WithKeyStoreExtension, keyStore} from "@algorandfoundation/keystore/extension";
import {LoggerExtension} from "./logger-extension";

// A Provider can be extended with multiple extensions
type MyExtendedProvider = Provider & KeyStoreExtension & LoggerExtension;

// Create the keystore backend with secure storage (once per app)
const keystore = createKeyStore({
  mode: "wrapped",
  // Note: These may be provided by packages in the future that have strong opinions.
  rawStorage: new AsyncStorageRaw(), // Implement in your app for raw storage
  keyWrapper: new ReactNativeKeychainWrapper(), // Use the wrapper for your platform
  seedWrapper: new ReactNativeSecureEnclaveWrapper() // Use the wrapper for your platform
})

// Then bootstrap the keystore with existing keys
await syncKeysMetadata(keystore)

const provider = new Provider({
  api: {keystore: keystore}
}).withExtensions([WithKeyStoreExtension]) as MyExtendedProvider;

// Now you can access extension APIs directly on the provider
provider.keystore.add(mySecret);
provider.logger.log("Secret added");
```


## Acknowledgments

<!-- TODO: Refine acknowledgements as they develop -->

We would like to acknowledge the following individuals and entities for their contributions and inspiration to this project and the broader Algorand ecosystem:

- **Architectural Vision**: [Algorand Foundation](https://github.com/algorandfoundation) and [Bruno Martins](https://github.com/bmartins) (@bmartins) for his role as an Architect.
- **use-wallet**: [TxnLab](https://github.com/TxnLab) and [Doug Richar](https://github.com/drichar) (@drichar), along with [Gabriel Kuettel](https://github.com/gabrielkuettel) (@gabrielkuettel) (currently at Algorand Foundation), for their role in building the `use-wallet` hook.
- **Ecosystem Support**: The Engineering Teams at [Algorand Foundation](https://github.com/algorandfoundation) ranging from AlgoKit, Engineering, and Devrel for their role in providing ecosystem libraries and support.
- **Wallets**:
    - [Pera](https://github.com/perawallet) and [Will Beaumount](https://github.com/mjbeau) (@mjbeau) for their role in the ecosystem as a wallet and the large refactor to React Native.
    - [Akita](https://akita.community/) for their role in ARC58 adoption. With special thanks to Algorand Foundation engineering to [Kyle](https://github.com/kylebeee)(@kylebee) and [Joe Polny](https://github.com/joe-p)(@joe-p) for their contributions to the ARC58 plugin standards.
    - [Lute](https://lute.app) and [Andrew Funk](https://github.com/acfunk) (@acfunk) for their contributions to web wallets, readily adopting the latest features.
    - [Kibis-is](https://kibis.is/) and [Kieran Roneill](https://github.com/kieranroneill) (@kieranroneill) for their work as an extension-based wallet and contributions to ARC standards such as ARC27.
    - [Defly](https://defly.app/) and [Kevin Wellenzohn](https://github.com/k13n) (@k13n) for pioneering wallet features and deep engagement with the Algorand ecosystem and ARC standards.

<!-- TODO: Add Stars/Forks Badge -->

