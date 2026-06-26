/**
 * Append-only bridge registries used by `@toolbox-web/grid-angular`.
 *
 * These let feature secondary entries plug into the central `GridAdapter`
 * without the adapter needing to know about them. Mirrors React's and Vue's
 * `register*Bridge` modules and how core grid plugins augment the grid via
 * `registerPlugin()`.
 *
 * This module is deliberately framework-free: it holds plain module-level
 * `let` state and never imports from `@angular/core` or from
 * `@toolbox-web/grid/plugins/...`. Feature subpaths import the setters via
 * the `@toolbox-web/grid-angular` package barrel (relative imports outside
 * a secondary entry's `rootDir` are forbidden by ng-packagr).
 *
 * @internal
 */

import type { TypeDefault as BaseTypeDefault, ColumnEditorSpec } from '@toolbox-web/grid';
import type { GridAdapter } from '../angular-grid-adapter';

/**
 * Installer signature: given a grid element + adapter, returns the row-renderer
 * the adapter should expose, or undefined if no Angular template is registered
 * for that grid. Used by `features/master-detail` and `features/responsive`.
 * @internal
 * @since 1.4.0
 */
export type RowRendererBridge = <TRow = unknown>(
  gridElement: HTMLElement,
  adapter: GridAdapter,
) => ((row: TRow, rowIndex: number) => HTMLElement) | undefined;

/**
 * Installer signature for the type-default `filterPanelRenderer` wrapper.
 * Receives the user-supplied component class loosely typed as `unknown`
 * (so the adapter does not depend on filtering types) and returns the
 * imperative `(container, params) => void` form required by core.
 * @internal
 * @since 1.4.0
 */
export type FilterPanelTypeDefaultBridge = (
  rendererValue: unknown,
  adapter: GridAdapter,
) => NonNullable<BaseTypeDefault['filterPanelRenderer']> | undefined;

/**
 * Installer signature for the template-based cell editor. Given a column/editor
 * light-DOM element + adapter, returns the `ColumnEditorSpec` the grid should
 * use, or undefined if no Angular editor template (`*tbwEditor` /
 * `<tbw-grid-column-editor>`) is registered for that element. Installed by
 * `@toolbox-web/grid-angular/features/editing`; without it, template-based
 * editors are not resolved (component-class editors are unaffected).
 * @internal
 * @since 3.0.0
 */
export type EditorSpecBridge = <TRow = unknown, TValue = unknown>(
  element: HTMLElement,
  adapter: GridAdapter,
) => ColumnEditorSpec<TRow, TValue> | undefined;

/**
 * Installer signature for the tool-panel renderer. Given a tool-panel
 * light-DOM element + adapter, returns the imperative renderer the grid should
 * use, or undefined if no Angular tool-panel template is registered. Installed
 * by `@toolbox-web/grid-angular/features/shell`.
 * @internal
 * @since 3.0.0
 */
export type ToolPanelRendererBridge = (
  element: HTMLElement,
  adapter: GridAdapter,
) => ((container: HTMLElement) => void | (() => void)) | undefined;

let detailRendererBridge: RowRendererBridge | null = null;
let responsiveCardRendererBridge: RowRendererBridge | null = null;
let filterPanelTypeDefaultBridge: FilterPanelTypeDefaultBridge | null = null;
let editorSpecBridge: EditorSpecBridge | null = null;
let toolPanelRendererBridge: ToolPanelRendererBridge | null = null;

/**
 * Install the master-detail row-renderer bridge. Called once on import by
 * `@toolbox-web/grid-angular/features/master-detail`.
 * @internal Plugin API
 * @since 1.4.0
 */
export function registerDetailRendererBridge(bridge: RowRendererBridge): void {
  detailRendererBridge = bridge;
}

/**
 * Install the responsive-card row-renderer bridge. Called once on import by
 * `@toolbox-web/grid-angular/features/responsive`.
 * @internal Plugin API
 * @since 1.4.0
 */
export function registerResponsiveCardRendererBridge(bridge: RowRendererBridge): void {
  responsiveCardRendererBridge = bridge;
}

/**
 * Install the type-default `filterPanelRenderer` wrapper. Called once on import
 * by `@toolbox-web/grid-angular/features/filtering`. Without this bridge,
 * type-default and grid-config-level component-class filterPanelRenderers are
 * silently dropped — same precondition as the FilteringPlugin (TBW031).
 * @internal Plugin API
 * @since 1.4.0
 */
export function registerFilterPanelTypeDefaultBridge(bridge: FilterPanelTypeDefaultBridge): void {
  filterPanelTypeDefaultBridge = bridge;
}

/** @internal Adapter use only. */
export function getDetailRendererBridge(): RowRendererBridge | null {
  return detailRendererBridge;
}

/** @internal Adapter use only. */
export function getResponsiveCardRendererBridge(): RowRendererBridge | null {
  return responsiveCardRendererBridge;
}

/** @internal Adapter use only. */
export function getFilterPanelTypeDefaultBridge(): FilterPanelTypeDefaultBridge | null {
  return filterPanelTypeDefaultBridge;
}

/**
 * Install the template-based editor bridge. Called once on import by
 * `@toolbox-web/grid-angular/features/editing`.
 * @internal Plugin API
 * @since 3.0.0
 */
export function registerEditorSpecBridge(bridge: EditorSpecBridge): void {
  editorSpecBridge = bridge;
}

/** @internal Adapter use only. */
export function getEditorSpecBridge(): EditorSpecBridge | null {
  return editorSpecBridge;
}

/**
 * Install the tool-panel renderer bridge. Called once on import by
 * `@toolbox-web/grid-angular/features/shell`.
 * @internal Plugin API
 * @since 3.0.0
 */
export function registerToolPanelRendererBridge(bridge: ToolPanelRendererBridge): void {
  toolPanelRendererBridge = bridge;
}

/** @internal Adapter use only. */
export function getToolPanelRendererBridge(): ToolPanelRendererBridge | null {
  return toolPanelRendererBridge;
}
