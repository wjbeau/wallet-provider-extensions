import { XHDKeyStoreBackend } from "./backend/index.ts";
import {
	InMemoryAuditStorage,
	InMemoryKeyStorage,
	InMemorySeedStorage,
} from "./storage/index.ts";
import { runKeyStoreBackendTests } from "./testing/index.ts";

runKeyStoreBackendTests(
	() =>
		new XHDKeyStoreBackend({
			keyStorage: new InMemoryKeyStorage(),
			seedStorage: new InMemorySeedStorage(),
			auditStorage: new InMemoryAuditStorage(),
		}),
);
