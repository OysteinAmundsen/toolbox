/**
 * Child-component feature-detector registry — keyed by React component
 * `displayName`, each entry returns a partial feature-prop record that
 * `<DataGrid>` merges into its `createPluginsFromFeatures()` input.
 *
 * Each feature secondary entry (e.g. `@toolbox-web/grid-react/features/master-detail`,
 * `.../features/responsive`) registers under the displayName of its declarative
 * child component (`GridDetailPanel`, `GridResponsiveCard`) so the `<DataGrid>`
 * core no longer hard-codes which child components map to which features.
 *
 * Mirrors {@link registerPostMountRefresh}: same `register*(name, fn)` /
 * `notify`/`detect` / `clear*` shape; same Map-based replace-on-re-register
 * (HMR-friendly).
 *
 * @packageDocumentation
 * @internal
 */

import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';

/**
 * Detector callback: given the React element whose `displayName` matched the
 * registry key, return the partial feature-prop record to auto-enable the
 * corresponding plugin. Return `undefined` to skip.
 *
 * @typeParam TFeatures - Adapter `FeatureProps` shape.
 */
export type ChildFeatureDetector<TFeatures = Record<string, unknown>> = (
  element: ReactElement,
) => Partial<TFeatures> | undefined;

const childFeatureDetectors = new Map<string, ChildFeatureDetector>();

/**
 * Install a child-feature detector keyed by React `displayName`. Re-registering
 * the same displayName replaces the previous detector (HMR-friendly). Called
 * by feature secondary entries on import.
 *
 * @internal Plugin API
 */
export function registerChildFeatureDetector<TFeatures = Record<string, unknown>>(
  displayName: string,
  detector: ChildFeatureDetector<TFeatures>,
): void {
  childFeatureDetectors.set(displayName, detector as ChildFeatureDetector);
}

/**
 * Scan `children` and merge every matching detector's output into a single
 * partial feature-prop record. Later children override earlier ones for the
 * same feature key — same precedence the inline `detectChildComponentFeatures`
 * had before extraction.
 *
 * @internal `<DataGrid>` `featureProps` memo use only.
 */
export function detectChildFeatures<TFeatures = Record<string, unknown>>(children: ReactNode): Partial<TFeatures> {
  const features: Record<string, unknown> = {};
  if (childFeatureDetectors.size === 0) return features as Partial<TFeatures>;

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    // `child.type` is `string | ComponentType`; only component types carry a
    // `displayName`. Narrow out the string (intrinsic-tag) case before the
    // optional-chain read so `tsc --strict` (used by typedoc's program)
    // doesn't reject `.displayName` on the `string` branch.
    const type = child.type;
    const displayName = typeof type === 'string' ? undefined : (type as { displayName?: string } | null)?.displayName;
    if (typeof displayName !== 'string') return;
    const detector = childFeatureDetectors.get(displayName);
    if (!detector) return;
    const detected = detector(child);
    if (detected) Object.assign(features, detected);
  });

  return features as Partial<TFeatures>;
}

/**
 * Test-only: clear all registered detectors so specs assert in isolation.
 *
 * @internal
 */
export function clearChildFeatureDetectors(): void {
  childFeatureDetectors.clear();
}
