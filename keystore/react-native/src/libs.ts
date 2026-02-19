import { DeterministicP256 } from "@algorandfoundation/dp256";
import { XHDWalletAPI } from "@algorandfoundation/xhd-wallet-api";

//TODO: make library pure and remove this shim
export const xhd: XHDWalletAPI = new XHDWalletAPI();
//TODO: make library pure and remove this shim
export const dp256: DeterministicP256 = new DeterministicP256();
