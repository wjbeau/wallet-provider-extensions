import { base58 } from "@scure/base";
import type { Key, KeyStoreState } from "@wjbeau/keystore";
import { generateDidKey, generateDidDocument } from "@wjbeau/identities-store";
import type {
  Identity,
  IdentityStoreState,
  DIDDocument,
} from "@wjbeau/identities-store";
import type { Extension } from "@algorandfoundation/wallet-provider";
import type { Store } from "@tanstack/store";
import { decodeAddress, toBase64URL } from "./utils.ts";
import type { IdentitiesKeystoreExtension, IdentitiesKeystoreExtensionOptions } from "./types.ts";

/**
 * Resolve the seed id for a given key by walking the parent chain.
 *
 * - For a derived key (`hd-derived-*`/`xhd-derived-*`), `metadata.parentKeyId`
 *   points at the root key, whose `metadata.rootKeyId` is the seed id.
 * - For a root key, `metadata.rootKeyId` is the seed id directly.
 * - For a seed itself, the seed id is the key's own id.
 */
const getSeedIdForKey = (key: Key | undefined, allKeys: Key[]): string | undefined => {
  if (!key) return undefined;
  // `seed` is the canonical seed type; `hd-seed` is kept for backwards compatibility.
  if (key.type === "seed" || key.type === "hd-seed") return key.id;
  if (key.type === "hd-root-key") {
    // Root keys may be linked to their seed via `rootKeyId` or `parentKeyId`;
    // fall back to the root key's own id when neither is present.
    return (
      (key.metadata?.rootKeyId as string | undefined) ??
      (key.metadata?.parentKeyId as string | undefined) ??
      key.id
    );
  }
  const parentId = key.metadata?.parentKeyId as string | undefined;
  if (!parentId) return undefined;
  const parent = allKeys.find((k) => k.id === parentId);
  if (!parent) return parentId;
  return getSeedIdForKey(parent, allKeys);
};

/**
 * Extension that bridges the identity store and keystore.
 *
 * It automatically populates the identity store with identities derived from keys
 * in the keystore with context 1, providing a sign method that leverages the keystore backend.
 *
 * @param provider - The provider instance being extended.
 * @param options - Configuration options for the extension.
 * @returns The identities keystore extension.
 *
 * @example
 * ```typescript
 * const provider = Provider.withExtensions([WithIdentityStore, WithKeyStore, WithIdentitiesKeystore]);
 * ```
 */
