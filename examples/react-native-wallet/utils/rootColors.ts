/**
 * Shared hierarchical color palette and helpers used to color-code keys,
 * accounts, and identities by the seed/root key they descend from.
 *
 * The same seed (or top-most root key) always resolves to the same color,
 * so derived keys, accounts, and identities visually inherit their parent's
 * color across every page.
 */

export const ROOT_COLORS = [
  "#007AFF",
  "#34C759",
  "#5856D6",
  "#AF52DE",
  "#FF9500",
  "#FF3B30",
  "#FFCC00",
  "#5AC8FA",
] as const;

export const FALLBACK_COLOR = "#8E8E93";

interface KeyLike {
  id: string;
  type?: string;
  metadata?: Record<string, any> | undefined;
}

/**
 * Walk up the parent chain for a key to find the top-most ancestor's id
 * (usually a seed). Falls back to the key's own id when there is no parent.
 */
export function getRootAncestorId(key: KeyLike, keys: KeyLike[]): string {
  const byId = new Map(keys.map((k) => [k.id, k] as const));
  let current: KeyLike | undefined = key;
  const seen = new Set<string>();
  while (current) {
    if (seen.has(current.id)) break; // cycle guard
    seen.add(current.id);
    const parentId =
      (current.metadata?.parentKeyId as string | undefined) ??
      (current.metadata?.rootKeyId as string | undefined) ??
      (current.metadata?.parentId as string | undefined);
    if (!parentId) return current.id;
    const next = byId.get(parentId);
    if (!next) return parentId; // parent not in store, but use its id for stable coloring
    current = next;
  }
  return key.id;
}

/**
 * Deterministically pick a color from `ROOT_COLORS` for the given id.
 */
export function colorForId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  return ROOT_COLORS[Math.abs(hash) % ROOT_COLORS.length];
}

/**
 * Build a `keyId -> color` map for every key, coloring each by the
 * top-most ancestor (seed) it descends from.
 */
export function buildKeyColorMap(keys: KeyLike[]): Record<string, string> {
  return keys.reduce<Record<string, string>>((acc, k) => {
    const rootId = getRootAncestorId(k, keys);
    acc[k.id] = colorForId(rootId);
    return acc;
  }, {});
}

/**
 * Look up the hierarchical color for an arbitrary `keyId`. Returns a neutral
 * fallback color when the key is unknown.
 */
export function colorForKeyId(
  keyId: string | undefined | null,
  colorMap: Record<string, string>,
): string {
  if (!keyId) return FALLBACK_COLOR;
  return colorMap[keyId] ?? FALLBACK_COLOR;
}
