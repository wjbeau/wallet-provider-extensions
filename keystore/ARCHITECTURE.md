# Keystore Extension Architecture

## Overview

The Keystore Extension provides a secure, pluggable interface for managing cryptographic keys and HD (Hierarchical Deterministic) wallets. It abstracts away the complexity of key storage, derivation, and cryptographic operations while giving integrators full control over how and where sensitive data is stored.

### What is an HD Wallet?

Think of an HD Wallet like a master key system for a large building:

- **The Master Seed**: A single root key (usually represented as a 12-24 word mnemonic phrase) that generates all other keys.
- **Hierarchical Structure**: Keys are organized in a tree structure (like floors and rooms in a building), following paths like `m/44'/283'/0'/0/0`.
- **Deterministic**: Given the same seed and path, you always get the same key. This means:
  - Backup is just the seed phrase
  - Keys can be regenerated on any device
  - No need to manage hundreds of individual key files

**Real-world analogy**: It's like having one master password that generates unique, secure passwords for every website you use, but you only need to remember the master.

## Overall Architecture

```mermaid
flowchart TB
    subgraph Application["📱 Application Layer"]
        App[Your Application]
    end

    subgraph KeystoreAPI["🔧 Keystore API Layer"]
        BackendInterface["KeyStoreBackend Interface"]
    end

    subgraph Implementation["⚙️ Implementation Layer"]
        XHD["XHDKeyStoreBackend<br/>(Primary Implementation)"]
        Custom["Custom Backend<br/>(HSM, Cloud KMS, etc.)"]
    end

    subgraph StorageInterfaces["💾 Storage Interfaces"]
        SeedIF["SeedStorage<br/>(Highest Security)"]
        KeyIF["KeyStorage<br/>(Medium Security)"]
        AuditIF["AuditStorage<br/>(Logging)"]
    end

    subgraph StorageImpls["🗄️ Storage Implementations"]
        subgraph SeedStorage["Seed Storage Options"]
            InMemSeed["In-Memory"]
            FileSeed["Encrypted File"]
            HSM["Hardware HSM"]
            CloudKMS["Cloud KMS"]
            SecureEnclave["Secure Enclave"]
        end

        subgraph KeyStorage["Key Storage Options"]
            InMemKey["In-Memory"]
            FileKey["File System"]
            Redis["Redis Cache"]
            IndexedDB["Browser IndexedDB"]
        end

        subgraph AuditStorage["Audit Storage Options"]
            InMemAudit["In-Memory"]
            FileAudit["Log File"]
            Splunk["Splunk/SIEM"]
            CloudWatch["CloudWatch"]
            Blockchain["Blockchain Log"]
        end
    end

    subgraph DataTypes["📦 Data Types"]
        Seed["🔐 HD Seed<br/>(Root Key + Derived Main Key)"]
        Keys["🔑 Keys<br/>(Public + Private/Derivation Context)"]
        Audit["📋 Audit Events<br/>(Operation Logs)"]
    end

    App --> BackendInterface
    BackendInterface --> XHD
    BackendInterface --> Custom

    XHD --> SeedIF
    XHD --> KeyIF
    XHD --> AuditIF

    SeedIF --> InMemSeed
    SeedIF --> FileSeed
    SeedIF --> HSM
    SeedIF --> CloudKMS
    SeedIF --> SecureEnclave

    KeyIF --> InMemKey
    KeyIF --> FileKey
    KeyIF --> Redis
    KeyIF --> IndexedDB

    AuditIF --> InMemAudit
    AuditIF --> FileAudit
    AuditIF --> Splunk
    AuditIF --> CloudWatch
    AuditIF --> Blockchain

    InMemSeed -.-> Seed
    FileSeed -.-> Seed
    HSM -.-> Seed
    CloudKMS -.-> Seed
    SecureEnclave -.-> Seed

    InMemKey -.-> Keys
    FileKey -.-> Keys
    Redis -.-> Keys
    IndexedDB -.-> Keys

    InMemAudit -.-> Audit
    FileAudit -.-> Audit
    Splunk -.-> Audit
    CloudWatch -.-> Audit
    Blockchain -.-> Audit

    style Application fill:#e1f5ff
    style KeystoreAPI fill:#fff4e1
    style Implementation fill:#f0ffe1
    style StorageInterfaces fill:#ffe1f0
    style StorageImpls fill:#f5f5f5
    style DataTypes fill:#fff9e1
```

