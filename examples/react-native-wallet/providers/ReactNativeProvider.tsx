import {createContext, type ReactNode} from 'react';
import {Provider} from '@algorandfoundation/wallet-provider';

import {WithKeyStore} from "@algorandfoundation/react-native-keystore";
import {Account, AccountStoreApi, WithAccountStore} from "@algorandfoundation/accounts-store";
import type {KeyStoreAPI, Key} from "@algorandfoundation/keystore";
import {type LogMessage, WithLogStore, type LogStoreApi} from "@algorandfoundation/log-store";
import type {keyStoreHooks} from "@/stores/before-after";
import {WithAccountsKeystore} from "@algorandfoundation/accounts-keystore-extension";


export class ReactNativeProvider extends Provider<typeof ReactNativeProvider.EXTENSIONS> {
    static EXTENSIONS = [
        WithLogStore,
        WithKeyStore,
        WithAccountStore,
        WithAccountsKeystore
    ] as const

    keys!: Key[]
    accounts!: Account[]
    logs!: LogMessage[]
    status!: string

    account!: {
        store: AccountStoreApi
    }
    // The generic Keystore Interface
    key!: {
        store: KeyStoreAPI & {clear: () => Promise<void>, hooks: typeof keyStoreHooks}
    }
    log!: LogStoreApi
}

export const AlgorandContext = createContext<null | ReactNativeProvider>(null);

export interface AlgorandProviderProps {
    children: ReactNode
    provider: ReactNativeProvider
}
export function AlgorandProvider({ children, provider }: AlgorandProviderProps) {
    return (
        <AlgorandContext.Provider value={provider}>
            {children}
        </AlgorandContext.Provider>
    )
}