export const WithIdentitiesKeystore: Extension<IdentitiesKeystoreExtension> = (
  provider: any,
  options: IdentitiesKeystoreExtensionOptions,
) => {
  // Ensure dependencies are present
  if (!provider.identity) {
    throw new Error(
      "IdentitiesKeystore extension requires WithIdentityStore extension to be present on the provider.",
    );
  }
  if (!provider.key) {
    throw new Error(
      "IdentitiesKeystore extension requires WithKeyStore extension to be present on the provider.",
    );
  }

  const keyStore: Store<KeyStoreState> = options.keystore.store;
  const identityStore: Store<IdentityStoreState> = options.identities.store;
  const { autoPopulate = true } = options.identities.keystore ?? {};

  /**
   * Recreates the keystore state (derived keys) based on the provided DID Document.
   */
  const restoreFromDidDocument = async (doc: DIDDocument) => {
    const getLatestKeys = () => (keyStore.state.keys as unknown as Key[]) ?? [];
    const rootKey = getLatestKeys().find((k) => k.type === "hd-root-key");

    if (!rootKey) {
      throw new Error("No root key found in keystore. Recovery phrase must be imported first.");
    }

    // 1. Verify that the root key matches the backup document by re-deriving an account key
    const verificationVm = doc.verificationMethod.find(
      (vm) =>
        vm.metadata &&
        vm.metadata.context === 0 &&
        (vm.metadata.type === "hd-derived-ed25519" || !vm.metadata.type),
    );

    if (verificationVm) {
      const keyId = await provider.key.store.generate({
        type: verificationVm.metadata?.type || "hd-derived-ed25519",
        algorithm: "EdDSA",
        extractable: true,
        keyUsages: ["sign", "verify"],
        params: {
          ...verificationVm.metadata,
          parentKeyId: rootKey.id,
        },
      });

      const decoded = base58.decode(verificationVm.publicKeyMultibase.slice(1));
      const expectedPublicKey = decoded.slice(2); // Remove multicodec prefix [0xed, 0x01]

      const generatedKey = (keyStore.state.keys as unknown as Key[]).find((k) => k.id === keyId);
      if (generatedKey?.publicKey) {
        const actualPublicKey = generatedKey.publicKey;
        const matches =
          actualPublicKey.length === expectedPublicKey.length &&
          actualPublicKey.every((v, i) => v === expectedPublicKey[i]);

        if (!matches) {
          throw new Error(
            "The recovery phrase does not match the backup file. Verification failed.",
          );
        }
      }
    }

    const processedDerivations = new Set<string>();

    const restoreKey = async (id: string, metadata: any) => {
      if (!metadata || (metadata.context === undefined && metadata.origin === undefined)) {
        return;
      }

      const {
        context,
        account,
        index,
        derivation,
        origin,
        userHandle,
        counter,
        keyType: metadataKeyType,
        type,
      } = metadata;

      // DID documents generated by this extension store the keystore key type
      // under `metadata.keyType`; fall back to `metadata.type` for older docs.
      const keyType = metadataKeyType || type || "hd-derived-ed25519";
      const algorithm =
        keyType === "xhd-derived-p256" || keyType === "hd-derived-p256" ? "P256" : "EdDSA";

      const keyId = id.includes("#") ? id.split("#").pop() : id;

      if (!keyId) {
        return;
      }

      const derivationKey = JSON.stringify({
        keyType,
        context,
        account,
        index,
        derivation,
        origin,
        userHandle,
        counter,
      });
      if (processedDerivations.has(derivationKey)) return;
      processedDerivations.add(derivationKey);

      const currentKeys = getLatestKeys();
      const exists = currentKeys.some(
        (k) =>
          k.id === keyId ||
          (k.type === keyType &&
            k.metadata?.context === context &&
            k.metadata?.account === account &&
            k.metadata?.index === index &&
            k.metadata?.derivation === derivation &&
            k.metadata?.origin === origin &&
            k.metadata?.userHandle === userHandle &&
            k.metadata?.counter === counter),
      );

      let processedUserHandle = userHandle;
      if (typeof userHandle === "string" && userHandle.length === 58) {
        try {
          const bytes = decodeAddress(userHandle).publicKey;
          processedUserHandle = toBase64URL(bytes);
        } catch (e) {
          // Not an address, keep as is
        }
      }

      if (!exists) {
        try {
          await provider.key.store.generate({
            type: keyType,
            algorithm,
            extractable: true,
            keyUsages: ["sign", "verify"],
            params: {
              ...metadata,
              userHandle: processedUserHandle,
              id: keyId,
              parentKeyId: rootKey.id,
            },
          });
        } catch (e) {
          // Continue with other keys even if one fails
        }
      }
    };

    const sortedMethods = [...doc.verificationMethod].sort((a, b) => {
      const contextA = a.metadata?.context;
      const contextB = b.metadata?.context;
      if (contextA === 1 && contextB !== 1) return 1;
      if (contextA !== 1 && contextB === 1) return -1;
      return 0;
    });

    for (const vm of sortedMethods) {
      await restoreKey(vm.id, vm.metadata);
    }
  };

  const localKeys: Key[] = [];

  /**
   * Creates an identity object for a given key ID and address.
   */
  const createKeyIdentity = (
    keyId: string,
    address: string,
    did: string,
    publicKey: Uint8Array,
  ): Identity => {
    const currentKey = localKeys.find((rk) => rk.id === keyId);

    // Anchor the identity to the seed: every derived key (ed25519 or p256)
    // descending from the same seed is part of this identity's hierarchy.
    // P256 keys (including `xhd-derived-p256` with `metadata.origin`, i.e. passkeys)
    // are surfaced as JsonWebKey2020 verification methods alongside the ed25519 ones.
    const seedId = getSeedIdForKey(currentKey, localKeys);
    const additionalKeys: {
      id: string;
      publicKey: Uint8Array;
      type: string;
      algorithm?: string;
      metadata?: Record<string, any>;
    }[] = localKeys
      .filter((k) => {
        if (!k.publicKey || k.id === keyId) return false;
        if (
          k.type !== "hd-derived-ed25519" &&
          k.type !== "hd-derived-p256" &&
          k.type !== "xhd-derived-p256"
        ) {
          return false;
        }
        return seedId !== undefined && getSeedIdForKey(k, localKeys) === seedId;
      })
      .map((k) => {
        const isP256 = k.type === "hd-derived-p256" || k.type === "xhd-derived-p256";
        return {
          id: `${did}#${k.id}`,
          publicKey: k.publicKey!,
          type: isP256 ? "JsonWebKey2020" : "Ed25519VerificationKey2020",
          algorithm: isP256 ? "P256" : "EdDSA",
          metadata: { ...k.metadata, keyType: k.type },
        };
      });

    const didDocument = generateDidDocument(
      did,
      publicKey,
      additionalKeys,
      [],
      currentKey?.metadata,
      keyId,
    );

    return {
      address,
      did,
      didDocument,
      type: "did:key",
      metadata: { keyId },
      sign: async (txns: Uint8Array[]) => {
        const signedTxns: Uint8Array[] = [];
        for (const txn of txns) {
          const signed = await provider.key.store.sign(keyId, txn);
          signedTxns.push(signed);
        }
        return signedTxns;
      },
    };
  };

  if (autoPopulate) {
    let isProcessing = false;
    let nextKeys: Key[] | null = null;
    const processUpdates = async (newKeys: Key[]) => {
      if (isProcessing) {
        nextKeys = newKeys;
        return;
      }
      isProcessing = true;
      try {
        nextKeys = null;

        const addedKeys = newKeys.filter(
          (newKey) => !localKeys.some((existingKey) => existingKey.id === newKey.id),
        );

        const removedKeys = localKeys.filter(
          (existingKey) => !newKeys.some((newKey) => newKey.id === existingKey.id),
        );

        // An identity's DID document hierarchy includes every derived key
        // descending from the same seed. So whenever ANY derived key changes
        // (added/removed/metadata-changed), every identity rooted in the
        // affected seed must be re-rendered.
        const isDerived = (k: Key) =>
          k.type === "hd-derived-ed25519" ||
          k.type === "hd-derived-p256" ||
          k.type === "xhd-derived-p256";

        const updatedKeys = newKeys.filter((nk) => {
          const existing = localKeys.find((k) => k.id === nk.id);
          if (!existing) return false;
          return JSON.stringify(existing.metadata) !== JSON.stringify(nk.metadata);
        });

        const hierarchyChanged =
          addedKeys.some(isDerived) || removedKeys.some(isDerived) || updatedKeys.some(isDerived);

        if (addedKeys.length === 0 && removedKeys.length === 0 && updatedKeys.length === 0) {
          return;
        }

        localKeys.length = 0;
        newKeys.forEach((k) => localKeys.push(k));

        for (const k of removedKeys) {
          if (k.type === "hd-derived-ed25519" && k.publicKey) {
            const address = generateDidKey(k.publicKey);
            const identity = identityStore.state.identities.find((i) => i.address === address);
            if (identity && identity.metadata?.keyId === k.id) {
              await provider.identity.store.removeIdentity(address);
            }
          }
        }

        for (const k of addedKeys) {
          if (k.type === "hd-derived-ed25519" && k.publicKey && k.metadata?.context === 1) {
            const did = generateDidKey(k.publicKey);
            const address = did;

            if (!identityStore.state.identities.some((i) => i.address === address)) {
              await provider.identity.store.addIdentity(
                createKeyIdentity(k.id, address, did, k.publicKey),
              );
            }
          }
        }

        for (const k of updatedKeys) {
          if (k.type === "hd-derived-ed25519" && k.publicKey && k.metadata?.context === 1) {
            const did = generateDidKey(k.publicKey);
            const address = did;

            const identity = identityStore.state.identities.find((i) => i.address === address);
            if (identity) {
              const newIdentity = createKeyIdentity(k.id, address, did, k.publicKey);
              await provider.identity.store.updateDidDocument(address, newIdentity.didDocument!);
            }
          }
        }

        // If the seed hierarchy was touched but the identity key itself didn't
        // change, still refresh every existing identity so its derived-key list
        // stays in sync (e.g. a new account key was added under the same seed).
        if (hierarchyChanged) {
          for (const identity of identityStore.state.identities) {
            const idKeyId = identity.metadata?.keyId as string | undefined;
            if (!idKeyId || !identity.did) continue;
            const idKey = localKeys.find((k) => k.id === idKeyId);
            if (!idKey || !idKey.publicKey) continue;
            // Skip if we already added/updated this identity in this tick.
            const alreadyHandled =
              addedKeys.some((k) => k.id === idKeyId) || updatedKeys.some((k) => k.id === idKeyId);
            if (alreadyHandled) continue;
            const refreshed = createKeyIdentity(
              idKeyId,
              identity.address,
              identity.did,
              idKey.publicKey,
            );
            await provider.identity.store.updateDidDocument(
              identity.address,
              refreshed.didDocument!,
            );
          }
        }
      } finally {
        isProcessing = false;
        if (nextKeys) {
          const k = nextKeys;
          nextKeys = null;
          await processUpdates(k);
        }
      }
    };

    processUpdates(keyStore.state.keys as unknown as Key[]);

    keyStore.subscribe((state) => {
      if (state.status !== "ready" && state.status !== "idle") {
        return;
      }
      processUpdates(state.keys as unknown as Key[]);
    });
  }

  // Merge into the existing identity.store so we don't clobber the API
  // (add/remove/get/clear/updateDidDocument) contributed by WithIdentityStore.
  return {
    identity: {
      store: Object.assign(provider.identity.store ?? {}, {
        restoreFromDidDocument,
      }),
    },
  } as unknown as IdentitiesKeystoreExtension;
};
