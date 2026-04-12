<script setup lang="ts" generic="TRow = unknown">
import type { BaseGridPlugin, ColumnConfig, DataGridElement, FitMode, GridConfig } from '@toolbox-web/grid';
import { DataGridElement as GridElement } from '@toolbox-web/grid';
import type {
  CellActivateDetail,
  CellChangeDetail,
  CellClickDetail,
  CellCommitDetail,
  ChangedRowsResetDetail,
  ClipboardConfig,
  ColumnMoveDetail,
  ColumnResizeDetail,
  ColumnVirtualizationConfig,
  ColumnVisibilityDetail,
  ContextMenuConfig,
  CopyDetail,
  DetailExpandDetail,
  ExportCompleteDetail,
  ExportConfig,
  FilterChangeDetail,
  FilterConfig,
  GridColumnState,
  GroupingColumnsConfig,
  GroupingRowsConfig,
  GroupToggleDetail,
  MasterDetailConfig,
  MultiSortConfig,
  PasteDetail,
  PinnedRowsConfig,
  PivotConfig,
  PrintCompleteDetail,
  PrintConfig,
  PrintStartDetail,
  ReorderConfig,
  ResponsiveChangeDetail,
  ResponsivePluginConfig,
  RowClickDetail,
  RowCommitDetail,
  RowMoveDetail,
  RowReorderConfig,
  SelectionChangeDetail,
  SelectionConfig,
  ServerSideConfig,
  SortChangeDetail,
  TooltipConfig,
  TreeConfig,
  TreeExpandDetail,
  UndoRedoConfig,
  UndoRedoDetail,
  VisibilityConfig,
} from '@toolbox-web/grid/all';
import { computed, onBeforeUnmount, onMounted, provide, ref, watch, type PropType } from 'vue';
import { createPluginFromFeature, type FeatureName } from './feature-registry';
import { useGridIcons } from './grid-icon-registry';
import { useGridTypeDefaults } from './grid-type-registry';
import { GRID_ELEMENT_KEY } from './use-grid';
import { GridAdapter } from './vue-grid-adapter';

// Track if adapter is registered
let adapterRegistered = false;
let globalAdapter: GridAdapter | null = null;

/**
 * Ensure the Vue adapter is registered globally.
 */
function ensureAdapterRegistered(): GridAdapter {
  if (!adapterRegistered) {
    globalAdapter = new GridAdapter();
    GridElement.registerAdapter(globalAdapter);
    adapterRegistered = true;
  }
  return globalAdapter as GridAdapter;
}

// Register adapter at module load
ensureAdapterRegistered();

/**
 * Props for TbwGrid component
 */
