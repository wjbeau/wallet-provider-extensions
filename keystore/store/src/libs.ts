import {XHDWalletAPI} from "@algorandfoundation/xhd-wallet-api";
import {DeterministicP256} from "@algorandfoundation/dp256";

export const xhd: XHDWalletAPI = new XHDWalletAPI();
export const dp256: DeterministicP256 = new DeterministicP256();