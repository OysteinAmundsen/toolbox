/**
 * Row drag & drop feature for @toolbox-web/grid-angular
 *
 * Import this module to enable the `rowDragDrop` input on Grid directive
 * along with the `(rowDragStart)`, `(rowDragEnd)`, `(rowDrop)`, and
 * `(rowTransfer)` outputs. Supports both intra-grid reorder and cross-grid
 * transfer.
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid-angular/features/row-drag-drop';
 *
 * <tbw-grid [rowDragDrop]="{ dropZone: 'employees' }" />
 * ```
 *
 * @packageDocumentation
 */

import '@toolbox-web/grid/features/row-drag-drop';
export type { _Augmentation as _RowDragDropAugmentation } from '@toolbox-web/grid/features/row-drag-drop';