const props = defineProps({
  /** Row data to display */
  rows: {
    type: Array as PropType<TRow[]>,
    default: () => [],
  },
  /** Column definitions (shorthand for gridConfig.columns) */
  columns: {
    type: Array as PropType<ColumnConfig<TRow>[]>,
    default: undefined,
  },
  /** Full grid configuration */
  gridConfig: {
    type: Object as PropType<GridConfig<TRow>>,
    default: undefined,
  },
  /** Fit mode shorthand */
  fitMode: {
    type: String as PropType<FitMode>,
    default: undefined,
  },

  // ═══════════════════════════════════════════════════════════════════
  // GRID-WIDE TOGGLES
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Grid-wide sorting toggle.
   * When false, disables sorting for all columns regardless of their individual `sortable` setting.
   * @default true
   */
  sortable: {
    type: Boolean as PropType<boolean>,
    default: undefined,
  },
  /**
   * Grid-wide filtering toggle.
   * When false, disables filtering for all columns regardless of their individual `filterable` setting.
   * Requires the FilteringPlugin to be loaded (via `filtering` prop or feature import).
   * @default true
   */
  filterable: {
    type: Boolean as PropType<boolean>,
    default: undefined,
  },
  /**
   * Grid-wide selection toggle.
   * When false, disables selection for all rows/cells.
   * Requires the SelectionPlugin to be loaded (via `selection` prop or feature import).
   * @default true
   */
  selectable: {
    type: Boolean as PropType<boolean>,
    default: undefined,
  },
  /**
   * Show a loading overlay on the grid.
   * Use this during initial data fetch or refresh operations.
   * @default false
   */
  loading: {
    type: Boolean as PropType<boolean>,
    default: undefined,
  },
  /**
   * Custom CSS styles to inject into the grid via `document.adoptedStyleSheets`.
   */
  customStyles: {
    type: String as PropType<string>,
    default: undefined,
  },

  // ═══════════════════════════════════════════════════════════════════
  // FEATURE PROPS - Declarative plugin configuration
  // ═══════════════════════════════════════════════════════════════════

  /** Enable cell/row/range selection */
  selection: {
    type: [String, Object] as PropType<'cell' | 'row' | 'range' | SelectionConfig<TRow>>,
    default: undefined,
  },
  /** Enable inline cell editing */
  editing: {
    type: [Boolean, String] as PropType<boolean | 'click' | 'dblclick' | 'manual'>,
    default: undefined,
  },
  /** Enable clipboard copy/paste */
  clipboard: {
    type: [Boolean, Object] as PropType<boolean | ClipboardConfig>,
    default: undefined,
  },
  /** Enable right-click context menu */
  contextMenu: {
    type: [Boolean, Object] as PropType<boolean | ContextMenuConfig>,
    default: undefined,
  },
  /** Enable multi-column sorting */
  multiSort: {
    type: [Boolean, String, Object] as PropType<boolean | 'single' | 'multi' | MultiSortConfig>,
    default: undefined,
  },
  /** Enable column filtering */
  filtering: {
    type: [Boolean, Object] as PropType<boolean | FilterConfig<TRow>>,
    default: undefined,
  },
  /** Enable column drag-to-reorder */
  reorderColumns: {
    type: [Boolean, Object] as PropType<boolean | ReorderConfig>,
    default: undefined,
  },
  /** Enable column visibility toggle panel */
  visibility: {
    type: [Boolean, Object] as PropType<boolean | VisibilityConfig>,
    default: undefined,
  },
  /** Enable pinned/sticky columns */
  pinnedColumns: {
    type: Boolean as PropType<boolean>,
    default: undefined,
  },
  /** Enable multi-level column headers */
  groupingColumns: {
    type: [Boolean, Object] as PropType<boolean | GroupingColumnsConfig>,
    default: undefined,
  },
  /** Enable horizontal column virtualization */
  columnVirtualization: {
    type: [Boolean, Object] as PropType<boolean | ColumnVirtualizationConfig>,
    default: undefined,
  },
  /** Enable row drag-to-reorder */
  reorderRows: {
    type: [Boolean, Object] as PropType<boolean | RowReorderConfig>,
    default: undefined,
  },
  /** Enable row grouping by field values */
  groupingRows: {
    type: Object as PropType<GroupingRowsConfig>,
    default: undefined,
  },
  /** Enable pinned rows */
  pinnedRows: {
    type: [Boolean, Object] as PropType<boolean | PinnedRowsConfig>,
    default: undefined,
  },
  /** Enable hierarchical tree view */
  tree: {
    type: [Boolean, Object] as PropType<boolean | TreeConfig>,
    default: undefined,
  },
  /** Enable master-detail expandable rows */
  masterDetail: {
    type: Object as PropType<MasterDetailConfig>,
    default: undefined,
  },
  /** Enable responsive card layout */
  responsive: {
    type: [Boolean, Object] as PropType<boolean | ResponsivePluginConfig>,
    default: undefined,
  },
  /** Enable undo/redo for cell edits */
  undoRedo: {
    type: [Boolean, Object] as PropType<boolean | UndoRedoConfig>,
    default: undefined,
  },
  /** Enable CSV/JSON export */
  export: {
    type: [Boolean, Object] as PropType<boolean | ExportConfig>,
    default: undefined,
  },
  /** Enable print functionality */
  print: {
    type: [Boolean, Object] as PropType<boolean | PrintConfig>,
    default: undefined,
  },
  /** Enable pivot table functionality */
  pivot: {
    type: Object as PropType<PivotConfig>,
    default: undefined,
  },
  /** Enable server-side data operations */
  serverSide: {
    type: Object as PropType<ServerSideConfig>,
    default: undefined,
  },
  /** Enable tooltip display for header and cell content */
  tooltip: {
    type: [Boolean, Object] as PropType<boolean | TooltipConfig>,
    default: undefined,
  },
});

/**
 * Event name → CustomEvent detail type map.
 * Used internally to wire up event listeners.
 */
const EVENT_MAP = {
  'cell-click': '' as unknown as CellClickDetail,
  'row-click': '' as unknown as RowClickDetail,
  'cell-activate': '' as unknown as CellActivateDetail,
  'cell-change': '' as unknown as CellChangeDetail,
  'cell-commit': '' as unknown as CellCommitDetail,
  'row-commit': '' as unknown as RowCommitDetail,
  'changed-rows-reset': '' as unknown as ChangedRowsResetDetail,
  'sort-change': '' as unknown as SortChangeDetail,
  'filter-change': '' as unknown as FilterChangeDetail,
  'column-resize': '' as unknown as ColumnResizeDetail,
  'column-move': '' as unknown as ColumnMoveDetail,
  'column-visibility': '' as unknown as ColumnVisibilityDetail,
  'column-state-change': '' as unknown as GridColumnState,
  'selection-change': '' as unknown as SelectionChangeDetail,
  'row-move': '' as unknown as RowMoveDetail,
  'group-toggle': '' as unknown as GroupToggleDetail,
  'tree-expand': '' as unknown as TreeExpandDetail,
  'detail-expand': '' as unknown as DetailExpandDetail,
  'responsive-change': '' as unknown as ResponsiveChangeDetail,
  copy: '' as unknown as CopyDetail,
  paste: '' as unknown as PasteDetail,
  'undo-redo': '' as unknown as UndoRedoDetail,
  'export-complete': '' as unknown as ExportCompleteDetail,
  'print-start': '' as unknown as PrintStartDetail,
  'print-complete': '' as unknown as PrintCompleteDetail,
} as const;

