/**
 * Feature config preprocessor registry — per-feature transforms that run
 * before a feature config is handed to the core plugin factory. Lets a
 * feature secondary entry rewrite framework-specific values embedded in its
 * config (e.g. React components passed where the core plugin expects a
 * renderer function).
 *
 * Mirrors the Angular adapter's `registerFeatureConfigPreprocessor` /
 * `getFeatureConfigPreprocessor` registry in
 * `internal/feature-extensions.ts` so cross-adapter API parity (gh #356 §8)
 * holds for third-party features.
 *
 * The React `<DataGrid>` shell does NOT currently invoke this registry —
 * React feature configs flow directly through `createPluginsFromFeatures`
 * and JSX/component values are already framework-shaped. Shipping the
 * surface now means third-party features can target a stable API across
 * all three adapters today, and the shell can opt-in to invoking it later
 * without an API break (matches the Phase 3 `child-feature-detector`
 * ship-without-caller approach for Vue).
 *
 * @packageDocumentation
 * @internal
 */

import type { FeatureName } from './feature-registry';
import type { GridAdapter } from './react-grid-adapter';

/**
 * A feature config preprocessor receives the user-supplied config for a
 * specific feature prop and returns a transformed config that the core
 * plugin factory can consume.
 *
 * Receives the typed config and the adapter instance. Returning the same
 * reference is fine — preprocessors typically clone-and-augment.
 *
 * @internal Plugin API
 */
export type FeatureConfigPreprocessor = (config: unknown, adapter: GridAdapter) => unknown;

const featureConfigPreprocessors = new Map<FeatureName, FeatureConfigPreprocessor>();

/**
 * Register a feature config preprocessor keyed by feature name. Re-registering
 * with the same name replaces the previous preprocessor (HMR-friendly). Called
 * by feature secondary entries on import.
 *
 * @internal Plugin API
 */
export function registerFeatureConfigPreprocessor(name: FeatureName, fn: FeatureConfigPreprocessor): void {
  featureConfigPreprocessors.set(name, fn);
}

/**
 * Look up the preprocessor for a feature, if any. Returns `undefined` when
 * the feature is not imported (or has not registered a preprocessor).
 *
 * @internal
 */
export function getFeatureConfigPreprocessor(name: FeatureName): FeatureConfigPreprocessor | undefined {
  return featureConfigPreprocessors.get(name);
}

/**
 * Test-only: clear all registered preprocessors. Lets specs assert in
 * isolation. Production code never calls this.
 *
 * @internal
 */
export function clearFeatureConfigPreprocessors(): void {
  featureConfigPreprocessors.clear();
}
