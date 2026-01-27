import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef, type ReactElement } from 'react';
import '../jsx.d.ts';

/**
 * Context object passed to the responsive card render function.
 */
export interface ResponsiveCardContext<TRow = unknown> {
  /** The row data for this card */
  row: TRow;
  /** The row index (zero-based) */
  index: number;
}

/**
 * Registry for responsive card render functions.
 */
const responsiveCardRegistry = new WeakMap<HTMLElement, (ctx: ResponsiveCardContext<unknown>) => ReactNode>();

// Fallback registry by grid ID for React re-render scenarios
const gridResponsiveCardRegistry = new Map<string, (ctx: ResponsiveCardContext<unknown>) => ReactNode>();

/**
 * Get the responsive card renderer for a grid element.
 * @internal
 */
export function getResponsiveCardRenderer(
  gridElement: HTMLElement,
): ((ctx: ResponsiveCardContext<unknown>) => ReactNode) | undefined {
  // First try WeakMap lookup
  const cardElement = gridElement.querySelector('tbw-grid-responsive-card');
  if (cardElement) {
    const renderer = responsiveCardRegistry.get(cardElement as HTMLElement);
    if (renderer) return renderer;
  }

  // Fallback to ID-based lookup
  const gridId = gridElement.id || gridElement.getAttribute('data-grid-id');
  if (gridId) {
    return gridResponsiveCardRegistry.get(gridId);
  }

  return undefined;
}

/**
 * Props for the GridResponsiveCard component.
 */
export interface GridResponsiveCardProps<TRow = unknown> {
  /**
   * Render function for the card content.
   * Receives the row data and row index.
   *
   * @example
   * ```tsx
   * <GridResponsiveCard>
   *   {({ row, index }) => (
   *     <div className="custom-card">
   *       <img src={row.avatar} alt={row.name} />
   *       <span>{row.name}</span>
   *     </div>
   *   )}
   * </GridResponsiveCard>
   * ```
   */
  children: (ctx: ResponsiveCardContext<TRow>) => ReactNode;

  /**
   * Card row height in pixels.
   * Use 'auto' for dynamic height based on content.
   * @default 'auto'
   */
  cardRowHeight?: number | 'auto';
}

/**
 * Component for defining custom card layouts in responsive mode.
 *
 * Renders a `<tbw-grid-responsive-card>` custom element in the light DOM that
 * the ResponsivePlugin picks up to render custom cards in mobile/narrow layouts.
 *
 * ## Usage
 *
 * ```tsx
 * import { DataGrid, GridResponsiveCard } from '@toolbox-web/grid-react';
 * import { ResponsivePlugin } from '@toolbox-web/grid/all';
 *
 * function EmployeeGrid() {
 *   const config = {
 *     plugins: [new ResponsivePlugin({ breakpoint: 500 })],
 *     // ... other config
 *   };
 *
 *   return (
 *     <DataGrid rows={employees} gridConfig={config}>
 *       <GridResponsiveCard cardRowHeight={80}>
 *         {({ row, index }) => (
 *           <div className="employee-card">
 *             <img src={row.avatar} alt="" />
 *             <div>
 *               <strong>{row.name}</strong>
 *               <span>{row.department}</span>
 *             </div>
 *           </div>
 *         )}
 *       </GridResponsiveCard>
 *     </DataGrid>
 *   );
 * }
 * ```
 *
 * ## How it works
 *
 * 1. This component renders a `<tbw-grid-responsive-card>` element in the grid's light DOM
 * 2. The ReactGridAdapter detects this element and creates a card renderer
 * 3. When the grid enters responsive mode, the plugin calls your render function for each row
 * 4. The React component is rendered into the card container
 */
export function GridResponsiveCard<TRow = unknown>(props: GridResponsiveCardProps<TRow>): ReactElement {
  const { children, cardRowHeight = 'auto' } = props;

  const elementRef = useRef<HTMLElement | null>(null);

  // Register the card renderer when the element mounts
  const refCallback = useCallback(
    (element: HTMLElement | null) => {
      elementRef.current = element;

      if (!element) return;

      // Register by element
      responsiveCardRegistry.set(element, children as (ctx: ResponsiveCardContext<unknown>) => ReactNode);

      // Also register by grid ID for fallback
      const gridElement = element.closest('tbw-grid');
      if (gridElement) {
        const gridId = gridElement.id || gridElement.getAttribute('data-grid-id');
        if (gridId) {
          gridResponsiveCardRegistry.set(gridId, children as (ctx: ResponsiveCardContext<unknown>) => ReactNode);
        }
      }
    },
    [children],
  );

  // Cleanup: Clean up registries when component unmounts
  // Note: We do NOT call element.remove() here - React handles DOM removal.
  useEffect(() => {
    return () => {
      const element = elementRef.current;
      if (element) {
        // Clean up registries
        responsiveCardRegistry.delete(element);

        const gridElement = element.closest('tbw-grid');
        if (gridElement) {
          const gridId = gridElement.id || gridElement.getAttribute('data-grid-id');
          if (gridId) {
            gridResponsiveCardRegistry.delete(gridId);
          }
        }
      }
    };
  }, []);

  // Convert cardRowHeight to string attribute
  const heightAttr = cardRowHeight === 'auto' ? 'auto' : String(cardRowHeight);

  return <tbw-grid-responsive-card ref={refCallback} cardRowHeight={heightAttr} />;
}

// displayName for child component detection in DataGrid
GridResponsiveCard.displayName = 'GridResponsiveCard';
