import type { KeyStoreOptions } from "@algorandfoundation/keystore";
export interface ReactKeystoreOptions extends KeyStoreOptions {
  keystore: KeyStoreOptions["keystore"] & {
    authentication?: AuthenticationOptions;
  };
}

export type AuthenticationOptions = {
  biometrics?: boolean;
  prompt?:
    | string
    | {
        title?: string;
        subtitle?: string;
        description?: string;
        cancel?: string;
      };
};
