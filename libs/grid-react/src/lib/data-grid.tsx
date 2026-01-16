import type { ColumnConfig, DataGridElement, GridConfig } from '@toolbox-web/grid';
import { DataGridElement as GridElement } from '@toolbox-web/grid';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, type ReactNode } from 'react';
import '../jsx.d.ts';
import { getDetailRenderer } from './grid-detail-panel';
import { processReactGridConfig, type ReactGridConfig } from './react-column-config';
import { ReactGridAdapter } from './react-grid-adapter';

/**
 * Extended interface for DataGridElement with all methods we need.
 */
interface ExtendedGridElement extends DataGridElement {
  toggleGroup?: (key: string) => Promise<void>;
}

// Track if adapter is registered
let adapterRegistered = false;
let globalAdapter: ReactGridAdapter | null = null;

/**
 * Ensure the React adapter is registered globally.
 * Called synchronously to ensure adapter is available before grid parses light DOM.
 */
function ensureAdapterRegistered(): ReactGridAdapter {
  if (!adapterRegistered) {
    globalAdapter = new ReactGridAdapter();
    GridElement.registerAdapter(globalAdapter);
    adapterRegistered = true;
  }
  // globalAdapter is guaranteed to be set after above code
  return globalAdapter as ReactGridAdapter;
}

// Register adapter immediately at module load time
// This ensures the adapter is available when grids parse their light DOM columns
ensureAdapterRegistered();

/**
 * Configures the MasterDetailPlugin after React renders GridDetailPanel.
 * - If plugin exists: refresh its detail renderer
 * - If plugin doesn't exist but <tbw-grid-detail> is present: auto-create and add the plugin
 *
 * This matches the behavior of Angular's Grid directive.
 */
function configureMasterDetail(gridElement: Element, adapter: ReactGridAdapter): void {
  const grid = gridElement as any;

  // Check if plugin already exists by name (avoids needing to import the plugin class)
  const existingPlugin = grid.getPluginByName?.('masterDetail');
  if (existingPlugin && typeof existingPlugin.refreshDetailRenderer === 'function') {
    // Plugin exists - just refresh the renderer to pick up React templates
    existingPlugin.refreshDetailRenderer();
    return;
  }

  // Check if <tbw-grid-detail> is present in light DOM
  const detailElement = gridElement.querySelector('tbw-grid-detail');
  if (!detailElement) return;

  // Check if a detail renderer was registered via GridDetailPanel
  const detailRenderer = getDetailRenderer(gridElement as HTMLElement);
  if (!detailRenderer) return;

  // No existing plugin - we need to dynamically create one
  // This requires importing the plugin class, so we do it async
  import('@toolbox-web/grid/all')
    .then(({ MasterDetailPlugin }) => {
      // Create React detail renderer function
      const reactDetailRenderer = adapter.createDetailRenderer(gridElement as HTMLElement);
      if (!reactDetailRenderer) return;

      // Parse configuration from attributes
      const animationAttr = detailElement.getAttribute('animation');
      let animation: 'slide' | 'fade' | false = 'slide';
      if (animationAttr === 'false') {
        animation = false;
      } else if (animationAttr === 'fade') {
        animation = 'fade';
      }

      const showExpandColumn = detailElement.getAttribute('showExpandColumn') !== 'false';

      // Create and add the plugin
      const plugin = new MasterDetailPlugin({
        detailRenderer: reactDetailRenderer,
        showExpandColumn,
        animation,
      });

      const currentConfig = grid.gridConfig || {};
      const existingPlugins = currentConfig.plugins || [];
      grid.gridConfig = {
        ...currentConfig,
        plugins: [...existingPlugins, plugin],
      };
    })
    .catch(() => {
      // Plugin not available - ignore
    });
}

/**
 * Props for the DataGrid component.
 */
