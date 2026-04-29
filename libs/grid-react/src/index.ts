/**
 * @packageDocumentation
 * @toolbox-web/grid-react - React adapter for @toolbox-web/grid.
 *
 * React adapter library providing:
 * - DataGrid component wrapper with full React props
 * - Declarative feature props for plugin configuration (selection, editing, filtering, etc.)
 * * - Event handler props with automatic cleanup
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
export type { DataGridProps, DataGridRef } from './lib/data-grid';
export { GridColumn } from './lib/grid-column';
export { GridDetailPanel, type DetailPanelContext, type GridDetailPanelProps } from './lib/grid-detail-panel';
export {
  GridResponsiveCard,
  type GridResponsiveCardProps,
  type ResponsiveCardContext,
} from './lib/grid-responsive-card';
export { GridToolButtons, type GridToolButtonsProps } from './lib/grid-tool-button';
export { GridToolPanel, type GridToolPanelProps, type ToolPanelContext } from './lib/grid-tool-panel';

// Feature props types for declarative plugin configuration
export type { AllFeatureProps, FeatureProps, SSRProps } from './lib/feature-props';

// Column shorthand type (for typing column arrays with shorthand syntax)
export type { ColumnShorthand } from './lib/column-shorthand';

// Event handler props types
export type { EventHandler, EventProps } from './lib/event-props';

// Type registry for application-wide type defaults
export {
  GridTypeProvider,
  useGridTypeDefaults,
  useTypeDefault,
  type GridTypeProviderProps,
  type TypeDefault,
  type TypeDefaultsMap,
} from './lib/grid-type-registry';

// Icon registry for application-wide icon overrides
export { GridIconProvider, useGridIcons, type GridIconProviderProps } from './lib/grid-icon-registry';

// Combined provider for type defaults and icons
export { GridProvider, type GridProviderProps } from './lib/grid-provider';

// Configuration types
export type { ColumnConfig, GridConfig } from './lib/react-column-config';

// Hooks
export { useGrid, type UseGridReturn } from './lib/use-grid';
export { useGridOverlay, type UseGridOverlayOptions } from './lib/use-grid-overlay';

// React adapter (for advanced manual registration - most users don't need this)
export { GridAdapter } from './lib/react-grid-adapter';

// Context types
export type { GridCellContext, GridDetailContext, GridEditorContext, GridToolPanelContext } from './lib/context-types';
