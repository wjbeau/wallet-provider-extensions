import { Stack } from "expo-router";
import { AlgorandProvider, ReactNativeProvider } from "@/providers/ReactNativeProvider";
import { install } from "react-native-quick-crypto";
import { keyStore } from "@/stores/keystore";
import { keyStoreHooks, accountHooks } from "@/stores/before-after";
import { fetchSecret, storage } from "@algorandfoundation/react-native-keystore";
import {
  initializeKeyStore,
  Key,
  KeyData,
  KeyStoreState,
  setStatus,
} from "@algorandfoundation/keystore";
import { Store } from "@tanstack/store";
import { accountsStore } from "@/stores/accounts";
import type { ReactKeystoreOptions } from "@algorandfoundation/react-native-keystore";

install();

const biometricOptions: ReactKeystoreOptions["keystore"]["authentication"] = {
  biometrics: true,
  prompt: "Authenticate to access your wallet",
};
async function bootstrap() {
  setStatus({ store: keyStore as unknown as Store<KeyStoreState>, status: "loading" });
  const secrets = await Promise.all(
    storage
      .getAllKeys()
      .map(async (keyId) => fetchSecret<KeyData>({ keyId, options: biometricOptions })),
  );
  initializeKeyStore({
    store: keyStore as unknown as Store<KeyStoreState>,
    keys: secrets
      .filter((k) => k !== null)
      .map(({ privateKey, ...rest }: KeyData) => rest) as Key[],
  });
}
bootstrap();
export default function RootLayout() {
  return (
    <AlgorandProvider
      provider={
        new ReactNativeProvider(
          {
            id: "react-native-wallet",
            name: "React Native Wallet",
          },
          {
            logs: {},
            accounts: {
              store: accountsStore,
              hooks: accountHooks,
              keystore: {
                autoPopulate: true,
              },
            },
            keystore: {
              store: keyStore,
              hooks: keyStoreHooks,
              authentication: biometricOptions,
            },
          },
        )
      }
    >
      <Stack />
    </AlgorandProvider>
  );
}
