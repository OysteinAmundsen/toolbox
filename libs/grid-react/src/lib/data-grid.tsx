import type { BaseGridPlugin, ColumnConfig, DataGridElement, GridConfig } from '@toolbox-web/grid';
import { DataGridElement as GridElement } from '@toolbox-web/grid';
import {
  Children,
  forwardRef,
  isValidElement,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import '../jsx.d.ts';
import { EVENT_PROP_MAP, type EventProps } from './event-props';
import { type AllFeatureProps, type FeatureProps } from './feature-props';
import { type GridDetailPanelProps } from './grid-detail-panel';
import { getResponsiveCardRenderer } from './grid-responsive-card';
import { GridTypeContextInternal } from './grid-type-registry';
import { mergePresetWithProps } from './presets';
import { processReactGridConfig, type ReactGridConfig } from './react-column-config';
import { ReactGridAdapter } from './react-grid-adapter';
import { useLazyPlugins, validateDependencies } from './use-lazy-plugins';

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
 * Refreshes the MasterDetailPlugin renderer after React renders GridDetailPanel.
 * Only refreshes if plugin already exists - plugin creation is handled by feature props.
 */
function refreshMasterDetailRenderer(gridElement: Element): void {
  const grid = gridElement as any;

  // Check if plugin already exists by name
  const existingPlugin = grid.getPluginByName?.('masterDetail');
  if (existingPlugin && typeof existingPlugin.refreshDetailRenderer === 'function') {
    // Plugin exists - refresh the renderer to pick up React templates
    existingPlugin.refreshDetailRenderer();
  }
}

/**
 * Refreshes the ResponsivePlugin card renderer after React renders GridResponsiveCard.
 * Only refreshes if plugin already exists - plugin creation is handled by feature props.
 */
function refreshResponsiveCardRenderer(gridElement: Element, adapter: ReactGridAdapter): void {
  const grid = gridElement as any;

  // Check if <tbw-grid-responsive-card> is present in light DOM
  const cardElement = gridElement.querySelector('tbw-grid-responsive-card');
  if (!cardElement) return;

  // Check if a card renderer was registered via GridResponsiveCard
  const cardRenderer = getResponsiveCardRenderer(gridElement as HTMLElement);
  if (!cardRenderer) return;

  // Check if plugin exists by name
  const existingPlugin = grid.getPluginByName?.('responsive');
  if (existingPlugin && typeof existingPlugin.setCardRenderer === 'function') {
    // Plugin exists - create React card renderer and update it
    const reactCardRenderer = adapter.createResponsiveCardRenderer(gridElement as HTMLElement);
    if (reactCardRenderer) {
      existingPlugin.setCardRenderer(reactCardRenderer);
    }
  }
}

/**
 * Detects child components (GridDetailPanel, GridResponsiveCard) and returns
 * feature props to auto-load the corresponding plugins.
 *
 * This allows the declarative child component pattern to work with lazy loading:
 * ```tsx
 * <DataGrid>
 *   <GridDetailPanel>{(ctx) => <Detail row={ctx.row} />}</GridDetailPanel>
 * </DataGrid>
 * ```
 *
 * The GridDetailPanel child will automatically trigger loading of MasterDetailPlugin.
 */
function detectChildComponentFeatures(children: ReactNode): Partial<FeatureProps> {
  const features: Partial<FeatureProps> = {};

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;

    // Check for GridDetailPanel - auto-add masterDetail feature
    // GridDetailPanel renders <tbw-grid-detail> which the plugin looks for
    if (child.type && (child.type as { displayName?: string }).displayName === 'GridDetailPanel') {
      const detailProps = child.props as GridDetailPanelProps;
      features.masterDetail = {
        // Use props from the child component for configuration
        showExpandColumn: detailProps.showExpandColumn ?? true,
        animation: detailProps.animation ?? 'slide',
        // detailRenderer will be wired up by refreshMasterDetailRenderer after mount
      };
    }

    // Check for GridResponsiveCard - auto-add responsive feature
    if (child.type && (child.type as { displayName?: string }).displayName === 'GridResponsiveCard') {
      // GridResponsiveCard only has cardRowHeight, breakpoint is set via the responsive prop
      // Just enable the plugin with defaults - user can override with responsive prop if needed
      features.responsive = true;
    }
  });

  return features;
}

/**
 * Props for the DataGrid component.
 *
 * @template TRow - The row data type
 *
 * Combines:
 * - Core props (rows, columns, gridConfig)
 * - Feature props (selection, editing, filtering, etc.) - lazily load plugins
 * - Event props (onCellClick, onSelectionChange, etc.)
 * - Loading props (loadingComponent, ssr)
 */
