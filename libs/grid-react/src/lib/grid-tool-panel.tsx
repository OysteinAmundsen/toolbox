import type { ReactNode } from 'react';
import { useCallback, useRef, type ReactElement } from 'react';
import '../jsx.d.ts';

/**
 * Context object passed to the tool panel render function.
 */
export interface ToolPanelContext {
  /** Reference to the grid element */
  grid: HTMLElement;
}

/**
 * Registry for tool panel render functions.
 */
const toolPanelRegistry = new WeakMap<HTMLElement, (ctx: ToolPanelContext) => ReactNode>();

// Fallback registry by panel ID
const panelIdRegistry = new Map<string, (ctx: ToolPanelContext) => ReactNode>();

/**
 * Get the tool panel renderer for a panel element.
 * @internal
 */
export function getToolPanelRenderer(panelElement: HTMLElement): ((ctx: ToolPanelContext) => ReactNode) | undefined {
  // Try WeakMap lookup first
  const renderer = toolPanelRegistry.get(panelElement);
  if (renderer) return renderer;

  // Fallback to ID-based lookup
  const panelId = panelElement.id;
  if (panelId) {
    return panelIdRegistry.get(panelId);
  }

  return undefined;
}

/**
 * Get all registered tool panel elements within a grid.
 * @internal
 */
export function getToolPanelElements(gridElement: HTMLElement): HTMLElement[] {
  const panels = gridElement.querySelectorAll('tbw-grid-tool-panel');
  return Array.from(panels).filter((el) => {
    const hasRegistry = toolPanelRegistry.has(el as HTMLElement);
    const hasIdRegistry = el.id && panelIdRegistry.has(el.id);
    return hasRegistry || hasIdRegistry;
  }) as HTMLElement[];
}

/**
 * Props for the GridToolPanel component.
 */
export interface GridToolPanelProps {
  /**
   * Unique identifier for this panel.
   * Required for the shell plugin to track the panel.
   */
  id: string;

  /**
   * Panel title shown in the accordion header.
   */
  title: string;

  /**
   * Icon for the accordion section header.
   * Can be an emoji or text.
   */
  icon?: string;

  /**
   * Tooltip text for the accordion header.
   */
  tooltip?: string;

  /**
   * Panel order priority. Lower values appear first.
   * @default 100
   */
  order?: number;

  /**
   * Render function for the panel content.
   * Receives a context with the grid element reference.
   *
   * @example
   * ```tsx
   * <GridToolPanel id="filters" title="Quick Filters" icon="🔍">
   *   {({ grid }) => <QuickFilters gridRef={grid} />}
   * </GridToolPanel>
   * ```
   */
  children: (ctx: ToolPanelContext) => ReactNode;
}

/**
 * Component for defining a custom tool panel within a DataGrid.
 *
 * Renders a `<tbw-grid-tool-panel>` custom element in the light DOM that the
 * ShellPlugin picks up and displays in the side panel accordion.
 *
 * ## Usage
 *
 * ```tsx
 * import { DataGrid, GridToolPanel } from '@toolbox-web/grid-react';
 *
 * function EmployeeGrid() {
 *   return (
 *     <DataGrid rows={employees} gridConfig={config}>
 *       <GridToolPanel id="quick-filters" title="Quick Filters" icon="🔍" order={10}>
 *         {({ grid }) => (
 *           <div className="filters">
 *             <button onClick={() => applyFilter(grid, 'active')}>Active</button>
 *             <button onClick={() => applyFilter(grid, 'inactive')}>Inactive</button>
 *           </div>
 *         )}
 *       </GridToolPanel>
 *
 *       <GridToolPanel id="stats" title="Statistics" icon="📊" order={20}>
 *         {() => <StatsPanel data={employees} />}
 *       </GridToolPanel>
 *     </DataGrid>
 *   );
 * }
 * ```
 *
 * ## How it works
 *
 * 1. This component renders a `<tbw-grid-tool-panel>` element in the grid's light DOM
 * 2. The ReactGridAdapter detects this element and creates a panel renderer
 * 3. When the shell plugin initializes, it finds these panels and renders them
 * 4. The React component is rendered into the accordion panel container
 */
export function GridToolPanel(props: GridToolPanelProps): ReactElement {
  const { id, title, icon, tooltip, order = 100, children } = props;

  const elementRef = useRef<HTMLElement | null>(null);

  // Register the tool panel renderer when the element mounts
  const refCallback = useCallback(
    (element: HTMLElement | null) => {
      elementRef.current = element;

      if (!element) return;

      // Register by element
      toolPanelRegistry.set(element, children as (ctx: ToolPanelContext) => ReactNode);

      // Also register by ID for fallback
      if (id) {
        panelIdRegistry.set(id, children as (ctx: ToolPanelContext) => ReactNode);
      }
    },
    [children, id],
  );

  return (
    <tbw-grid-tool-panel
      ref={refCallback}
      id={id}
      title={title}
      icon={icon}
      tooltip={tooltip}
      order={order?.toString()}
    />
  );
}
