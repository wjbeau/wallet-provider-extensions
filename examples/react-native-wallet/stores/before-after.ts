import Hook from "before-after-hook";

export const keyStoreHooks = new Hook.Collection();
export const accountHooks = new Hook.Collection();

/**
 * Log any error thrown by `key.store.generate(...)` (the `"generate"` hook)
 * to the console and re-throw it so callers can still react. The error hook
 * runs after `before` and the wrapped method, but before `after`, and is the
 * documented way to intercept rejections in `before-after-hook`.
 *
 * @example
 * ```typescript
 * // Triggered on any failure inside `keyStoreHooks("generate", ...)`:
 * // [keystore] generate failed { type: "ed25519" } Error: ...
 * ```
 */
keyStoreHooks.error("generate", (error: unknown, options: unknown) => {
  // eslint-disable-next-line no-console
  console.error("[keystore] generate failed", options, error);
  throw error;
});
