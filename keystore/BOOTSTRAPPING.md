# Keystore Bootstrapping Guide

## Core Principle: Separation of Concerns

The keystore follows a **clear separation** between UI state and cryptographic material:

- **TanStack Store** → UI state (metadata, loading states, selected keys)
- **Secure Storage** → Cryptographic keys and seeds (encrypted, persistent)

This ensures your private keys are never stored in React state or Redux stores.

## React Native Mobile App (Provider Pattern)

### 1. Project Structure

```
src/
├── providers/
│   └── wallet-provider.tsx    # Provider with keystore extension
├── stores/
│   └── wallet-store.ts        # TanStack Store for UI state
├── storage/
│   ├── async-storage.ts       # Raw bytes storage implementation
│   └── keychain-wrapper.ts    # Encryption wrapper (iOS/Android secure enclave)
└── hooks/
    └── use-wallet.ts          # Custom hook for accessing provider
```

### 2. Wallet Store (UI State Only)

```typescript
// stores/wallet-store.ts
import { Store } from "@tanstack/react-store"
import type { KeyMetadata } from "@algorandfoundation/keystore-extension"

export interface WalletUIState {
  // Metadata only - NO cryptographic material
  keys: Array<{
    id: string
    name: string
    type: "seed" | "key"
    algorithm: string
    createdAt: Date
  }>
  
  // UI state
  isLoading: boolean
  error: string | null
  selectedKeyId: string | null
}

export const walletStore = new Store<WalletUIState>({
  keys: [],
  isLoading: false,
  error: null,
  selectedKeyId: null
})

// Helper to sync metadata from keystore to store
export async function syncKeysMetadata(keystore: KeyStoreBackend) {
  const allKeys = await keystore.list()
  
  walletStore.setState(state => ({
    ...state,
    keys: allKeys.map(meta => ({
      id: meta.id,
      name: meta.labels?.name || "Unnamed",
      type: meta.type === "hd-seed" ? "seed" : "key",
      algorithm: meta.algorithm,
      createdAt: meta.createdAt
    }))
  }))
}
```

### 3. Secure Storage Implementation

```typescript
// storage/async-storage.ts
import AsyncStorage from "@react-native-async-storage/async-storage"
import type { RawBytesStorage } from "@algorandfoundation/keystore-extension"

export class AsyncStorageRaw implements RawBytesStorage {
  async get(id: string): Promise<Uint8Array | undefined> {
    const data = await AsyncStorage.getItem(`keystore/${id}`)
    return data ? Buffer.from(data, 'base64') : undefined
  }
  
  async set(id: string, data: Uint8Array): Promise<void> {
    await AsyncStorage.setItem(`keystore/${id}`, 
      Buffer.from(data).toString('base64')
    )
  }
  
  async delete(id: string): Promise<boolean> {
    const exists = await AsyncStorage.getItem(`keystore/${id}`)
    if (!exists) return false
    await AsyncStorage.removeItem(`keystore/${id}`)
    return true
  }
  
  async list(): Promise<string[]> {
    const keys = await AsyncStorage.getAllKeys()
    return keys
      .filter(k => k.startsWith('keystore/'))
      .map(k => k.replace('keystore/', ''))
  }
  
  async getAll(): Promise<Uint8Array[]> {
    const keys = await this.list()
    const values = await Promise.all(keys.map(k => this.get(k)))
    return values.filter((v): v is Uint8Array => v !== undefined)
  }
}
```