export interface DataGridProps<TRow = unknown> {
  /** Row data to display */
  rows: TRow[];
  /**
   * Grid configuration. Supports React renderers/editors via `reactRenderer` and `reactEditor` properties.
   * @example
   * ```tsx
   * gridConfig={{
   *   columns: [
   *     {
   *       field: 'status',
   *       reactRenderer: (ctx) => <StatusBadge value={ctx.value} />,
   *       reactEditor: (ctx) => <StatusEditor value={ctx.value} onCommit={ctx.commit} />,
   *     },
   *   ],
   * }}
   * ```
   */
  gridConfig?: ReactGridConfig<TRow>;
  /** Column definitions (alternative to gridConfig.columns) */
  columns?: ColumnConfig<TRow>[];
  /** Fit mode for column sizing */
  fitMode?: 'stretch' | 'fit-columns' | 'auto-fit';
  /** Edit trigger mode */
  editOn?: 'click' | 'dblclick' | 'none';
  /** Custom CSS styles to inject into grid shadow DOM */
  customStyles?: string;
  /** Class name for the grid element */
  className?: string;
  /** Inline styles for the grid element */
  style?: React.CSSProperties;
  /** Children (GridColumn components for custom renderers/editors) */
  children?: ReactNode;

  // Event handlers
  /** Fired when rows change (sorting, editing, etc.) */
  onRowsChange?: (rows: TRow[]) => void;
  /** Fired when a cell value is edited */
  onCellEdit?: (event: CustomEvent<{ row: TRow; field: string; oldValue: unknown; newValue: unknown }>) => void;
  /** Fired when a row is clicked */
  onRowClick?: (event: CustomEvent<{ row: TRow; rowIndex: number }>) => void;
  /** Fired when column state changes (resize, reorder, visibility) */
  onColumnStateChange?: (event: CustomEvent<{ columns: ColumnConfig<TRow>[] }>) => void;
  /** Fired when sort changes */
  onSortChange?: (event: CustomEvent<{ field: string; direction: 'asc' | 'desc' } | null>) => void;
}

/**
 * Ref handle for the DataGrid component.
 */
export interface DataGridRef<TRow = unknown> {
  /** The underlying grid DOM element */
  element: DataGridElement | null;
  /** Get the effective configuration */
  getConfig: () => Promise<Readonly<GridConfig<TRow>>>;
  /** Wait for the grid to be ready */
  ready: () => Promise<void>;
  /** Force a layout recalculation */
  forceLayout: () => Promise<void>;
  /** Toggle a group row */
  toggleGroup: (key: string) => Promise<void>;
  /** Register custom styles */
  registerStyles: (id: string, css: string) => void;
  /** Unregister custom styles */
  unregisterStyles: (id: string) => void;
}

/**
 * React wrapper component for the tbw-grid web component.
 *
 * ## Basic Usage
 *
 * ```tsx
 * import { DataGrid } from '@toolbox-web/grid-react';
 *
 * function MyComponent() {
 *   const [rows, setRows] = useState([...]);
 *
 *   return (
 *     <DataGrid
 *       rows={rows}
 *       columns={[
 *         { field: 'name', header: 'Name' },
 *         { field: 'age', header: 'Age', type: 'number' },
 *       ]}
 *       onRowsChange={setRows}
 *     />
 *   );
 * }
 * ```
 *
 * ## With Custom Renderers
 *
 * ```tsx
 * import { DataGrid, GridColumn } from '@toolbox-web/grid-react';
 *
 * function MyComponent() {
 *   return (
 *     <DataGrid rows={rows}>
 *       <GridColumn field="status">
 *         {(ctx) => <StatusBadge status={ctx.value} />}
 *       </GridColumn>
 *       <GridColumn
 *         field="name"
 *         editable
 *         editor={(ctx) => (
 *           <input
 *             defaultValue={ctx.value}
 *             onBlur={(e) => ctx.commit(e.target.value)}
 *             onKeyDown={(e) => e.key === 'Escape' && ctx.cancel()}
 *           />
 *         )}
 *       />
 *     </DataGrid>
 *   );
 * }
 * ```
 *
 * ## With Ref
 *
 * ```tsx
 * import { DataGrid, DataGridRef } from '@toolbox-web/grid-react';
 * import { useRef } from 'react';
 *
 * function MyComponent() {
 *   const gridRef = useRef<DataGridRef>(null);
 *
 *   const handleClick = async () => {
 *     const config = await gridRef.current?.getConfig();
 *     console.log('Current columns:', config?.columns);
 *   };
 *
 *   return <DataGrid ref={gridRef} rows={rows} />;
 * }
 * ```
 */