export interface DataGridProps<TRow = unknown> extends AllFeatureProps<TRow>, EventProps<TRow> {
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
  /**
   * Default column properties applied to all columns.
   * Individual column definitions override these defaults.
   *
   * @example
   * ```tsx
   * <DataGrid
   *   columnDefaults={{ sortable: true, resizable: true }}
   *   columns={[
   *     { field: 'id', sortable: false }, // Override: not sortable
   *     { field: 'name' }, // Inherits: sortable, resizable
   *   ]}
   * />
   * ```
   */
  columnDefaults?: Partial<ColumnConfig<TRow>>;
  /** Fit mode for column sizing */
  fitMode?: 'stretch' | 'fit-columns' | 'auto-fit';
  /** Edit trigger mode - DEPRECATED: use `editing` prop instead */
  editOn?: 'click' | 'dblclick' | 'none';
  /** Custom CSS styles to inject into grid shadow DOM */
  customStyles?: string;
  /** Class name for the grid element */
  className?: string;
  /** Inline styles for the grid element */
  style?: React.CSSProperties;
  /** Children (GridColumn components for custom renderers/editors) */
  children?: ReactNode;

  /**
   * Escape hatch: manually provide plugin instances.
   * When provided, feature props for those plugins are ignored.
   * Useful for advanced configurations not covered by feature props.
   *
   * @example
   * ```tsx
   * import { SelectionPlugin } from '@toolbox-web/grid/plugins/selection';
   *
   * <DataGrid
   *   plugins={[new SelectionPlugin({ mode: 'range', checkbox: true })]}
   * />
   * ```
   */
  plugins?: BaseGridPlugin[];

  // Legacy event handlers (kept for backwards compatibility)
  /** Fired when rows change (sorting, editing, etc.) */
  onRowsChange?: (rows: TRow[]) => void;
}

/**
 * Ref handle for the DataGrid component.
 */
