# @algorandfoundation/log-store

A lightweight, generic log store extension for the Algorand Wallet Provider. It captures messages with levels, timestamps, and optional metadata, and exposes them on the provider state for easy inspection and debugging.

## Features

- Simple provider API via the `log` namespace: `info`, `warn`, `error`, `debug`, `trace`, and `clear`.
- Provider state exposes `logs` for quick access to captured messages.
- Minimal overhead with predictable state transitions powered by `@tanstack/store`.
- Framework-agnostic — works in Node.js, browsers, and with any UI framework.

## Installation

```bash
npm install @algorandfoundation/log-store
```

## Usage

### 1. Register the Extension with a Provider

```ts
import { Provider } from "@algorandfoundation/wallet-provider";
import { WithLogStore } from "@algorandfoundation/log-store";

// 1) Create a provider with the Log Store extension
const MyProvider = Provider.withExtensions([WithLogStore]);
const provider = new MyProvider({ id: "my-provider", name: "My Wallet" });

// 2) Emit logs through the provider API
provider.log.info("Initialized wallet", { scope: "init" });
provider.log.warn("Low balance warning", { account: "ABC123" });
provider.log.error("Transaction failed", { txId: "XYZ" });

// 3) Read logs from provider state
console.log(provider.logs);
// Example entry shape:
// {
//   id: string,
//   context?: string,
//   timestamp: Date,
//   level: "info" | "warn" | "error" | "debug" | "trace",
//   message: string,
//   metadata?: Record<string, any>
// }

// 4) Clear all logs
provider.log.clear();
```

### 2. Using the Store Directly (optional)

You can work with the underlying store if you need subscriptions or integration with reactive UIs.

```ts
import { logsStore } from "@algorandfoundation/log-store";

// Subscribe to state changes
const unsubscribe = logsStore.subscribe((state) => {
  console.log("LogStore updated", state.logs.length);
});

// Later, when you no longer need updates
unsubscribe();
```

### 3. React Example (with @tanstack/react-store)

```tsx
import { useStore } from "@tanstack/react-store";
import { logsStore } from "@algorandfoundation/log-store";

export function LogList() {
  const logs = useStore(logsStore, (state) => state.logs);

  return (
    <ul>
      {logs.map((l) => (
        <li key={l.id}>
          <strong>[{l.level}]</strong> {l.message}
        </li>
      ))}
    </ul>
  );
}
```

## Tips & Best Practices

- Use metadata to attach helpful context such as `account`, `txId`, or `scope`.
- Consider piping `provider.logs` to your own transport (e.g., remote telemetry) if you need persistence.
- `console.*` calls are mirrored for convenience during development. In production, filter or redirect as needed.

## License

Apache-2.0