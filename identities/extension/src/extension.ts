import { WithIdentityStore } from "@algorandfoundation/identities-store";
import type { WithIdentitiesKeystore as WithIdentitiesKeystoreType } from "@algorandfoundation/identities-keystore-extension";
import type { Extension } from "@algorandfoundation/wallet-provider";
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
  // Load the identity store
  const identityStore = WithIdentityStore(provider, options);

  const api: any = {
    get identities() {
      return identityStore.identities;
    },
    identity: {
      ...identityStore.identity,
      store: {
        ...identityStore.identity.store,
      },
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

    // Dynamic import to support React Native and reduce bundle size
    const loadBridge = async () => {
      const { WithIdentitiesKeystore } =
        (await import("@algorandfoundation/identities-keystore-extension")) as {
          WithIdentitiesKeystore: typeof WithIdentitiesKeystoreType;
        };
      return WithIdentitiesKeystore(bridgeProvider, options as any);
    };

    // Trigger background loading for autoPopulate to work
    const bridgePromise = loadBridge();

    // Add lazy restoreFromDidDocument
    api.identity.store.restoreFromDidDocument = async (doc: any) => {
      const bridgeContribution = await bridgePromise;
      return bridgeContribution.identity.store.restoreFromDidDocument(doc);
    };
  }

  return api as IdentitiesExtension;
};
