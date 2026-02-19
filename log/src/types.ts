import type { ExtensionOptions } from "@algorandfoundation/wallet-provider";

// TODO: Find out how everyone is using or developing logger extensions, then form an opinion on options.
export type LogStoreExtensionOptions = ExtensionOptions;
/**
 * The state of the log store.
 */
export interface LogStoreState {
	logs: LogMessage[];
}

/**
 * Represents a log message.
 */
export interface LogMessage {
	/**
	 * A unique identifier for the log entry.
	 */
	id: string;
	/**
	 * The context of the log entry (e.g., '@algorandfoundation/react-native-provider', '@algorandfoundation/key-store').
	 */
	context?: string;
	/**
	 * The timestamp of the log entry.
	 */
	timestamp: Date;
	/**
	 * The level of the log entry (e.g., 'info', 'warn', 'error').
	 */
	level: string;
	/**
	 * The message content.
	 */
	message: string;
	/**
	 * Additional metadata associated with the log entry.
	 */
	metadata?: Record<string, any>;
}

/**
 * Represents a log store interface for managing logs.
 */
export interface LogStoreExtension extends LogStoreState {
	/**
	 * An object that represents additional functionality provided by this extension.
	 */
	log: LogStoreApi;
}

/**
 * Interface representing a LogStore extension API.
 */
export interface LogStoreApi {
	info: (
		message: string,
		metadata?: Record<string, any>,
		context?: string,
	) => void;
	warn: (
		message: string,
		metadata?: Record<string, any>,
		context?: string,
	) => void;
	error: (
		message: string,
		metadata?: Record<string, any>,
		context?: string,
	) => void;
	debug: (
		message: string,
		metadata?: Record<string, any>,
		context?: string,
	) => void;
	trace: (
		message: string,
		metadata?: Record<string, any>,
		context?: string,
	) => void;
	/**
	 * Clears all log entries.
	 *
	 * @returns {Promise<void>}
	 */
	clear: () => void;
}
