/**
 * Feature prop-key registry — the canonical list of `FeatureProps` keys that
 * `<TbwGrid>` extracts from its declared `props` and feeds to
 * `createPluginsFromFeatures`. Pre-populated at module load with every
 * built-in feature name so existing shell behaviour is unchanged; third-party
 * features that augment the core `FeatureConfig` can call
 * `registerFeaturePropKey` to make `<TbwGrid>` recognise their prop without
 * forking the shell.
 *
 * Mirrors the bridge-registry shape (insertion-ordered, idempotent
 * re-registration) of `registerPostMountRefresh` and
 * `registerEditorMountHook`, and keeps API parity with the React adapter's
 * `feature-prop-keys.ts`.
 *
 * @packageDocumentation
 * @internal
 */

import type { FeatureConfig } from '@toolbox-web/grid/all';

import type { FeatureName } from './feature-registry';

/**
 * Insertion-ordered set of registered feature prop keys. Re-adding an
 * existing name is a no-op — same HMR semantics as the other bridge
 * registries.
 */
const featurePropKeys = new Set<FeatureName>();

/**
 * Register a feature prop name as a recognised feature key. Called by
 * built-in pre-registration (this module's bottom) and by third-party feature
 * secondary entries that augment `FeatureConfig`.
 *
 * @internal Plugin API
 */
export function registerFeaturePropKey(name: FeatureName): void {
  featurePropKeys.add(name);
}

/**
 * Snapshot of all currently-registered feature prop keys, in registration
 * order. Returned as a frozen array so callers cannot mutate the registry by
 * reference.
 *
 * @internal `<TbwGrid>` extract/sync use only.
 */
export function getFeaturePropKeys(): readonly FeatureName[] {
  return Object.freeze(Array.from(featurePropKeys));
}

/**
 * Test-only: clear all registered keys. Lets specs assert pre-registration
 * behaviour in isolation. Production code never calls this.
 *
 * @internal
 */
export function clearFeaturePropKeys(): void {
  featurePropKeys.clear();
}

// Pre-register all built-in feature prop names at module load (gh #356 §7:
// "registry pre-populates from core; side-effect imports augment for
// third-party"). Must stay in sync with the props declared by `TbwGrid.vue`
// — any feature whose prop name is declared on the component should appear
// here so `createFeaturePlugins` will iterate it.
const BUILTIN_FEATURE_PROP_KEYS: readonly FeatureName[] = [
  'selection',
  'editing',
  'clipboard',
  'contextMenu',
  'multiSort',
  'filtering',
  'reorderColumns',
  'visibility',
  'pinnedColumns',
  'groupingColumns',
  'columnVirtualization',
  // @deprecated v1.x — remove in `@toolbox-web/grid-vue` 2.0.0 (gh #262 / #263). Superseded by `rowDragDrop`.
  'reorderRows',
  'groupingRows',
  'pinnedRows',
  'tree',
  'masterDetail',
  'responsive',
  'undoRedo',
  'export',
  'print',
  'pivot',
  'serverSide',
  'tooltip',
];

for (const key of BUILTIN_FEATURE_PROP_KEYS) {
  registerFeaturePropKey(key);
}

// #region Drift guard

/**
 * Compile-time check that `BUILTIN_FEATURE_PROP_KEYS` covers every core
 * `FeatureConfig` key. Complements `_AssertFeaturePropsCoverCore` in
 * `feature-props.ts`, which guards the reverse direction
 * (`FeatureProps` ⊇ `FeatureConfig`).
 *
 * Together the two guards close the drift door: adding a new core feature
 * forces both a `FeatureProps` field AND a `BUILTIN_FEATURE_PROP_KEYS`
 * entry, otherwise the build fails.
 *
 * Known pre-existing gaps (intentional, tracked for v3): `stickyRows`
 * and `rowDragDrop` are not yet wired through Vue's `TbwGrid.vue` prop
 * declarations — see the Phase 4 DECIDED entry in
 * `.github/knowledge/adapters.md`. Listed in the allowlist below until
 * the gaps are closed.
 */
type _KnownBuiltinGaps = 'stickyRows' | 'rowDragDrop';
type _MissingFromBuiltin = Exclude<
  keyof FeatureConfig,
  (typeof BUILTIN_FEATURE_PROP_KEYS)[number] | '__brand' | _KnownBuiltinGaps
>;
type _AssertBuiltinCoversCore = [_MissingFromBuiltin] extends [never]
  ? true
  : ['BUILTIN_FEATURE_PROP_KEYS is missing core feature keys:', _MissingFromBuiltin];
const _builtinCoversCore: _AssertBuiltinCoversCore = true;
void _builtinCoversCore;

// #endregion
