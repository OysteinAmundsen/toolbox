/**
 * Type-level default registry for React applications.
 *
 * Provides application-wide type defaults for renderers and editors
 * that all grids inherit automatically via React Context.
 */
import type { TypeDefault as BaseTypeDefault, CellRenderContext, ColumnEditorContext } from '@toolbox-web/grid';
import type { FilterPanelParams } from '@toolbox-web/grid/plugins/filtering';
import { createContext, useContext, type FC, type ReactNode } from 'react';

// #region TypeDefault Interface
/**
 * Type default configuration for React applications.
 *
 * Defines default renderer, editor, and editorParams for a data type
 * using React function components.
 *
 * @example
 * ```tsx
 * import type { TypeDefault } from '@toolbox-web/grid-react';
 *
 * const countryDefault: TypeDefault<Employee, string> = {
 *   renderer: (ctx) => <CountryFlag code={ctx.value} />,
 *   editor: (ctx) => (
 *     <CountrySelect value={ctx.value} onSelect={ctx.commit} />
 *   ),
 * };
 * ```
 */
export interface TypeDefault<TRow = unknown, TValue = unknown> {
  /** React component/function for rendering cells of this type */
  renderer?: (ctx: CellRenderContext<TRow, TValue>) => ReactNode;
  /** React component/function for editing cells of this type */
  editor?: (ctx: ColumnEditorContext<TRow, TValue>) => ReactNode;
  /** Default editorParams for this type */
  editorParams?: Record<string, unknown>;
  /**
   * Custom filter panel renderer for this type. Requires FilteringPlugin.
   *
   * Returns JSX to render as the custom filter panel content.
   * The rendered content is mounted into the filter panel container.
   *
   * @example
   * ```tsx
   * filterPanelRenderer: (params) => (
   *   <MyFilterPanel
   *     field={params.field}
   *     uniqueValues={params.uniqueValues}
   *     onApply={(values) => params.applySetFilter(values)}
   *     onClear={params.clearFilter}
   *   />
   * )
   * ```
   */
  filterPanelRenderer?: (params: FilterPanelParams) => ReactNode;
}

/**
 * @deprecated Use `TypeDefault` instead.
 * @see {@link TypeDefault}
 */
export type ReactTypeDefault<TRow = unknown, TValue = unknown> = TypeDefault<TRow, TValue>;
// #endregion

/**
 * Type defaults registry - a map of type names to their defaults.
 */
export type TypeDefaultsMap = Record<string, TypeDefault>;

/**
 * Context for providing type defaults to grids.
 */
const GridTypeContext = createContext<TypeDefaultsMap | null>(null);

/**
 * Props for the GridTypeProvider component.
 */
export interface GridTypeProviderProps {
  /**
   * Type defaults to provide to all descendant grids.
   *
   * @example
   * ```tsx
   * const typeDefaults = {
   *   country: {
   *     renderer: (ctx) => <CountryBadge value={ctx.value} />,
   *     editor: (ctx) => <CountrySelect value={ctx.value} onCommit={ctx.commit} />
   *   },
   *   status: {
   *     renderer: (ctx) => <StatusBadge value={ctx.value} />
   *   }
   * };
   *
   * <GridTypeProvider defaults={typeDefaults}>
   *   <App />
   * </GridTypeProvider>
   * ```
   */
  defaults: TypeDefaultsMap;
  children: ReactNode;
}

/**
 * Provides application-wide type defaults for all descendant grids.
 *
 * Wrap your application (or part of it) with this provider to make
 * type-level renderers and editors available to all DataGrid components.
 *
 * @example
 * ```tsx
 * // App.tsx or main.tsx
 * import { GridTypeProvider, type TypeDefaultsMap } from '@toolbox-web/grid-react';
 *
 * const typeDefaults: TypeDefaultsMap = {
 *   country: {
 *     renderer: (ctx) => <CountryBadge code={ctx.value} />,
 *     editor: (ctx) => (
 *       <CountrySelect
 *         value={ctx.value}
 *         onSelect={(v) => ctx.commit(v)}
 *       />
 *     )
 *   },
 *   date: {
 *     renderer: (ctx) => formatDate(ctx.value),
 *     editor: (ctx) => <DatePicker value={ctx.value} onCommit={ctx.commit} />
 *   }
 * };
 *
 * function App() {
 *   return (
 *     <GridTypeProvider defaults={typeDefaults}>
 *       <Dashboard />
 *     </GridTypeProvider>
 *   );
 * }
 * ```
 *
 * Any DataGrid with columns using `type: 'country'` will automatically
 * use the registered renderer/editor.
 */