### Architecture Flow

1. **Application Layer**: Your application interacts with the `KeyStoreBackend` interface
2. **Implementation Layer**: `XHDKeyStoreBackend` provides the main HD wallet functionality, but you can swap in custom implementations (e.g., hardware wallets)
3. **Storage Abstraction**: Three storage interfaces segregate data by sensitivity:
   - **SeedStorage**: Master seeds (highest security requirements)
   - **KeyStorage**: Derived/imported keys (medium security)
   - **AuditStorage**: Operation logs (compliance/debugging)
4. **Pluggable Backends**: Each storage interface can use different implementations based on your security/performance needs
5. **Data Segregation**: Different types of data flow to their respective storage backends

### Security Zones

The architecture supports a **defense-in-depth** approach where you can assign different security levels to different data types:

```
┌─────────────────────────────────────────────────────────────┐
│                    SECURITY ZONES                           │
├─────────────────────────────────────────────────────────────┤
│ 🔴 CRITICAL: Seeds (SeedStorage)                            │
│    • Hardware Security Modules (HSM)                       │
│    • Secure Enclaves (TEE)                                 │
│    • Encrypted offline storage                             │
├─────────────────────────────────────────────────────────────┤
│ 🟡 SENSITIVE: Keys (KeyStorage)                             │
│    • Encrypted file systems                                │
│    • Redis with persistence                                │
│    • Browser IndexedDB                                     │
├─────────────────────────────────────────────────────────────┤
│ 🟢 STANDARD: Audit Logs (AuditStorage)                      │
│    • Log files                                             │
│    • SIEM systems (Splunk)                                 │
│    • Cloud logging (CloudWatch)                            │
│    • Blockchain (tamper-proof)                             │
└─────────────────────────────────────────────────────────────┘
```

## Secure Storage Implementation

The keystore storage interfaces work with plaintext data. **For production use, you should implement encryption at rest** using your platform's secure storage capabilities. This section shows how to implement encrypted storage for different platforms.

### Why Encrypt at Rest?

Even if your device is compromised, encrypted storage ensures:
- Keys remain protected by the OS secure enclave
- Private keys are never written to disk in plaintext
- Each platform uses its native security features

### Pattern: Encrypted Storage Wrapper

The recommended approach is to implement the `KeyStorage`/`SeedStorage` interface with encryption:

```typescript
class EncryptedKeyStorage implements KeyStorage {
  constructor(
    private backend: KeyStorage,  // e.g., AsyncStorage, FileStorage
    private options: {
      encrypt: (data: Uint8Array) => Promise<Uint8Array>
      decrypt: (data: Uint8Array) => Promise<Uint8Array>
    }
  ) {}
  
  async get(id: KeyId): Promise<StoredKeyData | undefined> {
    const encrypted = await this.backend.get(id)
    if (!encrypted) return undefined
    
    // Decrypt private key before returning
    return {
      ...encrypted,
      privateKey: encrypted.privateKey 
        ? await this.options.decrypt(encrypted.privateKey)
        : undefined
    }
  }
  
  async set(id: KeyId, data: StoredKeyData): Promise<void> {
    // Encrypt private key before storing
    const encrypted = {
      ...data,
      privateKey: data.privateKey 
        ? await this.options.encrypt(data.privateKey)
        : undefined
    }
    await this.backend.set(id, encrypted)
  }
  
  // ... other methods pass through to backend
}
```

### Example: React Native with iOS Keychain / Android Keystore

