// @internal Types-only barrel: pulls core feature modules onto ng-packagr's type
// graph so FeatureConfig augmentations merge before emit. See
// .github/knowledge/adapters-angular.md ("FeatureName derivation"). Use `//` not
// `/** */` — terser preserves JSDoc in the fesm bundle (~1.5 KiB cost).
//
// Each line re-exports the core feature's `_Augmentation` anchor type under a
// unique local name. This is functionally equivalent to
// `import type {} from '@toolbox-web/grid/features/<name>'` but survives
// Prettier / organize-imports, which strip empty-brace imports as unused.
// The re-exports are type-only (zero runtime cost) and stay internal because
// `feature-registry.ts` consumes this file with a bare side-effect import
// (`import './internal/feature-augmentations'`), not a re-export.
// Append a new line whenever a core feature is added.

export type { _Augmentation as _ClipboardAugmentation } from '@toolbox-web/grid/features/clipboard';
export type { _Augmentation as _ColumnVirtualizationAugmentation } from '@toolbox-web/grid/features/column-virtualization';
export type { _Augmentation as _ContextMenuAugmentation } from '@toolbox-web/grid/features/context-menu';
export type { _Augmentation as _EditingAugmentation } from '@toolbox-web/grid/features/editing';
export type { _Augmentation as _ExportAugmentation } from '@toolbox-web/grid/features/export';
export type { _Augmentation as _FilteringAugmentation } from '@toolbox-web/grid/features/filtering';
export type { _Augmentation as _GroupingColumnsAugmentation } from '@toolbox-web/grid/features/grouping-columns';
export type { _Augmentation as _GroupingRowsAugmentation } from '@toolbox-web/grid/features/grouping-rows';
export type { _Augmentation as _MasterDetailAugmentation } from '@toolbox-web/grid/features/master-detail';
export type { _Augmentation as _MultiSortAugmentation } from '@toolbox-web/grid/features/multi-sort';
export type { _Augmentation as _PinnedColumnsAugmentation } from '@toolbox-web/grid/features/pinned-columns';
export type { _Augmentation as _PinnedRowsAugmentation } from '@toolbox-web/grid/features/pinned-rows';
export type { _Augmentation as _PivotAugmentation } from '@toolbox-web/grid/features/pivot';
export type { _Augmentation as _PrintAugmentation } from '@toolbox-web/grid/features/print';
export type { _Augmentation as _ReorderColumnsAugmentation } from '@toolbox-web/grid/features/reorder-columns';
export type { _Augmentation as _ReorderRowsAugmentation } from '@toolbox-web/grid/features/reorder-rows';
export type { _Augmentation as _ResponsiveAugmentation } from '@toolbox-web/grid/features/responsive';
export type { _Augmentation as _RowDragDropAugmentation } from '@toolbox-web/grid/features/row-drag-drop';
export type { _Augmentation as _SelectionAugmentation } from '@toolbox-web/grid/features/selection';
export type { _Augmentation as _ServerSideAugmentation } from '@toolbox-web/grid/features/server-side';
export type { _Augmentation as _ShellAugmentation } from '@toolbox-web/grid/features/shell';
export type { _Augmentation as _StickyRowsAugmentation } from '@toolbox-web/grid/features/sticky-rows';
export type { _Augmentation as _TooltipAugmentation } from '@toolbox-web/grid/features/tooltip';
export type { _Augmentation as _TreeAugmentation } from '@toolbox-web/grid/features/tree';
export type { _Augmentation as _UndoRedoAugmentation } from '@toolbox-web/grid/features/undo-redo';
export type { _Augmentation as _VisibilityAugmentation } from '@toolbox-web/grid/features/visibility';