export const GridTypeProvider: FC<GridTypeProviderProps> = ({ defaults, children }) => {
  return <GridTypeContext.Provider value={defaults}>{children}</GridTypeContext.Provider>;
};

/**
 * Hook to access the type defaults from context.
 *
 * @returns The type defaults map, or null if not within a GridTypeProvider
 */
export function useGridTypeDefaults(): TypeDefaultsMap | null {
  return useContext(GridTypeContext);
}

/**
 * Hook to get type defaults for a specific type.
 *
 * @param type - The type name to look up
 * @returns The type defaults, or undefined if not found
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const countryDefaults = useTypeDefault('country');
 *   // countryDefaults?.renderer, countryDefaults?.editor
 * }
 * ```
 */
export function useTypeDefault<TRow = unknown, TValue = unknown>(type: string): TypeDefault<TRow, TValue> | undefined {
  const defaults = useContext(GridTypeContext);
  return defaults?.[type] as TypeDefault<TRow, TValue> | undefined;
}

/**
 * Creates a BaseTypeDefault that the grid can use from a React type default.
 *
 * This converts React render functions into grid-compatible renderer/editor functions.
 * Used internally by ReactGridAdapter.
 *
 * @internal
 */
export function typeDefaultToBaseTypeDefault<TRow = unknown>(
  typeDefault: TypeDefault<TRow>,
  renderReactNode: (node: ReactNode) => HTMLElement,
): BaseTypeDefault<TRow> {
  const baseTypeDefault: BaseTypeDefault<TRow> = {
    editorParams: typeDefault.editorParams,
  };

  if (typeDefault.renderer) {
    const reactRenderer = typeDefault.renderer;
    baseTypeDefault.renderer = (ctx) => {
      const node = reactRenderer(ctx);
      return renderReactNode(node);
    };
  }

  if (typeDefault.editor) {
    const reactEditor = typeDefault.editor;
    // Type assertion needed: adapter bridges TRow to core's unknown
    baseTypeDefault.editor = ((ctx) => {
      const node = reactEditor(ctx as ColumnEditorContext<TRow, unknown>);
      return renderReactNode(node);
    }) as BaseTypeDefault['editor'];
  }

  if (typeDefault.filterPanelRenderer) {
    const reactFilterRenderer = typeDefault.filterPanelRenderer;
    baseTypeDefault.filterPanelRenderer = wrapReactFilterPanelRenderer(reactFilterRenderer, renderReactNode);
  }

  return baseTypeDefault;
}

/**
 * Wraps a React filter panel renderer into a vanilla FilterPanelRenderer.
 *
 * Mounts react content into the filter panel container element.
 * Automatically unmounts the previous root when a new panel opens.
 *
 * @internal
 */
export function wrapReactFilterPanelRenderer(
  reactFn: (params: FilterPanelParams) => ReactNode,
  renderReactNode: (node: ReactNode) => HTMLElement,
): (container: HTMLElement, params: FilterPanelParams) => void {
  return (container: HTMLElement, params: FilterPanelParams) => {
    const rendered = renderReactNode(reactFn(params));
    container.appendChild(rendered);
  };
}

/**
 * @deprecated Use `typeDefaultToBaseTypeDefault` instead.
 * @see {@link typeDefaultToBaseTypeDefault}
 */
export const reactTypeDefaultToGridTypeDefault = typeDefaultToBaseTypeDefault;

/**
 * Internal context for passing the type defaults to the adapter.
 * Used by DataGrid to communicate with ReactGridAdapter.
 * @internal
 */
export const GridTypeContextInternal = GridTypeContext;
