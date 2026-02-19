import {useContext, useEffect} from "react";
import {useStore} from "@tanstack/react-store";

import {AlgorandContext} from "@/providers/ReactNativeProvider";
import {keyStore} from "@/stores/keystore";

export function useProvider(){
    const provider = useContext(AlgorandContext);
    if(provider === null) throw new Error('No Provider Found')

    useEffect(() => {
        function beforeGenerate(){
            console.log('Hooking into before generate')
        }
        provider.keystore.hooks.before('generate', beforeGenerate)

        return ()=> {
            provider.keystore.hooks.remove('generate', beforeGenerate)
        }
    }, []);

    // Hydrate the store in the context (React)
    const keys = useStore(keyStore, (state)=>state.keys);
    const status = useStore(keyStore, (state)=>state.status)

    return {...provider, keys, status};
}