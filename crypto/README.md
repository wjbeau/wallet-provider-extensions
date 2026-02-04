# Crypto Namespace

The `crypto` namespace is a shared hub within a [Provider Extension](../README.md#what-are-extensions) that centralizes cryptographic operations and utilities. It allows multiple extensions to contribute their own cryptographic functionalities (like mnemonic generation, hierarchical deterministic wallets, or hashing algorithms) to a single, consistent API surface on the `Provider` instance.

## How it Works

Extensions that provide cryptographic features are designed to augment the `provider.crypto` object. This pattern ensures that all cryptographic tools are logically grouped together, making them easily discoverable and accessible to developers.

When multiple crypto-related extensions are initialized, they merge their specific APIs into the `crypto` namespace:

```typescript
// Initializing a provider with multiple crypto extensions
const provider = new Provider({
  extensions: [WithXHDCryptoExtension, WithBip39CryptoExtension],
});

// Accessing the unified crypto API
provider.crypto.xhd;    // From XHD extension
provider.crypto.bip39;  // From BIP-39 extension
provider.crypto.base32; // Utility from XHD extension
```

## Available Crypto Extensions

The following extensions contribute to the `crypto` namespace:

- **[BIP-39](./bip39-crypto-extension)**: Mnemonic generation and management (generate, import, export).
- **[XHD](./xhd-crypto-extension)**: Extended Hierarchical Deterministic (XHD) wallet operations and primitives like SHA-512/256 and Base32.

## Integration with Other Extensions

The `crypto` namespace often works in tandem with other extensions. For example, the **BIP-39** extension can integrate with the **[Keystore](../keystore)** extension to securely store generated or imported mnemonics.

