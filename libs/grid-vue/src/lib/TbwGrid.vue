<script setup lang="ts" generic="TRow = unknown">
import type { BaseGridPlugin, ColumnConfig, DataGridElement, FitMode, GridConfig } from '@toolbox-web/grid';
import { DataGridElement as GridElement } from '@toolbox-web/grid';
import type {
  ClipboardConfig,
  ColumnVirtualizationConfig,
  ContextMenuConfig,
  ExportConfig,
  FilterConfig,
  GroupingColumnsConfig,
  GroupingRowsConfig,
  MasterDetailConfig,
  MultiSortConfig,
  PinnedRowsConfig,
  PivotConfig,
  PrintConfig,
  ReorderConfig,
  ResponsivePluginConfig,
  RowReorderConfig,
  SelectionConfig,
  ServerSideConfig,
  TreeConfig,
  UndoRedoConfig,
  VisibilityConfig,
} from '@toolbox-web/grid/all';
import { computed, onBeforeUnmount, onMounted, provide, ref, watch, type PropType } from 'vue';
import { createPluginFromFeature, type FeatureName } from './feature-registry';
import { useGridIcons } from './grid-icon-registry';
import { useGridTypeDefaults } from './grid-type-registry';
import { GRID_ELEMENT_KEY } from './use-grid';
import { GridAdapter, VueGridAdapter, type GridConfig as VueGridConfig } from './vue-grid-adapter';

// Track if adapter is registered
let adapterRegistered = false;
let globalAdapter: GridAdapter | null = null;

/**
 * Ensure the Vue adapter is registered globally.
 */
function ensureAdapterRegistered(): GridAdapter {
  if (!adapterRegistered) {
    globalAdapter = new VueGridAdapter();
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
  /** @deprecated Use multiSort instead */
  sorting: {
    type: [Boolean, String, Object] as PropType<boolean | 'single' | 'multi' | MultiSortConfig>,
    default: undefined,
  },
  /** Enable column filtering */
  filtering: {
    type: [Boolean, Object] as PropType<boolean | FilterConfig<TRow>>,
    default: undefined,
  },
  /** Enable column drag-to-reorder */
  reorder: {
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
  rowReorder: {
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
});

/**
 * Emits for TbwGrid
 */
const emit = defineEmits<{
  /** Emitted when a cell value is committed */
  (e: 'cell-commit', event: CustomEvent): void;
  /** Emitted when a row's values are committed */
  (e: 'row-commit', event: CustomEvent): void;
  /** Emitted when a cell is clicked */
  (e: 'cell-click', event: CustomEvent): void;
  /** Emitted when a cell is double-clicked */
  (e: 'cell-dblclick', event: CustomEvent): void;
  /** Emitted when selection changes */
  (e: 'selection-change', event: CustomEvent): void;
  /** Emitted when a row is expanded/collapsed */
  (e: 'row-toggle', event: CustomEvent): void;
  /** Emitted when sorting changes */
  (e: 'sort-change', event: CustomEvent): void;
  /** Emitted when the grid is ready */
  (e: 'ready', event: CustomEvent): void;
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
  'sorting',
  'filtering',
  'reorder',
  'visibility',
  'pinnedColumns',
  'groupingColumns',
  'columnVirtualization',
  'rowReorder',
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

  return {
    ...baseConfig,
    ...(props.columns ? { columns: props.columns } : {}),
    ...(mergedPlugins.length > 0 ? { plugins: mergedPlugins } : {}),
    ...(icons ? { icons } : {}),
  } as GridConfig<TRow>;
});

// Event handlers
function handleCellCommit(event: Event) {
  emit('cell-commit', event as CustomEvent);
}

function handleRowCommit(event: Event) {
  emit('row-commit', event as CustomEvent);
}

function handleCellClick(event: Event) {
  emit('cell-click', event as CustomEvent);
}

function handleCellDblclick(event: Event) {
  emit('cell-dblclick', event as CustomEvent);
}

function handleSelectionChange(event: Event) {
  emit('selection-change', event as CustomEvent);
}

function handleRowToggle(event: Event) {
  emit('row-toggle', event as CustomEvent);
}

function handleSortChange(event: Event) {
  emit('sort-change', event as CustomEvent);
}

function handleReady(event: Event) {
  emit('ready', event as CustomEvent);
}

/**
 * Intercepts the element's `gridConfig` property so ALL writes
 * go through the adapter's processGridConfig first.
 *
 * This converts Vue component classes and VNode-returning functions
 * to DOM-returning functions before the grid core sees them.
 * Handles cases where `:grid-config` is bound directly to the
 * custom element (bypassing TbwGrid.vue).
 */
function interceptElementGridConfig(grid: HTMLElement, adapter: GridAdapter): void {
  const proto = Object.getPrototypeOf(grid);
  const desc = Object.getOwnPropertyDescriptor(proto, 'gridConfig');
  if (!desc?.set || !desc?.get) return;

  const originalSet = desc.set;
  const originalGet = desc.get;

  // Instance-level override (does not affect the prototype or other grid elements)
  Object.defineProperty(grid, 'gridConfig', {
    get() {
      return originalGet.call(this);
    },
    set(value: VueGridConfig | undefined) {
      if (value && adapter) {
        // processGridConfig is idempotent: already-processed functions pass
        // through isVueComponent unchanged, so double-processing is safe.
        originalSet.call(this, adapter.processGridConfig(value));
      } else {
        originalSet.call(this, value);
      }
    },
    configurable: true,
  });
}

/**
 * Removes the instance-level gridConfig interceptor,
 * restoring the prototype's original getter/setter.
 */
function removeGridConfigInterceptor(grid: HTMLElement): void {
  // Deleting the instance property restores the prototype accessor
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
  delete (grid as any).gridConfig;
}

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

  // Intercept the element's gridConfig setter so ALL writes
  // (including direct custom element bindings) go through processGridConfig.
  interceptElementGridConfig(grid, adapter);

  // Add event listeners
  grid.addEventListener('cell-commit', handleCellCommit);
  grid.addEventListener('row-commit', handleRowCommit);
  grid.addEventListener('cell-click', handleCellClick);
  grid.addEventListener('cell-dblclick', handleCellDblclick);
  grid.addEventListener('selection-change', handleSelectionChange);
  grid.addEventListener('row-toggle', handleRowToggle);
  grid.addEventListener('sort-change', handleSortChange);
  grid.addEventListener('ready', handleReady);

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
});

onBeforeUnmount(() => {
  const grid = gridRef.value as unknown as HTMLElement & DataGridElement<TRow>;
  if (!grid) return;

  // Remove the gridConfig setter interceptor
  removeGridConfigInterceptor(grid);

  // Remove event listeners
  grid.removeEventListener('cell-commit', handleCellCommit);
  grid.removeEventListener('row-commit', handleRowCommit);
  grid.removeEventListener('cell-click', handleCellClick);
  grid.removeEventListener('cell-dblclick', handleCellDblclick);
  grid.removeEventListener('selection-change', handleSelectionChange);
  grid.removeEventListener('row-toggle', handleRowToggle);
  grid.removeEventListener('sort-change', handleSortChange);
  grid.removeEventListener('ready', handleReady);
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
