/**
 * Feature prop-key registry — the canonical list of `FeatureProps` keys that
 * `<DataGrid>` extracts from `...rest` and feeds to
 * `createPluginsFromFeatures`. Pre-populated at module load with every built-in
 * feature name so existing shell behaviour is unchanged; third-party features
 * that augment the core `FeatureConfig` can call `registerFeaturePropKey` to
 * make `<DataGrid>` recognise their prop without forking the shell.
 *
 * Mirrors the `Map<string, T>` shape of the other adapter bridge registries
 * (`registerEditorMountHook`, `registerPostMountRefresh`,
 * `registerChildFeatureDetector`) and keeps API parity with the Vue adapter's
 * `feature-prop-keys.ts`.
 *
 * @packageDocumentation
 * @internal
 */

import type { FeatureConfig } from '@toolbox-web/grid/all';

import type { FeatureName } from './feature-registry';

/**
 * Insertion-ordered set of registered feature prop keys. Map-based (value
 * unused) so re-registering with the same name is a no-op replace rather than
 * a duplicate entry — same HMR semantics as the other bridge registries.
 */
const featurePropKeys = new Map<FeatureName, true>();

/**
 * Register a feature prop name as a recognised `FeatureProps` key. Called by
 * built-in pre-registration (this module's bottom) and by third-party feature
 * secondary entries that augment `FeatureConfig`.
 *
 * @internal Plugin API
 */
export function registerFeaturePropKey(name: FeatureName): void {
  featurePropKeys.set(name, true);
}

/**
 * Snapshot of all currently-registered feature prop keys, in registration
 * order. Returned as a frozen array so callers cannot mutate the registry by
 * reference.
 *
 * @internal `<DataGrid>` extract/sync use only.
 */
export function getFeaturePropKeys(): readonly FeatureName[] {
  return Object.freeze(Array.from(featurePropKeys.keys()));
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
// third-party"). The list must stay in sync with the `FeatureProps`
// interface in `feature-props.ts`; the `_AssertFeaturePropsCoverCore` type
// check in that file guarantees `FeatureProps` covers every core
// `FeatureConfig` key, so any new core feature must also be added here.
const BUILTIN_FEATURE_PROP_KEYS: readonly FeatureName[] = [
  'selection',
  'editing',
  'filtering',
  'multiSort',
  'clipboard',
  'contextMenu',
  'reorderColumns',
  'reorderRows',
  'rowDragDrop',
  'visibility',
  'undoRedo',
  'tree',
  'groupingRows',
  'groupingColumns',
  'pinnedColumns',
  'pinnedRows',
  'masterDetail',
  'responsive',
  'columnVirtualization',
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
 * Known pre-existing gap (intentional, tracked for v3): `stickyRows` is
 * declared on `FeatureProps` but missing from BUILTIN — see the Phase 4
 * DECIDED entry in `.github/knowledge/adapters.md`. Listed in the
 * allowlist below until the gap is closed.
 */
type _KnownBuiltinGaps = 'stickyRows';
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
