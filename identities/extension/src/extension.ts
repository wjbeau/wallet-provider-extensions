import { WithIdentityStore } from "@wjbeau/identities-store";
import type { IdentityStoreState } from "@wjbeau/identities-store";
import type { WithIdentitiesKeystore as WithIdentitiesKeystoreType } from "@wjbeau/identities-keystore-extension";
import type { Extension } from "@algorandfoundation/wallet-provider";
import { Store } from "@tanstack/store";
import type { IdentitiesExtension, IdentitiesExtensionOptions } from "./types.ts";

/**
 * Unified extension that combines identity store and keystore bridge.
 *
 * It always provides the identity store, and if the keystore extension is present
 * on the provider, it also initializes the identities-keystore bridge.
 *
 * @param provider - The provider instance being extended.
 * @param options - Configuration options for the extension.
 * @returns The unified identities extension.
 *
 * @example
 * ```typescript
 * const provider = Provider.withExtensions([WithIdentities]);
 * ```
 */
export const WithIdentities: Extension<IdentitiesExtension> = (
  provider: any,
  options: IdentitiesExtensionOptions,
) => {
  // Resolve (or create) the concrete identity store up front so the same
  // instance is shared with the dynamically loaded keystore bridge.
  const identitiesStore =
    options?.identities?.store ?? new Store<IdentityStoreState>({ identities: [] });

  const resolvedOptions: IdentitiesExtensionOptions = {
    ...options,
    identities: {
      ...options?.identities,
      store: identitiesStore,
    } as IdentitiesExtensionOptions["identities"],
  };

  // Load the identity store (incrementally — reuses provider.identity?.store if present).
  const identityStore = WithIdentityStore(provider, resolvedOptions);

  const api: any = {
    get identities() {
      return identityStore.identities;
    },
    identity: {
      ...identityStore.identity,
      // Reuse (rather than shallow-copy) the resolved identity store API so
      // any properties attached below also live on the shared instance and
      // are not lost if a downstream consumer reads the original reference.
      store: identityStore.identity.store,
    },
  };

  // Conditionally load the keystore bridge if keystore is available
  if (provider?.key?.store) {
    // We need to provide a provider that includes the identity store
    // so that WithIdentitiesKeystore can find provider.identity
    const bridgeProvider = Object.create(provider, {
      identities: {
        get() {
          return identityStore.identities;
        },
        enumerable: true,
      },
      identity: {
        value: identityStore.identity,
        enumerable: true,
      },
    });

    // Pass the concrete identities store/hooks into the bridge so it does not
    // throw at runtime when consumers wire WithKeyStore + WithIdentities
    // without explicitly providing `options.identities.store`.
    const bridgeOptions = resolvedOptions as any;

    // Dynamic import to support React Native and reduce bundle size
    const loadBridge = async () => {
      const { WithIdentitiesKeystore } =
        (await import("@wjbeau/identities-keystore-extension")) as {
          WithIdentitiesKeystore: typeof WithIdentitiesKeystoreType;
        };
      return WithIdentitiesKeystore(bridgeProvider, bridgeOptions);
    };

    // Trigger background loading for autoPopulate to work. Attach a no-op
    // rejection handler so an unavailable bridge module (e.g. peer not
    // installed) does not surface as an unhandled promise rejection.
    const bridgePromise = loadBridge();
    bridgePromise.catch(() => {
      /* swallow: surfaced lazily via restoreFromDidDocument below */
    });

    // Add lazy restoreFromDidDocument
    api.identity.store.restoreFromDidDocument = async (doc: any) => {
      const bridgeContribution = await bridgePromise;
      return bridgeContribution.identity.store.restoreFromDidDocument(doc);
    };
  }

  return api as IdentitiesExtension;
};