```typescript
import * as Keychain from 'react-native-keychain';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { KeyStorage, KeyId, StoredKeyData } from '@algorandfoundation/keystore';

export class SecureKeyStorage implements KeyStorage {
  async get(id: KeyId): Promise<StoredKeyData | undefined> {
    // Public metadata in AsyncStorage
    const metadata = await AsyncStorage.getItem(`@keystore/${id}`);
    if (!metadata) return undefined;
    
    const parsed = JSON.parse(metadata);
    
    // Private key from secure keychain
    const encryptedKey = await Keychain.getGenericPassword({
      service: `@keystore/private/${id}`
    });
    
    return {
      ...parsed,
      privateKey: encryptedKey 
        ? await this.decrypt(encryptedKey.password)
        : undefined
    };
  }
  
  async set(id: KeyId, data: StoredKeyData): Promise<void> {
    // Store public data
    await AsyncStorage.setItem(`@keystore/${id}`, JSON.stringify({
      metadata: data.metadata,
      publicKey: this.toBase64(data.publicKey),
      curve: data.curve
    }));
    
    // Encrypt and store private key in keychain
    if (data.privateKey) {
      const encrypted = await this.encrypt(data.privateKey);
      await Keychain.setGenericPassword(
        'key',
        encrypted,
        {
          service: `@keystore/private/${id}`,
          accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY
        }
      );
    }
  }
  
  private async encrypt(data: Uint8Array): Promise<string> {
    // Use platform encryption via native module
    // The encryption key is managed by iOS/Android secure enclave
    return await NativeCrypto.encryptWithKeychain(data);
  }
  
  private async decrypt(encrypted: string): Promise<Uint8Array> {
    return await NativeCrypto.decryptWithKeychain(encrypted);
  }
}

// Usage
const backend = new XHDKeyStoreBackend({
  keyStorage: new SecureKeyStorage(),
  seedStorage: new SecureKeyStorage()  // Same pattern for seeds
});
```

### Example: Web with Web Crypto API

```typescript
export class WebCryptoStorage implements KeyStorage {
  private db: IDBDatabase;
  private masterKey: CryptoKey;
  
  async get(id: KeyId): Promise<StoredKeyData | undefined> {
    const encrypted = await this.db.get('keys', id);
    if (!encrypted) return undefined;
    
    // Decrypt private key using Web Crypto
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: encrypted.iv },
      this.masterKey,
      encrypted.privateKey
    );
    
    return {
      ...encrypted,
      privateKey: new Uint8Array(decrypted)
    };
  }
  
  async set(id: KeyId, data: StoredKeyData): Promise<void> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    const encrypted = {
      ...data,
      privateKey: await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        this.masterKey,
        data.privateKey
      ),
      iv
    };
    
    await this.db.put('keys', encrypted);
  }
}
```

### Example: Node.js with OS Keychain

```typescript
import keytar from 'keytar';

export class NodeSecureStorage implements KeyStorage {
  async get(id: KeyId): Promise<StoredKeyData | undefined> {
    const metadata = await fs.readFile(`./keys/${id}.json`, 'utf8');
    const parsed = JSON.parse(metadata);
    
    // Retrieve encrypted private key from OS keychain
    const encryptedKey = await keytar.getPassword('keystore', id);
    
    return {
      ...parsed,
      privateKey: encryptedKey 
        ? Buffer.from(encryptedKey, 'base64')
        : undefined
    };
  }
  
  async set(id: KeyId, data: StoredKeyData): Promise<void> {
    // Store metadata in file
    await fs.writeFile(`./keys/${id}.json`, JSON.stringify({
      metadata: data.metadata,
      publicKey: data.publicKey.toString('base64'),
      curve: data.curve
    }));
    
    // Store private key in OS keychain (macOS Keychain, Windows Credential Manager, etc.)
    if (data.privateKey) {
      await keytar.setPassword(
        'keystore',
        id,
        data.privateKey.toString('base64')
      );
    }
  }
}
```

### Memory Security Best Practices

The `XHDKeyStoreBackend` includes automatic memory clearing for sensitive data:

1. **Private keys are cleared after use**: When signing or performing ECDH, private keys are cleared from memory immediately after the operation
2. **Copies are used**: The backend creates copies of private keys so clearing doesn't affect stored data
3. **Temporary buffers are zeroed**: Intermediate cryptographic buffers are cleared

