import {useContext, useEffect} from "react";
import {useStore} from "@tanstack/react-store";

import {AlgorandContext} from "@/providers/ReactNativeProvider";
import {keyStore} from "@/stores/keystore";
import {localStorage} from "@/stores/mmkv-local";
import {useMMKVString} from "react-native-mmkv";
export function useProvider(){
    const provider = useContext(AlgorandContext);
    if(provider === null) throw new Error('No Provider Found')

    // Hydrate the store in the context (React)
    const keys = useStore(keyStore, (state)=>state.keys);
    //const status = useStore(keyStore, (state)=>state.status)

    const [status] = useMMKVString('status', localStorage);

    console.log(status)
    //console.log(status2)

    return {...provider, keys, status};
}