export interface DataGridRef<TRow = unknown> {
  /** The underlying grid DOM element with proper typing */
  element: DataGridElement<TRow> | null;
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
    // Core props
    rows,
    gridConfig,
    columns,
    columnDefaults,
    fitMode,
    editOn,
    customStyles,
    className,
    style,
    children,
    // Plugin props
    plugins: manualPlugins,
    preset,
    // Loading props
    loadingComponent,
    ssr,
    // Legacy event handlers
    onRowsChange,
    // Feature props and event props are in ...rest
    ...rest
  } = props;

  const gridRef = useRef<ExtendedGridElement>(null);
  const customStylesIdRef = useRef<string | null>(null);
  const [isGridReady, setIsGridReady] = useState(false);

  // Get type defaults from context
  const typeDefaults = useContext(GridTypeContextInternal);

  // ═══════════════════════════════════════════════════════════════════
  // EXTRACT FEATURE PROPS AND EVENT PROPS
  // ═══════════════════════════════════════════════════════════════════

  // Extract feature props from rest (everything that's not an event handler)
  const featureProps = useMemo(() => {
    const features: FeatureProps<TRow> = {};
    const featureKeys = [
      'selection',
      'editing',
      'filtering',
      'sorting',
      'clipboard',
      'contextMenu',
      'reorder',
      'rowReorder',
      'visibility',
      'undoRedo',
      'tree',
      'groupingRows',
      'groupingColumns',
      'pinnedColumns',
      'pinnedRows',
      'masterDetail',
      'responsive',
      'columnVirtualization',
      'export',
      'print',
      'pivot',
      'serverSide',
    ] as const;

    for (const key of featureKeys) {
      if (key in rest && (rest as any)[key] !== undefined) {
        (features as any)[key] = (rest as any)[key];
      }
    }

    return features;
  }, [rest]);

  // Detect child components (GridDetailPanel, GridResponsiveCard) and merge with feature props
  const childFeatures = useMemo(() => detectChildComponentFeatures(children), [children]);

  // Merge preset with individual feature props and child-detected features
  // Priority: explicit props > child props > preset
  const mergedFeatureProps = useMemo(() => {
    const presetMerged = mergePresetWithProps(preset, featureProps);
    // Child-detected features are applied first, then explicit props override
    return { ...childFeatures, ...presetMerged } as FeatureProps<TRow>;
  }, [preset, featureProps, childFeatures]);

  // Log dependency warnings in development
  useEffect(() => {
    // Check for development mode without relying on Node.js process
    const isDev =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    if (isDev) {
      const warnings = validateDependencies<TRow>(mergedFeatureProps);
      warnings.forEach((w) => console.info(`[grid-react] ${w}`));
    }
  }, [mergedFeatureProps]);

  // ═══════════════════════════════════════════════════════════════════
  // LAZY PLUGIN LOADING
  // ═══════════════════════════════════════════════════════════════════

  // Skip lazy loading if manual plugins are provided or in SSR mode
  const shouldUseLazyPlugins = !manualPlugins && !ssr;

  // Load plugins lazily based on feature props
  const { plugins: lazyPlugins, isLoading: pluginsLoading } = useLazyPlugins<TRow>(
    shouldUseLazyPlugins ? mergedFeatureProps : {},
  );

  // Combine manual plugins with lazy-loaded plugins
  const allPlugins = useMemo(() => {
    if (manualPlugins) {
      // Manual plugins take priority - append any lazy plugins that don't conflict
      const manualNames = new Set(manualPlugins.map((p) => p.name));
      const nonConflicting = lazyPlugins.filter((p) => !manualNames.has(p.name));
      return [...manualPlugins, ...nonConflicting];
    }
    return lazyPlugins;
  }, [manualPlugins, lazyPlugins]);

  // ═══════════════════════════════════════════════════════════════════
  // COLUMN DEFAULTS
  // ═══════════════════════════════════════════════════════════════════

  // Apply column defaults to columns
  const processedColumns = useMemo(() => {
    if (!columns || !columnDefaults) return columns;

    return columns.map((col) => ({
      ...columnDefaults,
      ...col, // Individual column props override defaults
    }));
  }, [columns, columnDefaults]);

  // Process gridConfig to convert React renderers/editors to DOM functions
  const processedGridConfig = useMemo(() => {
    const processed = processReactGridConfig(gridConfig);

    // Add lazy-loaded plugins to the config
    if (allPlugins.length > 0 && processed) {
      const existingPlugins = processed.plugins || [];
      const existingNames = new Set(existingPlugins.map((p) => (p as { name: string }).name));
      const newPlugins = allPlugins.filter((p) => !existingNames.has(p.name));
      return {
        ...processed,
        plugins: [...existingPlugins, ...newPlugins],
      };
    }

    if (allPlugins.length > 0 && !processed) {
      return { plugins: allPlugins };
    }

    return processed;
  }, [gridConfig, allPlugins]);

  // Sync type defaults to the global adapter
  useEffect(() => {
    const adapter = ensureAdapterRegistered();
    adapter.setTypeDefaults(typeDefaults);
  }, [typeDefaults]);

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

  // Sync columns (with defaults applied)
  useEffect(() => {
    if (gridRef.current && processedColumns) {
      gridRef.current.columns = processedColumns as ColumnConfig<unknown>[];
    }
  }, [processedColumns]);

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

    // Refresh plugin renderers to pick up React templates from child components
    // Plugin creation is handled by feature props (see auto-detection in featureProps memo)
    refreshMasterDetailRenderer(grid as unknown as Element);
    refreshResponsiveCardRenderer(grid as unknown as Element, adapter);

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

  // Event handlers - legacy (onRowsChange)
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const handlers: Array<[string, EventListener]> = [];

    if (onRowsChange) {
      const handler = ((e: CustomEvent) => onRowsChange(e.detail.rows)) as EventListener;
      grid.addEventListener('rows-change', handler);
      handlers.push(['rows-change', handler]);
    }

    return () => {
      handlers.forEach(([event, handler]) => {
        grid.removeEventListener(event, handler);
      });
    };
  }, [onRowsChange]);

  // Event handlers - new declarative props with unwrapped detail
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const handlers: Array<[string, EventListener]> = [];

    // Wire up all event props from EVENT_PROP_MAP
    for (const [propName, eventName] of Object.entries(EVENT_PROP_MAP)) {
      const handlerProp = (rest as any)[propName];
      if (typeof handlerProp === 'function') {
        const handler = ((e: CustomEvent) => {
          // Call with unwrapped detail first, full event second
          handlerProp(e.detail, e);
        }) as EventListener;
        grid.addEventListener(eventName, handler);
        handlers.push([eventName, handler]);
      }
    }

    return () => {
      handlers.forEach(([event, handler]) => {
        grid.removeEventListener(event, handler);
      });
    };
  }, [rest]);

  // Track when grid is ready
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    grid.ready?.().then(() => setIsGridReady(true));
  }, []);

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

  // ═══════════════════════════════════════════════════════════════════
  // LOADING STATE
  // ═══════════════════════════════════════════════════════════════════

  // Show loading state while plugins are loading (render blocking)
  if (pluginsLoading && shouldUseLazyPlugins) {
    if (loadingComponent) {
      return <>{loadingComponent}</>;
    }
    // Default loading skeleton
    return (
      <div
        className={className}
        style={{
          ...style,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 200,
          background: 'var(--tbw-color-bg, #f5f5f5)',
          borderRadius: 4,
        }}
      >
        <div
          style={{
            width: 24,
            height: 24,
            border: '2px solid currentColor',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

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
          if (processedColumns) {
            grid.columns = processedColumns as ColumnConfig<unknown>[];
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