```typescript
// The backend automatically handles this:
const signature = await backend.sign(keyId, data);
// Private key is automatically cleared from memory after signing
```

### Key Takeaways

- **Storage interfaces are plaintext** - implement encryption in your storage layer
- **Use platform-native security** - iOS Keychain, Android Keystore, OS keychain
- **Separate public and private data** - metadata can be unencrypted, private keys must be encrypted
- **Memory is automatically cleared** - backend handles cleanup after cryptographic operations
- **No changes needed to backend** - just implement the storage interface with encryption

## Core Components

### 1. KeyStoreBackend Interface

The `KeyStoreBackend` is the main contract that defines what a keystore must do. Think of it as a "key manager" that handles:

- **Key lifecycle**: Generate, import, export, and remove keys
- **Cryptographic operations**: Sign, verify, encrypt, decrypt
- **HD wallet operations**: Import seeds and derive child keys
- **Audit logging**: Track key usage for compliance

```typescript
interface KeyStoreBackend {
  generate(options: GenerateOptions): Promise<KeyId>
  import(data: KeyData, format: KeyFormat): Promise<KeyId>
  export(id: KeyId, options?: ExportOptions): Promise<KeyData>
  sign(id: KeyId, data: Uint8Array): Promise<Uint8Array>
  verify(id: KeyId, data: Uint8Array, signature: Uint8Array): Promise<boolean>
  // ... and more
}
```

### 2. XHDKeyStoreBackend

The `XHDKeyStoreBackend` is the primary implementation that supports:

#### Supported Key Types

**Ed25519 (EdDSA)**
- Used primarily for Algorand blockchain signatures
- Implements BIP32-Ed25519 (ARC-0052 standard)
- Deterministic signatures (no randomness needed)
- 64-byte signatures, 32-byte public keys

**P-256 (secp256r1 / ECDSA)**
- WebAuthn/Passkey compatible
- Used for hardware-backed keys and browser integrations
- Domain-specific derivation for WebAuthn credentials

#### Key Storage Architecture

The backend uses a **segregated storage model** where different types of data can be stored in different backends:

```typescript
interface XHDKeyStoreBackendOptions {
  keyStorage?: KeyStorage      // For derived/imported keys
  seedStorage?: SeedStorage    // For HD seeds (most sensitive)
  auditStorage?: AuditStorage  // For audit logs
}
```

This allows integrators to:
- Store seeds in hardware security modules (HSMs) or secure enclaves
- Keep derived keys in fast, local storage
- Archive audit logs to external systems

### 3. Storage Interfaces

#### KeyStorage
Stores individual keys (both derived from HD seeds and imported directly):

```typescript
interface KeyStorage {
  get(id: KeyId): Promise<StoredKeyData | undefined>
  set(id: KeyId, data: StoredKeyData): Promise<void>
  delete(id: KeyId): Promise<boolean>
  list(): Promise<KeyId[]>
  getAll(): Promise<StoredKeyData[]>
}
```

**What it stores**:
- Public keys (always)
- Private keys (for imported non-HD keys)
- HD derivation context (for derived keys: rootKey, path, account, keyIndex)
- Metadata (algorithm, type, labels, custom data)

#### SeedStorage
Stores the master HD seeds (highest security requirements):

```typescript
interface SeedStorage {
  get(id: KeyId): Promise<StoredSeedData | undefined>
  set(id: KeyId, data: StoredSeedData): Promise<void>
  delete(id: KeyId): Promise<boolean>
  list(): Promise<KeyId[]>
  getAll(): Promise<StoredSeedData[]>
}
```

**What it stores**:
- Root key (96 bytes in BIP32-Ed25519 extended format)
- Derived main key (for P-256 domain-specific derivation)
- Metadata

**Security note**: The seed is the "keys to the kingdom" - compromise of the seed compromises ALL derived keys.

#### AuditStorage
Stores operation logs for compliance and debugging:

