/**
 * @module default
 * @packageDocumentation
 * 
 * @todo Deprecate the default entry point with `export *` is deprecated to improve tree-shaking and maintainability.
 * 
 * While this entry point still works for backward compatibility, it is recommended to 
 * migrate to named exports or use specific sub-paths:
 * - `@algorandfoundation/keystore/extension`
 * - `@algorandfoundation/keystore/types`
 * - `@algorandfoundation/keystore/backend`
 * - `@algorandfoundation/keystore/storage`
 * 
 * Migration example:
 * ```typescript
 * // From
 * import { WithKeyStore } from "@algorandfoundation/keystore";
 * 
 * // To
 * import { WithKeyStore } from "@algorandfoundation/keystore/extension";
 * ```
 */

export * from "./backend/xhd.ts";
export * from "./ipc/index.ts";
export * from "./storage/index.ts";
export * from "./testing/index.ts";
export * from "./types/index.ts";
export * from "./keystore.ts";
