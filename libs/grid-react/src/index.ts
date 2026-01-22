/**
 * @packageDocumentation
 * @toolbox-web/grid-react - React adapter for @toolbox-web/grid.
 *
 * React adapter library providing:
 * - DataGrid component wrapper with full React props
 * - Custom cell renderer support via render props
 * - Custom cell editor support with commit/cancel handling
 * - Master-detail panel support with GridDetailPanel
 * - Custom tool panels with GridToolPanel
 * - Type-level default renderers/editors via GridTypeProvider
 * - TypeScript generics for row type safety
 * - Ref-based access to underlying grid element
 */

// JSX types for custom elements
import './jsx.d.ts';

// Main components
export { DataGrid } from './lib/data-grid';
export { GridColumn } from './lib/grid-column';
export { GridDetailPanel, type DetailPanelContext, type GridDetailPanelProps } from './lib/grid-detail-panel';
export {
  GridResponsiveCard,
  type GridResponsiveCardProps,
  type ResponsiveCardContext,
} from './lib/grid-responsive-card';
export { GridToolButtons, type GridToolButtonsProps } from './lib/grid-tool-button';
export { GridToolPanel, type GridToolPanelProps, type ToolPanelContext } from './lib/grid-tool-panel';

// Type registry for application-wide type defaults
export {
  GridTypeProvider,
  useGridTypeDefaults,
  useTypeDefault,
  type GridTypeProviderProps,
  type ReactTypeDefault,
  type TypeDefaultsMap,
} from './lib/grid-type-registry';

// React column config types (for defining renderers/editors in gridConfig)
export type { ReactColumnConfig, ReactGridConfig } from './lib/react-column-config';

// Hooks
export { useGrid } from './lib/use-grid';
export { useGridEvent } from './lib/use-grid-event';

// React adapter (for advanced usage)
export { ReactGridAdapter, getRegisteredFields } from './lib/react-grid-adapter';

// Context types
export type { GridCellContext, GridDetailContext, GridEditorContext, GridToolPanelContext } from './lib/context-types';

// Re-export useful types from grid
export type { CellRenderContext, ColumnConfig, ColumnEditorContext, GridConfig } from '@toolbox-web/grid';
