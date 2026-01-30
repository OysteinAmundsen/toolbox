/**
 * Combined provider for application-wide grid configuration.
 *
 * Provides both type defaults and icon overrides in a single provider,
 * reducing JSX nesting.
 */
import type { GridIcons } from '@toolbox-web/grid';
import { type FC, type ReactNode } from 'react';
import { GridIconProvider } from './grid-icon-registry';
import { GridTypeProvider, type TypeDefaultsMap } from './grid-type-registry';

/**
 * Props for the GridProvider component.
 */
export interface GridProviderProps {
  /**
   * Icon overrides to provide to all descendant grids.
   * Optional - only specify if you want to customize icons.
   *
   * @example
   * ```tsx
   * icons={{
   *   expand: '➕',
   *   collapse: '➖',
   *   sortAsc: '↑',
   *   sortDesc: '↓',
   * }}
   * ```
   */
  icons?: Partial<GridIcons>;

  /**
   * Type-level default renderers and editors.
   * Optional - only specify if you want custom type defaults.
   *
   * @example
   * ```tsx
   * defaults={{
   *   country: {
   *     renderer: (ctx) => <CountryBadge value={ctx.value} />,
   *     editor: (ctx) => <CountrySelect value={ctx.value} onCommit={ctx.commit} />
   *   },
   *   date: {
   *     renderer: (ctx) => formatDate(ctx.value),
   *   }
   * }}
   * ```
   */
  defaults?: TypeDefaultsMap;

  children: ReactNode;
}

/**
 * Combined provider for application-wide grid configuration.
 *
 * This component wraps both `GridTypeProvider` and `GridIconProvider` to reduce
 * nesting in your component tree. All props are optional - only provide what you need.
 *
 * @example
 * ```tsx
 * // App.tsx or main.tsx
 * import { GridProvider } from '@toolbox-web/grid-react';
 *
 * const typeDefaults = {
 *   country: { renderer: (ctx) => <CountryBadge value={ctx.value} /> },
 *   status: { renderer: (ctx) => <StatusBadge value={ctx.value} /> },
 * };
 *
 * const icons = {
 *   expand: '➕',
 *   collapse: '➖',
 * };
 *
 * function App() {
 *   return (
 *     <GridProvider defaults={typeDefaults} icons={icons}>
 *       <Dashboard />
 *     </GridProvider>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Icons only
 * <GridProvider icons={{ expand: '+', collapse: '-' }}>
 *   <App />
 * </GridProvider>
 * ```
 *
 * @example
 * ```tsx
 * // Type defaults only
 * <GridProvider defaults={{ date: { renderer: (ctx) => formatDate(ctx.value) } }}>
 *   <App />
 * </GridProvider>
 * ```
 */
export const GridProvider: FC<GridProviderProps> = ({ icons, defaults, children }) => {
  // Build the provider tree based on what's provided
  let content: ReactNode = children;

  // Wrap with type provider if defaults provided
  if (defaults) {
    content = <GridTypeProvider defaults={defaults}>{content}</GridTypeProvider>;
  }

  // Wrap with icon provider if icons provided
  if (icons) {
    content = <GridIconProvider icons={icons}>{content}</GridIconProvider>;
  }

  // If nothing provided, just render children
  return <>{content}</>;
};
