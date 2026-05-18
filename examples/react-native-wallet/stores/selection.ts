import { Store } from "@tanstack/store";

/**
 * UI selection state for the example wallet app.
 *
 * Holds lightweight, transient choices the user has made in the UI
 * (e.g. which seed or root key is currently "selected" when generating
 * derived keys, accounts, or identities). This is intentionally separate
 * from the domain stores (`keystore`, `accounts`, `identities`) which
 * remain the single source of truth for their respective data.
 */
export interface SelectionState {
  /** ID of the currently selected seed key, if any. */
  selectedSeedId: string | null;
  /** ID of the currently selected root key, if any. */
  selectedRootKeyId: string | null;
}

/**
 * Reactive store of UI selection state.
 *
 * @example
 * ```tsx
 * import { selectionStore, setSelectedSeedId } from "@/stores/selection";
 * setSelectedSeedId("seed-id");
 * ```
 */
export const selectionStore = new Store<SelectionState>({
  selectedSeedId: null,
  selectedRootKeyId: null,
});

/**
 * Set the currently selected seed ID (or `null` to clear).
 */
export function setSelectedSeedId(id: string | null) {
  selectionStore.setState((state) => ({ ...state, selectedSeedId: id }));
}

/**
 * Set the currently selected root key ID (or `null` to clear).
 */
export function setSelectedRootKeyId(id: string | null) {
  selectionStore.setState((state) => ({ ...state, selectedRootKeyId: id }));
}

/**
 * Reset all selections back to their initial empty state.
 */
export function clearSelection() {
  selectionStore.setState(() => ({
    selectedSeedId: null,
    selectedRootKeyId: null,
  }));
}
