import type { ReactNode } from 'react';
import { useCallback, useRef, type ReactElement } from 'react';
import '../jsx.d.ts';

/**
 * Context object passed to the detail panel render function.
 */
export interface DetailPanelContext<TRow = unknown> {
  /** The row data for this detail panel */
  row: TRow;
  /** The row index */
  rowIndex: number;
}

/**
 * Registry for detail panel render functions.
 */
const detailRegistry = new WeakMap<HTMLElement, (ctx: DetailPanelContext<unknown>) => ReactNode>();

// Fallback registry by grid ID for React re-render scenarios
const gridDetailRegistry = new Map<string, (ctx: DetailPanelContext<unknown>) => ReactNode>();

/**
 * Get the detail renderer for a grid element.
 * @internal
 */
export function getDetailRenderer(
  gridElement: HTMLElement,
): ((ctx: DetailPanelContext<unknown>) => ReactNode) | undefined {
  // First try WeakMap lookup
  const detailElement = gridElement.querySelector('tbw-grid-detail');
  if (detailElement) {
    const renderer = detailRegistry.get(detailElement as HTMLElement);
    if (renderer) return renderer;
  }

  // Fallback to ID-based lookup
  const gridId = gridElement.id || gridElement.getAttribute('data-grid-id');
  if (gridId) {
    return gridDetailRegistry.get(gridId);
  }

  return undefined;
}

/**
 * Props for the GridDetailPanel component.
 */
export interface GridDetailPanelProps<TRow = unknown> {
  /**
   * Render function for the detail panel content.
   * Receives the row data and row index.
   *
   * @example
   * ```tsx
   * <GridDetailPanel>
   *   {({ row }) => <EmployeeDetails employee={row} />}
   * </GridDetailPanel>
   * ```
   */
  children: (ctx: DetailPanelContext<TRow>) => ReactNode;

  /**
   * Whether to show the expand/collapse column.
   * @default true
   */
  showExpandColumn?: boolean;

  /**
   * Animation style for expand/collapse.
   * - 'slide': Smooth height animation (default)
   * - 'fade': Opacity transition
   * - false: No animation
   * @default 'slide'
   */
  animation?: 'slide' | 'fade' | false;
}

/**
 * Component for defining a master-detail panel within a DataGrid.
 *
 * Renders a `<tbw-grid-detail>` custom element in the light DOM that the
 * MasterDetailPlugin picks up to render expandable row details.
 *
 * ## Usage
 *
 * ```tsx
 * import { DataGrid, GridDetailPanel } from '@toolbox-web/grid-react';
 * import { MasterDetailPlugin } from '@toolbox-web/grid/all';
 *
 * function EmployeeGrid() {
 *   const config = {
 *     plugins: [new MasterDetailPlugin()],
 *     // ... other config
 *   };
 *
 *   return (
 *     <DataGrid rows={employees} gridConfig={config}>
 *       <GridDetailPanel showExpandColumn animation="slide">
 *         {({ row }) => (
 *           <div className="detail-panel">
 *             <h3>{row.firstName} {row.lastName}</h3>
 *             <p>Department: {row.department}</p>
 *             <p>Email: {row.email}</p>
 *           </div>
 *         )}
 *       </GridDetailPanel>
 *     </DataGrid>
 *   );
 * }
 * ```
 *
 * ## How it works
 *
 * 1. This component renders a `<tbw-grid-detail>` element in the grid's light DOM
 * 2. The ReactGridAdapter detects this element and creates a detail renderer
 * 3. When a row is expanded, the adapter calls your render function
 * 4. The React component is rendered into the detail row container
 */
export function GridDetailPanel<TRow = unknown>(props: GridDetailPanelProps<TRow>): ReactElement {
  const { children, showExpandColumn = true, animation = 'slide' } = props;

  const elementRef = useRef<HTMLElement | null>(null);

  // Register the detail renderer when the element mounts
  const refCallback = useCallback(
    (element: HTMLElement | null) => {
      elementRef.current = element;

      if (!element) return;

      // Register by element
      detailRegistry.set(element, children as (ctx: DetailPanelContext<unknown>) => ReactNode);

      // Also register by grid ID for fallback
      const gridElement = element.closest('tbw-grid');
      if (gridElement) {
        const gridId = gridElement.id || gridElement.getAttribute('data-grid-id');
        if (gridId) {
          gridDetailRegistry.set(gridId, children as (ctx: DetailPanelContext<unknown>) => ReactNode);
        }
      }
    },
    [children],
  );

  // Convert animation to string attribute
  const animationAttr = animation === false ? 'false' : animation;

  return (
    <tbw-grid-detail
      ref={refCallback}
      showExpandColumn={showExpandColumn ? undefined : 'false'}
      animation={animationAttr}
    />
  );
}