/**
 * Emits for TbwGrid — all grid events forwarded as Vue emits.
 */
const emit = defineEmits<{
  (e: 'cell-click', event: CustomEvent<CellClickDetail<TRow>>): void;
  (e: 'row-click', event: CustomEvent<RowClickDetail<TRow>>): void;
  (e: 'cell-activate', event: CustomEvent<CellActivateDetail<TRow>>): void;
  (e: 'cell-change', event: CustomEvent<CellChangeDetail<TRow>>): void;
  (e: 'cell-commit', event: CustomEvent<CellCommitDetail<TRow>>): void;
  (e: 'row-commit', event: CustomEvent<RowCommitDetail<TRow>>): void;
  (e: 'changed-rows-reset', event: CustomEvent<ChangedRowsResetDetail<TRow>>): void;
  (e: 'sort-change', event: CustomEvent<SortChangeDetail>): void;
  (e: 'filter-change', event: CustomEvent<FilterChangeDetail>): void;
  (e: 'column-resize', event: CustomEvent<ColumnResizeDetail>): void;
  (e: 'column-move', event: CustomEvent<ColumnMoveDetail>): void;
  (e: 'column-visibility', event: CustomEvent<ColumnVisibilityDetail>): void;
  (e: 'column-state-change', event: CustomEvent<GridColumnState>): void;
  (e: 'selection-change', event: CustomEvent<SelectionChangeDetail>): void;
  (e: 'row-move', event: CustomEvent<RowMoveDetail<TRow>>): void;
  (e: 'group-toggle', event: CustomEvent<GroupToggleDetail>): void;
  (e: 'tree-expand', event: CustomEvent<TreeExpandDetail<TRow>>): void;
  (e: 'detail-expand', event: CustomEvent<DetailExpandDetail>): void;
  (e: 'responsive-change', event: CustomEvent<ResponsiveChangeDetail>): void;
  (e: 'copy', event: CustomEvent<CopyDetail>): void;
  (e: 'paste', event: CustomEvent<PasteDetail>): void;
  (e: 'undo-redo', event: CustomEvent<UndoRedoDetail>): void;
  (e: 'export-complete', event: CustomEvent<ExportCompleteDetail>): void;
  (e: 'print-start', event: CustomEvent<PrintStartDetail>): void;
  (e: 'print-complete', event: CustomEvent<PrintCompleteDetail>): void;
}>();

// Template ref for the grid element
const gridRef = ref<DataGridElement<TRow> | null>(null);

// Provide grid element to descendants (for useGrid composable)
provide(GRID_ELEMENT_KEY, gridRef);

// Get type defaults and icons from providers
const typeDefaults = useGridTypeDefaults();
const iconOverrides = useGridIcons();

// Feature prop names for creating plugins
const FEATURE_PROPS: FeatureName[] = [
  'selection',
  'editing',
  'clipboard',
  'contextMenu',
  'multiSort',
  'filtering',
  'reorderColumns',
  'visibility',
  'pinnedColumns',
  'groupingColumns',
  'columnVirtualization',
  'reorderRows',
  'groupingRows',
  'pinnedRows',
  'tree',
  'masterDetail',
  'responsive',
  'undoRedo',
  'export',
  'print',
  'pivot',
  'serverSide',
  'tooltip',
];

/**
 * Create plugins from feature props.
 */
function createFeaturePlugins(): BaseGridPlugin[] {
  const plugins: BaseGridPlugin[] = [];

  for (const feature of FEATURE_PROPS) {
    const propValue = props[feature as keyof typeof props];
    if (propValue !== undefined) {
      const plugin = createPluginFromFeature(feature, propValue);
      if (plugin) {
        plugins.push(plugin as BaseGridPlugin);
      }
    }
  }

  return plugins;
}