```typescript
interface AuditStorage {
  append(event: AuditEvent): Promise<void>
  list(filter?: { since?: Date; operation?: string }): Promise<AuditEvent[]>
  clear(): Promise<void>
}
```

**What it stores**:
- Operation type (sign, derive, export, etc.)
- Key IDs involved
- Timestamps
- Success/failure status
- Optional tamper-proof HMAC

## Integration Patterns

### Pattern 1: Basic In-Memory (Development/Testing)

Simplest setup with all data in memory (not persistent):

```typescript
import { XHDKeyStoreBackend } from "@algorandfoundation/keystore"

const backend = new XHDKeyStoreBackend()

// Import a seed
const seedId = await backend.importSeed(seedBytes, { name: "My Wallet" })

// Derive a key
const keyId = await backend.deriveFromSeed(
  seedId, 
  "m/44'/283'/0'/0/0",
  { algorithm: "EdDSA" }
)

// Sign data
const signature = await backend.sign(keyId, transactionBytes)
```

**Use case**: Unit tests, development, temporary sessions

### Pattern 2: Persistent File Storage

Store seeds and keys on disk with encryption:

```typescript
import { XHDKeyStoreBackend } from "@algorandfoundation/keystore"
import { FileKeyStorage, FileSeedStorage } from "./custom-storage"

const backend = new XHDKeyStoreBackend({
  keyStorage: new FileKeyStorage("./keys/"),
  seedStorage: new FileSeedStorage("./seeds/", { 
    encrypt: true,
    passphrase: getUserPassphrase() 
  }),
  auditStorage: new FileAuditStorage("./audit.log")
})
```

**Use case**: Desktop wallets, CLI tools, server applications

### Pattern 3: Hardware Security Module (HSM)

Store seeds in hardware, keys in software:

```typescript
const backend = new XHDKeyStoreBackend({
  keyStorage: new InMemoryKeyStorage(), // Fast access for derived keys
  seedStorage: new HsmSeedStorage({      // Seeds in hardware
    hsmUrl: process.env.HSM_URL,
    credentials: hsmCredentials
  }),
  auditStorage: new SplunkAuditStorage({ // Enterprise logging
    endpoint: process.env.SPLUNK_URL
  })
})
```

**Use case**: Enterprise custody, high-security environments

### Pattern 4: Cloud KMS Integration

Use AWS KMS, Google Cloud KMS, or Azure Key Vault:

```typescript
const backend = new XHDKeyStoreBackend({
  seedStorage: new CloudKmsStorage({
    provider: "aws",
    keyId: "arn:aws:kms:region:account:key/12345",
    region: "us-east-1"
  }),
  keyStorage: new DynamoDbStorage({
    tableName: "wallet-keys",
    region: "us-east-1"
  }),
  auditStorage: new CloudWatchAuditStorage()
})
```

**Use case**: Cloud-native applications, multi-region deployments

### Pattern 5: Browser/Extension Storage

Use browser-specific storage APIs:

```typescript
const backend = new XHDKeyStoreBackend({
  seedStorage: new ExtensionStorage({
    area: "local", // or "sync"
    key: "encrypted-seed"
  }),
  keyStorage: new IndexedDbStorage("keystore"),
  auditStorage: new ConsoleAuditStorage() // or send to backend
})
```

**Use case**: Browser extensions, web wallets

### Pattern 6: Multi-Backend Hybrid

Different security levels for different data types:

```typescript
const backend = new XHDKeyStoreBackend({
  // Seeds: Hardware-backed, never leaves secure enclave
  seedStorage: new SecureEnclaveStorage(),
  
  // Keys: Fast SSD for frequent access
  keyStorage: new RedisStorage({ 
    ttl: 3600, // Cache for 1 hour
    fallback: new FileKeyStorage("./keys/")
  }),
  
  // Audit: Append-only log with tamper detection
  auditStorage: new BlockchainAuditStorage({
    chain: "algorand",
    appId: 12345
  })
})
```

**Use case**: Production systems requiring defense in depth

## Cryptographic Operations

### Signing

