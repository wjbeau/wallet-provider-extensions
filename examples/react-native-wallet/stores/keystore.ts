import { Store } from "@tanstack/react-store";
import { KeyStoreState } from "@wjbeau/keystore";

export const keyStore = new Store<KeyStoreState>({
  keys: [],
  status: "idle",
});
