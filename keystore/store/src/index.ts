/**
 * @module default
 * @packageDocumentation
 *
 * While this entry point still works for backward compatibility, it is recommended to
 * migrate to named exports or use specific sub-paths:
 * - `@wjbeau/keystore/types`
 * - `@wjbeau/keystore/errors`
 *
 * Migration example:
 * ```typescript
 * // From
 * import { KeyStoreAPI } from "@wjbeau/keystore";
 *
 * // To
 * import { KeyStoreAPI } from "@wjbeau/keystore/types";
 * ```
 */

export * from "./crypto.ts";
export * from "./encoding.ts";
export * from "./errors.ts";
export * from "./generate.ts";
export * from "./sign.ts";
export * from "./store.ts";
export * from "./types/index.ts";
export * from "./verify.ts";