**Ed25519 Signing Flow**:
1. Retrieve key from storage
2. If HD-derived key: Use rootKey + derivation context (account, keyIndex)
3. Call XHDWalletAPI.signData() with Peikert derivation
4. Return 64-byte signature

**P-256 Signing Flow**:
1. Retrieve key from storage
2. Use stored privateKey directly
3. Call dp256.signWithDomainSpecificKeyPair()
4. Return ECDSA signature

### Key Derivation

**BIP44 Path Structure**:
```
m / purpose' / coin_type' / account' / change / address_index
```

Example for Algorand address #0:
```
m/44'/283'/0'/0/0
  │   │   │  │ │
  │   │   │  │ └── Address index: 0
  │   │   │  └──── Change: 0 (external/visible)
  │   │   └─────── Account: 0
  │   └─────────── Coin type: 283 (Algorand)
  └─────────────── Purpose: 44 (BIP44)
```

**Hardened Derivation** (marked with '):
- Uses parent private key
- Child public key cannot be derived from parent public key alone
- More secure, prevents chain code leakage attacks

**Non-Hardened Derivation**:
- Uses parent public key
- Allows watch-only wallets to derive child public keys
- Less secure if parent public key is known

### ECDH (Shared Secret Derivation)

Used for establishing secure communication channels between parties:

```
Party A (You)                          Party B (Other)
    │                                       │
    │  Your Private Key: a                  │  Their Private Key: b
    │  Your Public Key: aG                  │  Their Public Key: bG
    │                                       │
    │  Shared Secret = a × bG               │  Shared Secret = b × aG
    │              = abG                    │              = abG
    │                                       │
    └───────────────────────────────────────┘
                        ↓
              Both parties compute
              the SAME shared secret
              without exchanging
              private keys!
```

**Implementation**:
- Ed25519 keys are converted to X25519 (Curve25519) format
- Uses libsodium's `crypto_scalarmult()` for the multiplication
- Works for both HD-derived and imported keys (unified flow)

### Encryption

**encryptWithKey** (Public Key Encryption):
- Derives symmetric key by hashing the public key
- Uses XSalsa20 stream cipher for encryption
- Uses Poly1305 MAC for authentication (prevents tampering)
- Format: `[24-byte nonce || ciphertext]`

**encryptData** (Passphrase-based):
- Uses PBKDF2-like key derivation with random salt
- Same XSalsa20-Poly1305 encryption
- Format: `[16-byte salt || 24-byte nonce || ciphertext]`

## Security Best Practices

### 1. Storage Segregation

**Do**:
- Store seeds in the most secure storage available (HSM > secure enclave > encrypted file > memory)
- Store derived keys in fast, convenient storage
- Use different encryption keys for seeds vs derived keys

**Don't**:
- Store seeds in browser localStorage (vulnerable to XSS)
- Store unencrypted seeds in cloud storage
- Mix seed storage with key storage without additional access controls

### 2. Backup Strategy

**Seeds**:
- Write down the BIP39 mnemonic (12-24 words) on paper or metal
- Store in multiple physical locations (safe deposit boxes)
- Never store digitally without strong encryption

**Derived Keys**:
- Don't backup individual keys - regenerate from seed
- If you must backup, encrypt with strong passphrase

### 3. Audit Logging

**Log these operations**:
- Seed import
- Key derivation
- Signing operations
- Export operations
- Failed authentication attempts

**Don't log**:
- Private keys (obviously)
- Seeds or mnemonics
- Passphrases

### 4. Memory Management

**Best practices**:
- Clear sensitive data from memory when done
- Use `Uint8Array.fill(0)` to zero out private keys
- Don't log sensitive data
- Be careful with error messages (don't leak key IDs or paths)

## Error Handling

The keystore uses specific error classes for different failure modes:

```typescript
// Key not found in storage
try {
  await backend.sign("non-existent-id", data)
} catch (e) {
  if (e instanceof KeyNotFoundError) {
    // Show "Key not found" to user
  }
}

// Invalid key data
try {
  await backend.import({ metadata, publicKey: invalidKey }, "raw")
} catch (e) {
  if (e instanceof InvalidKeyDataError) {
    // Show validation error to user
  }
}

// Operation not supported
try {
  await backend.generate(options)
} catch (e) {
  if (e instanceof KeyGenerationNotSupportedError) {
    // Explain that direct generation isn't supported, use importSeed instead
  }
}
```

## Extending the Keystore

### Custom Storage Backend

Implement the storage interfaces to create custom backends:

```typescript
class MyCustomStorage implements KeyStorage {
  async get(id: KeyId): Promise<StoredKeyData | undefined> {
    // Your implementation
  }
  
  async set(id: KeyId, data: StoredKeyData): Promise<void> {
    // Your implementation
  }
  
  async delete(id: KeyId): Promise<boolean> {
    // Your implementation
  }
  
  async list(): Promise<KeyId[]> {
    // Your implementation
  }
  
  async getAll(): Promise<StoredKeyData[]> {
    // Your implementation
  }
}
```

### Custom Backend Implementation

Create a new backend by implementing `KeyStoreBackend`:

```typescript
class HardwareWalletBackend implements KeyStoreBackend {
  constructor(private device: HardwareDevice) {}
  
  async sign(id: KeyId, data: Uint8Array): Promise<Uint8Array> {
    // Delegate to hardware device
    return this.device.sign(id, data)
  }
  
  // Implement other methods...
}
```

## Sample Flows

### HD Wallet Creation and Usage

```mermaid
sequenceDiagram
    participant User
    participant App
    participant Backend as XHDKeyStoreBackend
    participant SeedStore as SeedStorage
    participant KeyStore as KeyStorage

    User->>App: Create new wallet
    App->>Backend: generateMnemonic()
    Backend-->>App: mnemonic (12-24 words)
    App->>User: Display: "abandon ability able..."
    User->>App: Confirm backup
    App->>Backend: importSeed(seedBytes)
    Backend->>SeedStore: store seed
    SeedStore-->>Backend: seedId
    Backend-->>App: seedId

    User->>App: Generate address
    App->>Backend: deriveFromSeed(seedId, "m/44'/283'/0'/0/0")
    Backend->>KeyStore: store derived key metadata
    KeyStore-->>Backend: keyId
    Backend-->>App: keyId
    App->>User: Display address

    User->>App: Sign transaction
    App->>Backend: sign(keyId, txBytes)
    Backend->>SeedStore: get seed
    SeedStore-->>Backend: seed
    Backend->>Backend: derive key & sign
    Backend-->>App: signature
    App->>User: Transaction signed!
```

### Key Import and Export

```mermaid
sequenceDiagram
    participant User
    participant App
    participant Backend
    participant Storage

    User->>App: Import private key
    App->>Backend: import(keyData, "raw")
    Backend->>Backend: Validate key
    Backend->>Storage: store key
    Storage-->>Backend: keyId
    Backend-->>App: keyId
    App->>User: Key imported successfully

    User->>App: Export public key
    App->>Backend: export(keyId, { format: "raw" })
    Backend->>Storage: get key
    Storage-->>Backend: key (public only)
    Backend-->>App: publicKey
    App->>User: Display public key
    Note over App: Private key NEVER exported
```

### Audit Logging

```mermaid
sequenceDiagram
    participant App
    participant Backend
    participant Audit as AuditStorage

    App->>Backend: sign(keyId, data)
    Backend->>Backend: Perform signing
    Backend->>Audit: log({ operation: "sign", keyId, success: true })
    Audit-->>Backend: logged
    Backend-->>App: signature

    App->>Backend: getAuditLogs({ since: yesterday })
    Backend->>Audit: list({ since: yesterday })
    Audit-->>Backend: events
    Backend-->>App: audit events
```

## Conclusion

The Keystore Extension provides a flexible, secure foundation for cryptographic key management. Its pluggable storage architecture allows integrators to balance security, performance, and convenience based on their specific requirements.

**Key takeaways**:
- Use HD wallets for better backup and organization
- Segregate storage based on sensitivity (seeds > keys > audit)
- Choose storage backends appropriate for your environment
- Always audit security-critical operations
- Never compromise on seed security
