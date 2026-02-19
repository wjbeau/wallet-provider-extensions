import React, {createContext, type ReactNode} from 'react';
import {Provider} from '@algorandfoundation/wallet-provider';

import {WithKeyStore} from "@algorandfoundation/react-native-keystore";
import type {KeyStoreAPI, Key} from "@algorandfoundation/keystore";
import {LogMessage, WithLogStore, LogStoreApi} from "@algorandfoundation/log-store";
import {keyStoreHooks} from "@/stores/before-after";


export class ReactNativeProvider extends Provider<typeof ReactNativeProvider.EXTENSIONS> {
    static EXTENSIONS = [
        WithLogStore,
        WithKeyStore,
    ] as const

    logs!: LogMessage[]
    keys!: Key[]

    status!: string
    // The generic Keystore Interface
    keystore!: KeyStoreAPI & {clear: () => Promise<void>, hooks: typeof keyStoreHooks}
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