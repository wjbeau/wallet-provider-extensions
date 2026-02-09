import {
	InMemoryAuditStorage,
	InMemoryKeyStorage,
	InMemorySeedStorage,
} from "./storage.ts";
import { runKeyStoreBackendTests } from "./testing/index.ts";
import { XHDKeyStoreBackend } from "./xhd-backend.ts";

runKeyStoreBackendTests(
	() =>
		new XHDKeyStoreBackend({
			keyStorage: new InMemoryKeyStorage(),
			seedStorage: new InMemorySeedStorage(),
			auditStorage: new InMemoryAuditStorage(),
		}),
);
