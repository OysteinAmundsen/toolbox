/**
 * Type-test spec for `feature-registry.ts`.
 *
 * As of gh #356 phase 6 the Angular adapter's `FeatureName` is derived from
 * `keyof FeatureConfig` (matching React/Vue). ng-packagr now sees every
 * `FeatureConfig` augmentation via the side-effect-free
 * `internal/feature-augmentations.ts` barrel.
 *
 * This spec enforces the strict additive contract (gh #356 §7): the
 * derived `FeatureName` MUST stay a superset of every name the adapter
 * previously accepted, so any future change that drops a feature module
 * from `internal/feature-augmentations.ts` (or removes an augmentation
 * from core) fails compilation here.
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
