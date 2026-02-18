import {KeyStoreError} from "@algorandfoundation/keystore";

/**
 * Decoding failed.
 */
export class DecodingError extends Error {
    constructor(message: string, cause?: Error) {
        super(message);
        this.name = "DecodingError";
        if (cause) {
            this.cause = cause;
        }
        Object.setPrototypeOf(this, KeyStoreError.prototype);
    }
}

export class EncodingError extends Error {
    constructor(message: string, cause?: Error) {
        super(message);
        this.name = "EncodingError";
        if (cause) {
            this.cause = cause;
        }
        Object.setPrototypeOf(this, KeyStoreError.prototype);
    }
}

export class UnlockingError extends Error {
    constructor(message: string, cause?: Error) {
        super(message);
        this.name = "UnlockingError";
        if (cause) {
            this.cause = cause;
        }
        Object.setPrototypeOf(this, KeyStoreError.prototype);
    }
}
