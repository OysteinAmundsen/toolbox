/**
 * Row Reorder feature (deprecated alias for `rowDragDrop`).
 *
 * `RowReorderPlugin` is now an alias of `RowDragDropPlugin`. This feature
 * module forwards to the new plugin so existing
 * `import '@toolbox-web/grid/features/reorder-rows'` calls keep working.
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid/features/reorder-rows';
 *
 * grid.gridConfig = { features: { reorderRows: true } };
 * ```
 *
 * @deprecated Use `@toolbox-web/grid/features/row-drag-drop` and the
 * `rowDragDrop` feature key. This module will be removed in V3.
 */

import { RowDragDropPlugin, type RowDragDropConfig } from '../plugins/row-drag-drop';
import { registerFeature } from './registry';

declare module '../core/types' {
  interface FeatureConfig {
    /** @deprecated Use `rowDragDrop`. Forwarded to the same underlying plugin. */
    reorderRows?: boolean | RowDragDropConfig;
  }
}

const factory = (config: unknown) => {
  if (config === true) return new RowDragDropPlugin();
  return new RowDragDropPlugin((config as RowDragDropConfig) ?? undefined);
};

registerFeature('reorderRows', factory);

/** @internal Type anchor — forces bundlers to preserve this module's FeatureConfig augmentation when re-exported. */
export type _Augmentation = true;
