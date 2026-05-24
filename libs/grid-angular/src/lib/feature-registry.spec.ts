/**
 * Type-test spec for `feature-registry.ts`.
 *
 * The Angular adapter currently keeps `FeatureName` as a hand-listed union
 * because ng-packagr's partial-compilation cannot see the
 * `FeatureConfig` augmentations from `@toolbox-web/grid/features/*` (the
 * Angular adapter does not side-effect-import those modules). Switching to
 * `keyof FeatureConfig` is deferred until that gap is closed — see
 * gh #356 phase 1 notes in `feature-registry.ts`.
 *
 * This spec enforces the strict additive contract (gh #356, §7): whatever
 * shape `FeatureName` takes in the future, it MUST stay a superset of every
 * name the adapter previously accepted.
 */

import { describe, expect, it } from 'vitest';
import type { FeatureName } from './feature-registry';

// ───────────────────────────────────────────────────────────────────────────
// Strict additive contract (gh #356, §7): every prior FeatureName MUST still
// be assignable to the new `FeatureName = keyof FeatureConfig`.
// ───────────────────────────────────────────────────────────────────────────
type _PriorFeatureNames =
  | 'selection'
  | 'editing'
  | 'clipboard'
  | 'contextMenu'
  | 'multiSort'
  | 'filtering'
  | 'reorderColumns'
  | 'visibility'
  | 'pinnedColumns'
  | 'groupingColumns'
  | 'columnVirtualization'
  | 'reorderRows'
  | 'rowDragDrop'
  | 'groupingRows'
  | 'pinnedRows'
  | 'tree'
  | 'masterDetail'
  | 'responsive'
  | 'undoRedo'
  | 'export'
  | 'print'
  | 'pivot'
  | 'serverSide'
  | 'stickyRows'
  | 'tooltip';
type _FeatureNameSupersetCheck = Exclude<_PriorFeatureNames, FeatureName> extends never ? true : false;
const _featureNameSupersetCheck: _FeatureNameSupersetCheck = true;
void _featureNameSupersetCheck;

describe('feature-registry (grid-angular)', () => {
  it('preserves every previously-accepted FeatureName (compile-time check)', () => {
    // The Exclude<_PriorFeatureNames, FeatureName> assertion above is the
    // real test; this runtime case exists so the spec file isn't empty.
    expect(_featureNameSupersetCheck).toBe(true);
  });
});