// Merged config with feature plugins
const mergedConfig = computed<GridConfig<TRow> | undefined>(() => {
  const baseConfig = props.gridConfig ?? {};
  const featurePlugins = createFeaturePlugins();
  const configPlugins = (baseConfig.plugins as BaseGridPlugin[]) ?? [];

  // Merge: feature plugins first, then config plugins
  const mergedPlugins = [...featurePlugins, ...configPlugins];

  // Apply type defaults if provided
  const typeDefaults$ = typeDefaults;

  // Apply icon overrides if provided
  const icons = iconOverrides ? { ...baseConfig.icons, ...iconOverrides } : baseConfig.icons;

  // Build core config overrides from individual props
  const coreConfigOverrides: Record<string, unknown> = {};
  if (props.sortable !== undefined) {
    coreConfigOverrides['sortable'] = props.sortable;
  }
  if (props.filterable !== undefined) {
    coreConfigOverrides['filterable'] = props.filterable;
  }
  if (props.selectable !== undefined) {
    coreConfigOverrides['selectable'] = props.selectable;
  }

  return {
    ...baseConfig,
    ...coreConfigOverrides,
    ...(props.columns ? { columns: props.columns } : {}),
    ...(mergedPlugins.length > 0 ? { plugins: mergedPlugins } : {}),
    ...(icons ? { icons } : {}),
  } as GridConfig<TRow>;
});

// Unsubscribe functions for grid event listeners
const eventCleanups: (() => void)[] = [];

// Setup and cleanup
onMounted(() => {
  const grid = gridRef.value as unknown as HTMLElement & DataGridElement<TRow>;
  if (!grid) return;

  // Attach the framework adapter to the grid element
  // This enables MasterDetailPlugin and ResponsivePlugin to use Vue-based renderers
  const adapter = ensureAdapterRegistered();
  (grid as any).__frameworkAdapter = adapter;

  // Pass type defaults to the adapter
  adapter.setTypeDefaults(typeDefaults ?? null);

  // Subscribe to grid events and store unsubscribe functions
  // Subscribe to all grid events and forward as Vue emits
  for (const eventName of Object.keys(EVENT_MAP)) {
    eventCleanups.push(grid.on(eventName as string, (_d: unknown, e: CustomEvent) => emit(eventName as any, e)));
  }

  // Set initial data
  if (props.rows.length > 0) {
    grid.rows = props.rows;
  }
  if (mergedConfig.value) {
    // Process through adapter before passing to grid
    grid.gridConfig = mergedConfig.value;
  }
  if (props.fitMode) {
    grid.fitMode = props.fitMode;
  }
  if (props.loading !== undefined) {
    grid.loading = props.loading;
  }
  // Handle initial custom styles
  if (props.customStyles) {
    grid.ready?.().then(() => {
      if (gridRef.value) {
        gridRef.value.registerStyles?.('vue-custom-styles', props.customStyles as string);
      }
    });
  }
});

onBeforeUnmount(() => {
  const grid = gridRef.value as unknown as HTMLElement & DataGridElement<TRow>;
  if (!grid) return;

  // Clean up custom styles
  if (props.customStyles) {
    (grid as DataGridElement).unregisterStyles?.('vue-custom-styles');
  }

  // Unsubscribe all grid event listeners
  eventCleanups.forEach((fn) => fn());
  eventCleanups.length = 0;
});

// Watch for prop changes
watch(
  () => props.rows,
  (newRows) => {
    if (gridRef.value) {
      gridRef.value.rows = newRows;
    }
  },
  { deep: true },
);

watch(
  mergedConfig,
  (newConfig) => {
    if (gridRef.value && newConfig) {
      gridRef.value.gridConfig = newConfig;
    }
  },
  { deep: true },
);

watch(
  () => props.fitMode,
  (newFitMode) => {
    if (gridRef.value && newFitMode) {
      gridRef.value.fitMode = newFitMode;
    }
  },
);

watch(
  () => props.loading,
  (newLoading) => {
    if (gridRef.value && newLoading !== undefined) {
      gridRef.value.loading = newLoading;
    }
  },
);

watch(
  () => props.customStyles,
  (newStyles, oldStyles) => {
    if (!gridRef.value) return;
    const grid = gridRef.value;
    if (oldStyles && !newStyles) {
      grid.unregisterStyles?.('vue-custom-styles');
    } else if (newStyles) {
      grid.ready?.().then(() => {
        if (gridRef.value) {
          gridRef.value.registerStyles?.('vue-custom-styles', newStyles);
        }
      });
    }
  },
);

// Watch for type defaults changes
watch(
  () => typeDefaults,
  (newTypeDefaults) => {
    const adapter = ensureAdapterRegistered();
    adapter.setTypeDefaults(newTypeDefaults ?? null);
  },
  { deep: true },
);

// Expose the grid element for programmatic access
defineExpose({
  /** The underlying grid element */
  gridElement: gridRef,
  /** Force a layout recalculation */
  forceLayout: () => gridRef.value?.forceLayout(),
  /** Get current grid configuration */
  getConfig: () => gridRef.value?.getConfig(),
  /** Wait for grid to be ready */
  ready: () => gridRef.value?.ready(),
});
</script>

<template>
  <tbw-grid ref="gridRef">
    <slot></slot>
  </tbw-grid>
</template>
