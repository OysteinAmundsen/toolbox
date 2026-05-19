/**
 * Icon configuration registry for React applications.
 *
 * Provides application-wide icon overrides for all grids via React Context.
 */
import type { GridIcons } from '@toolbox-web/grid';
import { createContext, useContext, type FC, type ReactNode } from 'react';

/**
 * Context for providing icon overrides to grids.
 * @internal
 */
export const GridIconContext = createContext<Partial<GridIcons> | null>(null);

/**
 * Props for the GridIconProvider component.
 */
export interface GridIconProviderProps {
  /**
   * Icon overrides to provide to all descendant grids.
   * Only specify icons you want to override - defaults are used for the rest.
   *
   * @example
   * ```tsx
   * const icons = {
   *   expand: '➕',
   *   collapse: '➖',
   *   sortAsc: '↑',
   *   sortDesc: '↓',
   * };
   *
   * <GridIconProvider icons={icons}>
   *   <App />
   * </GridIconProvider>
   * ```
   */
  icons: Partial<GridIcons>;
  children: ReactNode;
}

/**
 * Provides application-wide icon overrides for all descendant grids.
 *
 * Wrap your application (or part of it) with this provider to customize
 * grid icons across all DataGrid components.
 *
 * @example
 * ```tsx
 * // App.tsx or main.tsx
 * import { GridIconProvider } from '@toolbox-web/grid-react';
 *
 * const customIcons = {
 *   expand: '➕',
 *   collapse: '➖',
 *   sortAsc: '↑',
 *   sortDesc: '↓',
 *   filter: '<svg>...</svg>',
 * };
 *
 * function App() {
 *   return (
 *     <GridIconProvider icons={customIcons}>
 *       <Dashboard />
 *     </GridIconProvider>
 *   );
 * }
 * ```
 *
 * Available icons to override:
 * - `expand` - Expand icon for collapsed items (trees, groups, details)
 * - `collapse` - Collapse icon for expanded items
 * - `sortAsc` - Sort ascending indicator
 * - `sortDesc` - Sort descending indicator
 * - `sortNone` - Sort neutral/unsorted indicator
 * - `submenuArrow` - Submenu arrow for context menus
 * - `dragHandle` - Drag handle icon for reordering
 * - `toolPanel` - Tool panel toggle icon in toolbar
 * - `filter` - Filter icon in column headers
 * - `filterActive` - Filter icon when filter is active
 * - `print` - Print icon for print button
 */
export const GridIconProvider: FC<GridIconProviderProps> = ({ icons, children }) => {
  return <GridIconContext.Provider value={icons}>{children}</GridIconContext.Provider>;
};

/**
 * Hook to access icon overrides from context.
 *
 * @returns The icon overrides from the nearest GridIconProvider, or null if none.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const icons = useGridIcons();
 *   console.log('Current expand icon:', icons?.expand);
 *   return <div />;
 * }
 * ```
 */
export function useGridIcons(): Partial<GridIcons> | null {
  return useContext(GridIconContext);
}

/**
 * Internal context export for use by DataGrid.
 * @internal
 */
export const GridIconContextInternal = GridIconContext;
