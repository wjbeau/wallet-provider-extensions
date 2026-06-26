import type { AccountStoreState } from "@wjbeau/accounts-store";
import { Store } from "@tanstack/react-store";
import { HARDCODED_WATCHED_ADDRESS } from "@/extensions/example";
import { AppAccount } from "@/providers/ReactNativeProvider";

export const accountsStore = new Store<AccountStoreState<AppAccount>>({
  accounts: [
    {
      address: HARDCODED_WATCHED_ADDRESS,
      name: "Hardcoded Watched Account",
      type: "watched",
      balance: 1000000n,
      assets: [],
    },
  ],
});
