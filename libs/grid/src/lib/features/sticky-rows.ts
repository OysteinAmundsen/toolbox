/**
 * Sticky Rows feature for @toolbox-web/grid
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid/features/sticky-rows';
 *
 * grid.gridConfig = { features: { stickyRows: { isSticky: 'isSection' } } };
 * ```
 */

import { StickyRowsPlugin, type StickyRowsConfig } from '../plugins/sticky-rows';
import { registerFeature } from './registry';

declare module '../core/types' {
  interface FeatureConfig {
    /** Pin selected data rows below the header as the user scrolls past them. */
    stickyRows?: StickyRowsConfig;
  }
}

registerFeature('stickyRows', (config) => {
  // `stickyRows` requires an `isSticky` value — `boolean` shorthand is not
  // meaningful. The TS type prevents `true`/`false` callers from compiling;
  // at runtime we coerce to a no-op predicate for safety.
  const options = (config as StickyRowsConfig | undefined) ?? { isSticky: () => false };
  return new StickyRowsPlugin(options);
});

/** @internal Type anchor — forces bundlers to preserve this module's FeatureConfig augmentation when re-exported. */
export type _Augmentation = true;
