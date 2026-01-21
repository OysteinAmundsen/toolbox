/**
 * Type-level default registry for React applications.
 *
 * Provides application-wide type defaults for renderers and editors
 * that all grids inherit automatically via React Context.
 */
import type { CellRenderContext, ColumnEditorContext, TypeDefault } from '@toolbox-web/grid';
import { createContext, useContext, type FC, type ReactNode } from 'react';

/**
 * React-specific type default configuration.
 * Uses React function components that receive the render context.
 */
export interface ReactTypeDefault<TRow = unknown, TValue = unknown> {
  /** React component/function for rendering cells of this type */
  renderer?: (ctx: CellRenderContext<TRow, TValue>) => ReactNode;
  /** React component/function for editing cells of this type */
  editor?: (ctx: ColumnEditorContext<TRow, TValue>) => ReactNode;
  /** Default editorParams for this type */
  editorParams?: Record<string, unknown>;
}

/**
 * Type defaults registry - a map of type names to their defaults.
 */
export type TypeDefaultsMap = Record<string, ReactTypeDefault>;

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
export function useTypeDefault<TRow = unknown, TValue = unknown>(
  type: string,
): ReactTypeDefault<TRow, TValue> | undefined {
  const defaults = useContext(GridTypeContext);
  return defaults?.[type] as ReactTypeDefault<TRow, TValue> | undefined;
}

/**
 * Creates a TypeDefault that the grid can use from a React type default.
 *
 * This converts React render functions into grid-compatible renderer/editor functions.
 * Used internally by ReactGridAdapter.
 *
 * @internal
 */
export function reactTypeDefaultToGridTypeDefault<TRow = unknown>(
  reactDefault: ReactTypeDefault<TRow>,
  renderReactNode: (node: ReactNode) => HTMLElement,
): TypeDefault<TRow> {
  const typeDefault: TypeDefault<TRow> = {
    editorParams: reactDefault.editorParams,
  };

  if (reactDefault.renderer) {
    const reactRenderer = reactDefault.renderer;
    typeDefault.renderer = (ctx) => {
      const node = reactRenderer(ctx);
      return renderReactNode(node);
    };
  }

  if (reactDefault.editor) {
    const reactEditor = reactDefault.editor;
    typeDefault.editor = (ctx) => {
      const node = reactEditor(ctx);
      return renderReactNode(node);
    };
  }

  return typeDefault;
}

/**
 * Internal context for passing the type defaults to the adapter.
 * Used by DataGrid to communicate with ReactGridAdapter.
 * @internal
 */
export const GridTypeContextInternal = GridTypeContext;
