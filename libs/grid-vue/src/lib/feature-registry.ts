/**
 * Feature Registry for @toolbox-web/grid-vue
 *
 * Delegates to the core registry at `@toolbox-web/grid/features/registry`.
 * This module re-exports core functions so existing feature modules continue
 * to work without changing their import paths.
 *
 * @example
 * ```typescript
 * // Import features you need (side-effect imports)
 * import '@toolbox-web/grid-vue/features/selection';
 * import '@toolbox-web/grid-vue/features/filtering';
 *
 * // Props work automatically - no async loading, no HTTP requests
 * <TbwGrid :selection="'range'" :filtering="{ debounceMs: 200 }" />
 * ```
 */

// Re-export core registry — all adapters share the same registry Map
export {
    clearFeatureRegistry,
    createPluginFromFeature,
    getFeatureFactory,
    getRegisteredFeatures,
    isFeatureRegistered,
    registerFeature
} from '@toolbox-web/grid/features/registry';

export type { PluginFactory } from '@toolbox-web/grid/features/registry';

/**
 * Feature names supported by the TbwGrid component, derived from the core
 * augmentable `FeatureConfig` interface. Stays in lockstep with core: any
 * feature that augments `FeatureConfig` (via `declare module '@toolbox-web/grid'`)
 * is automatically a member of this union, including third-party features.
 *
 * The `__brand` sentinel declared on core's `FeatureConfig` (to keep the
 * interface non-empty for excess-property checks) is filtered out — it is
 * not a real feature name.
 *
 * @since 0.1.0
 */
import type { FeatureConfig } from '@toolbox-web/grid/all';
// Bare side-effect import pulls every core feature's `_Augmentation` anchor
// type onto the type graph so vite-plugin-dts and typedoc see the
// `declare module` blocks that augment `FeatureConfig`. Without it,
// `keyof FeatureConfig` collapses (typedoc's entry-point program only loads
// transitively-imported feature modules) and feature names like `'filtering'`
// / `'groupingRows'` are rejected as not assignable to `FeatureName`.
// See `internal/feature-augmentations.ts`.
import './internal/feature-augmentations';
export type FeatureName = Exclude<keyof FeatureConfig, '__brand'>;
