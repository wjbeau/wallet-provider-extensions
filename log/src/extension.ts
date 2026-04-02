// Core Dependencies
import type { Extension } from "@algorandfoundation/wallet-provider";
import { Store } from "@tanstack/store";

// Store Mutations
import { addLog, clearLogs } from "./store.ts";

// Interface Types
import type { LogStoreExtension, LogStoreState } from "./types.ts";

// Store Instance
export const logsStore: Store<LogStoreState, (cb: LogStoreState) => LogStoreState> =
  new Store<LogStoreState>({
    logs: [],
  });

/**
 * Generates a cryptographically secure random ID (hex string)
 * Uses the Web Crypto API's getRandomValues for secure randomness
 */
export function generateId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const WithLogStore: Extension<LogStoreExtension> = () => {
  return {
    get logs() {
      return logsStore.state.logs;
    },
    log: {
      info(message: string, metadata: Record<string, unknown> = {}, context?: string) {
        addLog({
          store: logsStore,
          log: {
            id: generateId(),
            level: "info",
            context: context || "",
            timestamp: new Date(),
            message,
          },
        });
        console.info((context ? `[${context}] ` : "") + message, metadata);
      },
      warn(message: string, metadata: Record<string, unknown> = {}, context?: string) {
        addLog({
          store: logsStore,
          log: {
            id: generateId(),
            level: "warn",
            context: context || "",
            timestamp: new Date(),
            message,
          },
        });
        console.warn((context ? `[${context}] ` : "") + message, metadata);
      },
      error(message: string, metadata: Record<string, unknown> = {}, context?: string) {
        addLog({
          store: logsStore,
          log: {
            id: generateId(),
            level: "error",
            context: context || "",
            timestamp: new Date(),
            message,
          },
        });
        console.error((context ? `[${context}] ` : "") + message, metadata);
      },
      debug(message: string, metadata: Record<string, unknown> = {}, context?: string) {
        addLog({
          store: logsStore,
          log: {
            id: generateId(),
            level: "debug",
            context: context || "",
            timestamp: new Date(),
            message,
          },
        });
        console.info((context ? `[${context}] ` : "") + message, metadata);
      },
      trace(message: string, metadata: Record<string, unknown> = {}, context?: string) {
        addLog({
          store: logsStore,
          log: {
            id: generateId(),
            level: "trace",
            context: context || "",
            timestamp: new Date(),
            message,
          },
        });
        console.trace((context ? `[${context}] ` : "") + message, metadata);
      },
      clear() {
        clearLogs({ store: logsStore });
      },
    },
  } as LogStoreExtension;
};
