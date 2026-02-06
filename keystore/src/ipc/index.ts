export type MethodName =
	| "generate"
	| "import"
	| "export"
	| "remove"
	| "list"
	| "getMetadata"
	| "sign"
	| "verify"
	| "encryptWithKey"
	| "decryptWithKey"
	| "deriveSharedSecret"
	| "importSeed"
	| "deriveFromSeed"
	| "encryptData"
	| "decryptData"
	| "logAuditEvent"
	| "getAuditLogs"
	| "batchSign";

export interface IPCRequest {
	jsonrpc: "2.0";
	id: string | number;
	method: MethodName;
	params: unknown[];
}

export interface IPCResponse {
	jsonrpc: "2.0";
	id: string | number;
	result?: unknown;
	error?: {
		code: number;
		message: string;
		data?: unknown;
	};
}
