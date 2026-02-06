import { runKeyStoreBackendTests } from "./testing/index.ts";
import { XHDKeyStoreBackend } from "./xhd-backend.ts";

runKeyStoreBackendTests(() => new XHDKeyStoreBackend());