export const DataGrid = forwardRef<DataGridRef, DataGridProps>(function DataGrid<TRow = unknown>(
  props: DataGridProps<TRow>,
  ref: React.ForwardedRef<DataGridRef<TRow>>,
) {
  const {
    rows,
    gridConfig,
    columns,
    fitMode,
    editOn,
    customStyles,
    className,
    style,
    children,
    onRowsChange,
    onCellEdit,
    onRowClick,
    onColumnStateChange,
    onSortChange,
  } = props;

  const gridRef = useRef<ExtendedGridElement>(null);
  const customStylesIdRef = useRef<string | null>(null);

  // Process gridConfig to convert React renderers/editors to DOM functions
  const processedGridConfig = useMemo(() => processReactGridConfig(gridConfig), [gridConfig]);

  // Sync rows
  useEffect(() => {
    if (gridRef.current) {
      gridRef.current.rows = rows;
    }
  }, [rows]);

  // Sync gridConfig (using processed version with React wrappers)
  useEffect(() => {
    if (gridRef.current && processedGridConfig) {
      gridRef.current.gridConfig = processedGridConfig as GridConfig<unknown>;
    }
  }, [processedGridConfig]);

  // Sync columns
  useEffect(() => {
    if (gridRef.current && columns) {
      gridRef.current.columns = columns as ColumnConfig<unknown>[];
    }
  }, [columns]);

  // Sync fitMode
  useEffect(() => {
    if (gridRef.current && fitMode !== undefined) {
      (gridRef.current as unknown as { fitMode: string }).fitMode = fitMode;
    }
  }, [fitMode]);

  // Sync editOn
  useEffect(() => {
    if (gridRef.current && editOn !== undefined) {
      (gridRef.current as unknown as { editOn: string }).editOn = editOn;
    }
  }, [editOn]);

  // After React renders GridColumn children and ref callbacks register renderers/editors,
  // call refreshColumns() to force the grid to re-parse light DOM with the registered adapters.
  // This mirrors Angular's ngAfterContentInit pattern.
  // Run once on mount - children is checked inside but not a dependency to avoid infinite loops.
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    // Ensure the framework adapter is available on the grid element
    // This is needed for plugins (like MasterDetailPlugin) to create React-based renderers
    const adapter = ensureAdapterRegistered();
    (grid as any).__frameworkAdapter = adapter;

    // Configure MasterDetailPlugin SYNCHRONOUSLY to avoid visible flash
    // Uses getPluginByName() so no async import needed for the common case
    // where user already added MasterDetailPlugin to their plugins array
    configureMasterDetail(grid as unknown as Element, adapter);

    // Use a single RAF for column/shell refresh
    // React 18+ batches updates, so one frame is usually enough
    let cancelled = false;

    const timer = requestAnimationFrame(() => {
      if (cancelled) return;

      // Refresh columns to pick up React-rendered light DOM elements
      if (typeof (grid as any).refreshColumns === 'function') {
        (grid as any).refreshColumns();
      }

      // Refresh shell header to pick up tool panel templates
      if (typeof (grid as any).refreshShellHeader === 'function') {
        (grid as any).refreshShellHeader();
      }
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(timer);
    };
  }, []); // Run once on mount

  // Handle custom styles - must wait for grid to be ready
  useEffect(() => {
    if (!gridRef.current || !customStyles) return;

    const grid = gridRef.current;
    const styleId = 'react-custom-styles';
    let isActive = true;

    // Wait for grid to be ready before registering styles
    // This ensures the shadow DOM is available for style injection
    grid.ready?.().then(() => {
      if (isActive && customStyles) {
        grid.registerStyles?.(styleId, customStyles);
        customStylesIdRef.current = styleId;
      }
    });

    return () => {
      isActive = false;
      if (customStylesIdRef.current) {
        grid.unregisterStyles?.(customStylesIdRef.current);
        customStylesIdRef.current = null;
      }
    };
  }, [customStyles]);

  // Event handlers
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const handlers: Array<[string, EventListener]> = [];

    if (onRowsChange) {
      const handler = ((e: CustomEvent) => onRowsChange(e.detail.rows)) as EventListener;
      grid.addEventListener('rows-change', handler);
      handlers.push(['rows-change', handler]);
    }

    if (onCellEdit) {
      const handler = ((e: CustomEvent) => onCellEdit(e)) as EventListener;
      grid.addEventListener('cell-edit', handler);
      handlers.push(['cell-edit', handler]);
    }

    if (onRowClick) {
      const handler = ((e: CustomEvent) => onRowClick(e)) as EventListener;
      grid.addEventListener('row-click', handler);
      handlers.push(['row-click', handler]);
    }

    if (onColumnStateChange) {
      const handler = ((e: CustomEvent) => onColumnStateChange(e)) as EventListener;
      grid.addEventListener('column-state-change', handler);
      handlers.push(['column-state-change', handler]);
    }

    if (onSortChange) {
      const handler = ((e: CustomEvent) => onSortChange(e)) as EventListener;
      grid.addEventListener('sort-change', handler);
      handlers.push(['sort-change', handler]);
    }

    return () => {
      handlers.forEach(([event, handler]) => {
        grid.removeEventListener(event, handler);
      });
    };
  }, [onRowsChange, onCellEdit, onRowClick, onColumnStateChange, onSortChange]);

  // Expose ref API
  useImperativeHandle(
    ref,
    () => ({
      get element() {
        return gridRef.current;
      },
      async getConfig() {
        return gridRef.current?.getConfig?.() ?? ({} as GridConfig<TRow>);
      },
      async ready() {
        return gridRef.current?.ready?.();
      },
      async forceLayout() {
        return gridRef.current?.forceLayout?.();
      },
      async toggleGroup(key: string) {
        return gridRef.current?.toggleGroup?.(key);
      },
      registerStyles(id: string, css: string) {
        gridRef.current?.registerStyles?.(id, css);
      },
      unregisterStyles(id: string) {
        gridRef.current?.unregisterStyles?.(id);
      },
    }),
    [],
  );

  return (
    <tbw-grid
      ref={(el) => {
        (gridRef as React.MutableRefObject<ExtendedGridElement | null>).current = el as ExtendedGridElement | null;

        // Set initial config synchronously in ref callback
        // This ensures gridConfig is available before connectedCallback completes its initial setup
        // React's useEffect runs too late (after paint), causing the grid to initialize without config
        if (el) {
          const grid = el as ExtendedGridElement;
          // Use processedGridConfig which has React renderers/editors wrapped as DOM functions
          if (processedGridConfig) {
            grid.gridConfig = processedGridConfig as GridConfig<unknown>;
          }
          if (rows) {
            grid.rows = rows;
          }
          if (columns) {
            grid.columns = columns as ColumnConfig<unknown>[];
          }
        }
      }}
      class={className}
      style={style}
    >
      {children}
    </tbw-grid>
  );
}) as <TRow = unknown>(props: DataGridProps<TRow> & { ref?: React.Ref<DataGridRef<TRow>> }) => React.ReactElement;