```typescript
// storage/keychain-wrapper.ts
import * as RNKeychain from "react-native-keychain"
import type { KeyWrapper, SeedWrapper, StoredKeyData, StoredSeedData } from "@algorandfoundation/keystore-extension"

// Keys: Use iOS Keychain / Android Keystore
export class ReactNativeKeychainWrapper implements KeyWrapper {
  async wrap(data: StoredKeyData): Promise<Uint8Array> {
    const payload = JSON.stringify({
      metadata: data.metadata,
      publicKey: Buffer.from(data.publicKey).toString('base64'),
      privateKey: data.privateKey ? Buffer.from(data.privateKey).toString('base64') : undefined,
      curve: data.curve
    })
    
    // Store encrypted in keychain - key managed by OS
    await RNKeychain.setGenericPassword(
      `key-${data.metadata.id}`,
      payload,
      { 
        service: `keystore-key-${data.metadata.id}`,
        accessible: RNKeychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY
      }
    )
    
    return new TextEncoder().encode("stored-in-keychain")
  }
  
  async unwrap(_wrapped: Uint8Array, id: string): Promise<StoredKeyData> {
    const credentials = await RNKeychain.getGenericPassword({
      service: `keystore-key-${id}`
    })
    
    if (!credentials) throw new Error("Key not found in keychain")
    
    const parsed = JSON.parse(credentials.password)
    return {
      metadata: parsed.metadata,
      publicKey: Buffer.from(parsed.publicKey, 'base64'),
      privateKey: parsed.privateKey ? Buffer.from(parsed.privateKey, 'base64') : undefined,
      curve: parsed.curve
    }
  }
}

// Seeds: Use Secure Enclave / TEE (stronger protection)
export class ReactNativeSecureEnclaveWrapper implements SeedWrapper {
  async wrap(data: StoredSeedData): Promise<Uint8Array> {
    const payload = JSON.stringify({
      metadata: data.metadata,
      rootKey: Buffer.from(data.rootKey).toString('base64'),
      derivedMainKey: data.derivedMainKey ? Buffer.from(data.derivedMainKey).toString('base64') : undefined
    })
    
    // Use Secure Enclave on iOS, StrongBox on Android
    await RNKeychain.setGenericPassword(
      `seed-${data.metadata.id}`,
      payload,
      { 
        service: `keystore-seed-${data.metadata.id}`,
        accessible: RNKeychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        // On Android, this uses the TEE if available
      }
    )
    
    return new TextEncoder().encode("stored-in-secure-enclave")
  }
  
  async unwrap(_wrapped: Uint8Array, id: string): Promise<StoredSeedData> {
    const credentials = await RNKeychain.getGenericPassword({
      service: `keystore-seed-${id}`
    })
    
    if (!credentials) throw new Error("Seed not found in secure storage")
    
    const parsed = JSON.parse(credentials.password)
    return {
      metadata: parsed.metadata,
      rootKey: Buffer.from(parsed.rootKey, 'base64'),
      derivedMainKey: parsed.derivedMainKey ? Buffer.from(parsed.derivedMainKey, 'base64') : undefined
    }
  }
}
```

### 4. Provider with Keystore Extension

```typescript
// providers/wallet-provider.tsx
import { createContext, useContext, useEffect } from "react"
import { Provider as WalletProvider } from "@algorandfoundation/wallet-provider"
import { createKeyStore, type KeyStoreBackend } from "@algorandfoundation/keystore-extension"
import { walletStore, syncKeysMetadata } from "../stores/wallet-store"
import { AsyncStorageRaw } from "../storage/async-storage"
import { ReactNativeKeychainWrapper, ReactNativeSecureEnclaveWrapper } from "../storage/keychain-wrapper"

// Extend provider type
type ExtendedProvider = WalletProvider & {
  keystore: KeyStoreBackend
}

const WalletContext = createContext<ExtendedProvider | null>(null)

export function WalletProviderWithKeystore({ children }: { children: React.ReactNode }) {
  // Create keystore with secure storage (once)
  const keystore = createKeyStore({
    mode: "wrapped",
    rawStorage: new AsyncStorageRaw(),
    keyWrapper: new ReactNativeKeychainWrapper(),
    seedWrapper: new ReactNativeSecureEnclaveWrapper()
  })
  
  // Sync metadata to TanStack Store on mount
  useEffect(() => {
    syncKeysMetadata(keystore)
  }, [keystore])
  
  // Create base provider with keystore extension
  const provider = new WalletProvider({
    extensions: [
      { keystore }  // Injected into provider
    ]
  }) as ExtendedProvider
  
  return (
    <WalletContext.Provider value={provider}>
      {children}
    </WalletContext.Provider>
  )
}

export const useWallet = () => {
  const context = useContext(WalletContext)
  if (!context) throw new Error("useWallet must be used within WalletProviderWithKeystore")
  return context
}
```

### 5. Component Usage

```typescript
// screens/WalletScreen.tsx
import { View, Button, Text, FlatList } from "react-native"
import { useStore } from "@tanstack/react-store"
import { useWallet } from "../providers/wallet-provider"
import { walletStore } from "../stores/wallet-store"

export function WalletScreen() {
  const { keystore } = useWallet()
  const { keys, isLoading, selectedKeyId } = useStore(walletStore)
  
  const handleCreateWallet = async () => {
    walletStore.setState(s => ({ ...s, isLoading: true }))
    
    try {
      // Generate seed and derive first address
      const seedId = await keystore.importSeed(crypto.getRandomValues(new Uint8Array(32)))
      const keyId = await keystore.deriveFromSeed(seedId, "m/44'/283'/0'/0/0")
      
      // Sync metadata to UI store
      await syncKeysMetadata(keystore)
      
    } catch (error) {
      walletStore.setState(s => ({ ...s, error: error.message }))
    } finally {
      walletStore.setState(s => ({ ...s, isLoading: false }))
    }
  }
  
  const handleSign = async () => {
    if (!selectedKeyId) return
    
    // Key is fetched from secure storage, NOT from React state
    const txBytes = new Uint8Array([...]) // Your transaction
    const signature = await keystore.sign(selectedKeyId, txBytes)
    
    return signature
  }
  
  return (
    <View>
      {isLoading && <Text>Loading...</Text>}
      
      <FlatList
        data={keys}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <Button
            title={item.name}
            onPress={() => walletStore.setState(s => ({ 
              ...s, 
              selectedKeyId: item.id 
            }))}
          />
        )}
      />
      
      <Button onPress={handleCreateWallet} title="Create Wallet" />
      <Button onPress={handleSign} title="Sign Transaction" disabled={!selectedKeyId} />
    </View>
  )
}
```

