/**
 * Feature Registry for @toolbox-web/grid-angular
 *
 * Delegates to the core registry at `@toolbox-web/grid/features/registry`.
 * This module re-exports core functions so existing feature modules continue
 * to work without changing their import paths.
 *
 * @example
 * ```typescript
 * // Import features you need (side-effect imports)
 * import '@toolbox-web/grid-angular/features/selection';
 * import '@toolbox-web/grid-angular/features/filtering';
 *
 * // Inputs work automatically - no async loading, no HTTP requests
 * <tbw-grid [selection]="'range'" [filtering]="{ debounceMs: 200 }" />
 * ```
 */

// Re-export core registry — all adapters share the same registry Map
export {
  clearFeatureRegistry,
  createPluginFromFeature,
  getFeatureFactory,
  getRegisteredFeatures,
  isFeatureRegistered,
  registerFeature,
} from '@toolbox-web/grid/features/registry';

export type { PluginFactory } from '@toolbox-web/grid/features/registry';

import type { FeatureConfig } from '@toolbox-web/grid';
// Anchor every core feature module on the type graph so its `FeatureConfig`
// augmentation is visible to ng-packagr's partial compilation when emitting
// the `keyof FeatureConfig` below — see `internal/feature-augmentations.ts`
// header for the full rationale (gh #356 phase 6).
import './internal/feature-augmentations';

/**
 * Feature names supported by the Grid directive, derived from the core
 * augmentable `FeatureConfig` interface — stays in lockstep with core: any
 * feature that augments `FeatureConfig` (via `declare module
 * '@toolbox-web/grid'`) is automatically a member of this union, including
 * third-party features.
 *
 * The `__brand` sentinel declared on core's `FeatureConfig` (to keep the
 * interface non-empty for excess-property checks) is filtered out — it is
 * not a real feature name.
 *
 * The `feature-registry.spec.ts` superset check enforces the strict
 * additive contract (gh #356 §7): every previously-accepted name must stay
 * assignable to the derived union.
 *
 * @since 0.6.0
 */
export type FeatureName = Exclude<keyof FeatureConfig, '__brand'>;