## Node.js Server Example

For backend/CLI tools with file-based encrypted storage:

```typescript
// server/keystore-setup.ts
import { createKeyStore } from "@algorandfoundation/keystore-extension"
import * as fs from "fs/promises"
import * as path from "path"
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto"

class FileSystemRawStorage implements RawBytesStorage {
  constructor(private basePath: string) {}
  
  private getPath(id: string) {
    return path.join(this.basePath, `${id}.enc`)
  }
  
  async get(id: string): Promise<Uint8Array | undefined> {
    try {
      return await fs.readFile(this.getPath(id))
    } catch {
      return undefined
    }
  }
  
  async set(id: string, data: Uint8Array): Promise<void> {
    await fs.mkdir(this.basePath, { recursive: true })
    await fs.writeFile(this.getPath(id), data)
  }
  
  async delete(id: string): Promise<boolean> {
    try {
      await fs.unlink(this.getPath(id))
      return true
    } catch {
      return false
    }
  }
  
  async list(): Promise<string[]> {
    const files = await fs.readdir(this.basePath).catch(() => [])
    return files
      .filter(f => f.endsWith('.enc'))
      .map(f => f.replace('.enc', ''))
  }
  
  async getAll(): Promise<Uint8Array[]> {
    const ids = await this.list()
    const values = await Promise.all(ids.map(id => this.get(id)))
    return values.filter((v): v is Uint8Array => v !== undefined)
  }
}

class NodeAESWrapper implements KeyWrapper, SeedWrapper {
  private key: Buffer
  
  constructor(passphrase: string, salt: string) {
    // Derive key from passphrase
    this.key = scryptSync(passphrase, salt, 32)
  }
  
  async wrap(data: any): Promise<Uint8Array> {
    const iv = randomBytes(16)
    const cipher = createCipheriv("aes-256-gcm", this.key, iv)
    
    const json = JSON.stringify(data)
    const encrypted = Buffer.concat([
      cipher.update(json, "utf8"),
      cipher.final()
    ])
    const authTag = cipher.getAuthTag()
    
    // Store: iv + authTag + encrypted
    return Buffer.concat([iv, authTag, encrypted])
  }
  
  async unwrap(wrapped: Uint8Array): Promise<any> {
    const iv = wrapped.slice(0, 16)
    const authTag = wrapped.slice(16, 32)
    const encrypted = wrapped.slice(32)
    
    const decipher = createDecipheriv("aes-256-gcm", this.key, iv)
    decipher.setAuthTag(authTag)
    
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ])
    
    return JSON.parse(decrypted.toString("utf8"))
  }
}

// Usage
export function createServerKeystore() {
  const passphrase = process.env.KEYSTORE_PASSPHRASE || "your-secure-passphrase"
  const wrapper = new NodeAESWrapper(passphrase, "app-salt")
  
  return createKeyStore({
    mode: "wrapped",
    rawStorage: new FileSystemRawStorage("./keystore-data"),
    keyWrapper: wrapper,
    seedWrapper: wrapper
  })
}
```

## Quick Reference

| Environment | Raw Storage | Encryption | Wrapper |
|-------------|-------------|------------|---------|
| **React Native** | AsyncStorage/SQLite | iOS Keychain / Android Keystore | ReactNativeKeychainWrapper |
| **Web** | IndexedDB | Web Crypto API | WebCryptoWrapper |
| **Node.js** | Filesystem | Node.js crypto | NodeAESWrapper |
| **Testing** | In-Memory | None | (test-only mode) |

## Key Takeaways

1. **Never store keys in React state** - Always use secure storage
2. **TanStack Store = UI only** - Metadata, loading states, selections
3. **Secure Storage = Keys only** - Encrypted, hardware-backed when possible
4. **Sync on mount** - Load metadata from keystore into store on app start
5. **On-demand decryption** - Only decrypt when signing, clear after use

This architecture gives you:
- ✅ Reactive UI updates via TanStack Store
- ✅ Secure key storage via platform secure enclaves
- ✅ Type safety throughout
- ✅ Easy testing with test-only mode
- ✅ Production-ready security
